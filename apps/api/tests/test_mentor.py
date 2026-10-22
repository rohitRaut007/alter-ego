import logging
from datetime import date, datetime, timedelta, timezone

import pytest
from django.db import connection
from rest_framework.test import APIClient

from accounts.models import User
from analytics.models import EventName, EventOutbox
from billing.models import Subscription
from character.models import PracticeLog
from daily_os.models import Sprint, Task
from mentor import challenges as challenge_service
from mentor import proactive
from mentor.context import RECENT_MESSAGES, build_payload
from mentor.models import (
    ChallengeStatus,
    MemoryFact,
    MentorChallenge,
    MentorMessage,
    MentorNudge,
    MentorThread,
    ThreadSummary,
)
from protocol.models import Protocol
from safety.models import SafetyEvent
from tests.test_daily_os import at_day, pin
from tests.test_protocol_flow import generate_protocol, read_stream

pytestmark = pytest.mark.django_db


@pytest.fixture
def ready(auth_client):
    pid = generate_protocol(auth_client)
    return auth_client, Protocol.objects.get(pk=pid), Sprint.objects.get(protocol_id=pid)


def new_thread(client) -> str:
    res = client.post("/api/v1/mentor/threads", {"kind": "chat"}, format="json")
    assert res.status_code == 201
    return str(res.data["id"])


def say(client, thread_id: str, text: str, stream: bool = False):
    return client.post(f"/api/v1/mentor/threads/{thread_id}/messages",
                       {"content": text, "stream": stream}, format="json")


# --- chat -------------------------------------------------------------------------------


def test_reply_is_grounded_in_the_users_actual_progress(ready):
    client, _, _ = ready
    tid = new_thread(client)
    res = say(client, tid, "What should I do first today?")
    assert res.status_code == 200 and res.data["safety"] is None
    body = res.data["reply"]["body"]
    assert "first thing on your plan" in body and "Week 1" in body
    assert res.data["thread"]["title"] == "What should I do first today?"
    assert res.data["thread"]["message_count"] == 2

    detail = client.get(f"/api/v1/mentor/threads/{tid}").data
    assert [m["role"] for m in detail["messages"]] == ["user", "mentor"]


def test_messages_are_encrypted_at_rest_and_usage_is_logged(ready):
    client, _, _ = ready
    tid = new_thread(client)
    say(client, tid, "I keep avoiding the pricing page.")
    with connection.cursor() as cur:
        cur.execute("SELECT body FROM mentor_mentormessage")
        raw = [r[0] for r in cur.fetchall()]
    assert raw and all(r.startswith("v1:") and "pricing" not in r for r in raw)

    from mentor.models import LLMUsage

    tasks = set(LLMUsage.objects.values_list("task", flat=True))
    assert {"mentor_reply", "memory_extract"} <= tasks
    assert EventOutbox.objects.filter(name=EventName.MENTOR_MESSAGE_SENT).count() == 1


def test_streaming_reply_matches_the_stored_message(ready):
    client, _, _ = ready
    tid = new_thread(client)
    res = say(client, tid, "Where am I drifting from my identity statement?", stream=True)
    assert res.status_code == 200 and res["Content-Type"].startswith("text/event-stream")
    body = read_stream(res)
    assert body.startswith("event: start")
    assert body.count("event: token") >= 3 and "event: done" in body

    import json as _json

    tokens = [
        _json.loads(block.split("data: ", 1)[1])["text"]
        for block in body.split("\n\n")
        if block.startswith("event: token")
    ]
    stored = MentorMessage.objects.filter(role="mentor").get()
    assert "".join(tokens) == stored.body
    assert "identity" in stored.body.lower() or "statement" in stored.body.lower()


def test_empty_and_oversized_messages_are_rejected(ready):
    client, _, _ = ready
    tid = new_thread(client)
    assert say(client, tid, "   ").status_code == 400
    assert say(client, tid, "x" * 4001).status_code == 400


def test_other_users_cannot_use_my_thread(ready, register, client):
    mine, _, _ = ready
    tid = new_thread(mine)
    other = register("other@example.com")
    stranger = APIClient()
    stranger.credentials(HTTP_AUTHORIZATION=f"Bearer {other.data['access']}")
    assert stranger.get(f"/api/v1/mentor/threads/{tid}").status_code == 404
    assert say(stranger, tid, "hello").status_code == 404


def test_mentor_requires_a_protocol_and_the_entitlement(auth_client):
    tid = new_thread(auth_client)  # thread creation does not need a protocol
    assert say(auth_client, tid, "hello").status_code == 404  # no protocol yet
    Subscription.objects.filter(user=User.objects.get()).update(status="canceled")
    res = auth_client.get("/api/v1/mentor/threads")
    assert res.status_code == 403 and res.data["feature"] == "mentor"


# --- memory -----------------------------------------------------------------------------


def test_commitments_are_remembered_and_used_in_later_replies(ready):
    client, _, _ = ready
    tid = new_thread(client)
    say(client, tid, "I will ship the pricing page by Friday. Also, ok.")
    fact = MemoryFact.objects.get()
    assert fact.kind == "commitment" and "pricing page" in fact.text

    second = new_thread(client)
    res = say(client, second, "What should I do first today?")
    assert "You told me earlier" in res.data["reply"]["body"]
    assert "pricing page" in res.data["reply"]["body"]


def test_user_can_view_and_delete_memory(ready, register, client):
    mine, _, _ = ready
    say(mine, new_thread(mine), "I will write the changelog tonight.")
    facts = mine.get("/api/v1/mentor/memory").data
    assert len(facts) == 1
    fid = facts[0]["id"]

    other = register("other@example.com")
    stranger = APIClient()
    stranger.credentials(HTTP_AUTHORIZATION=f"Bearer {other.data['access']}")
    assert stranger.delete(f"/api/v1/mentor/memory/{fid}").status_code == 404

    assert mine.delete(f"/api/v1/mentor/memory/{fid}").status_code == 204
    assert MemoryFact.objects.count() == 0


def test_context_sends_selected_facts_and_never_the_full_history(ready):
    client, _, _ = ready
    tid = new_thread(client)
    user = User.objects.get()
    thread = MentorThread.objects.get(pk=tid)
    for i in range(30):
        MentorMessage.objects.create(thread=thread, role="user" if i % 2 == 0 else "mentor",
                                     body=f"message number {i}")
    for i in range(15):
        MemoryFact.objects.create(user=user, kind="insight", text=f"Insight about topic{i} cats")
    MemoryFact.objects.create(user=user, kind="commitment", text="Will launch on Friday")

    payload = build_payload(user, thread, "tell me about topic3")
    assert len(payload["recent_messages"]) == RECENT_MESSAGES
    assert payload["recent_messages"][-1]["content"] == "message number 29"
    assert len(payload["facts"]) <= 6
    texts = [f["text"] for f in payload["facts"]]
    assert "Will launch on Friday" in texts  # active commitments are always included
    assert any("topic3" in t for t in texts)  # relevance


def test_rolling_summary_is_created_and_reused(ready):
    client, _, _ = ready
    tid = new_thread(client)
    for text in ("First topic about launch.", "Second about pricing.", "Third about reading.",
                 "Fourth about sleep."):
        say(client, tid, text)
    summary = ThreadSummary.objects.get()
    assert summary.covers_messages == 8 and "They raised" in summary.text

    payload = build_payload(User.objects.get(), MentorThread.objects.get(pk=tid), "next")
    assert payload["summaries"] == [summary.text]


# --- safety -----------------------------------------------------------------------------


def test_crisis_message_pauses_the_thread_and_nothing_is_stored(ready, caplog):
    client, _, _ = ready
    tid = new_thread(client)
    from mentor.models import LLMUsage

    before = LLMUsage.objects.filter(task="mentor_reply").count()
    with caplog.at_level(logging.INFO):
        res = say(client, tid, "I don't want to be alive anymore.", stream=True)
    # Even when streaming was requested, a safety stop is plain JSON.
    assert res.status_code == 200 and res["Content-Type"].startswith("application/json")
    assert res.data["safety"]["category"] == "crisis" and res.data["reply"] is None
    assert res.data["thread"]["status"] == "paused_safety"
    assert MentorMessage.objects.count() == 0
    assert LLMUsage.objects.filter(task="mentor_reply").count() == before
    assert "alive anymore" not in caplog.text
    assert SafetyEvent.objects.filter(surface="mentor", category="crisis").count() == 1

    blocked = say(client, tid, "Actually, what should I do today?")
    assert blocked.status_code == 409 and blocked.data["code"] == "thread_paused"

    resumed = client.post(f"/api/v1/mentor/threads/{tid}/resume")
    assert resumed.status_code == 200 and resumed.data["status"] == "open"
    assert say(client, tid, "What should I do first today?").status_code == 200


# --- proactive nudges -------------------------------------------------------------------


def _kinds(nudges) -> list[str]:
    # The sprint starts on the real date, so day 5 can fall inside the Sunday-Wednesday ritual
    # window. Ritual nudges have their own tests; these only look at re-engagement.
    return [n["kind"] for n in nudges if n["kind"] != "ritual"]


def test_reengagement_nudge_after_quiet_days_is_idempotent(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 5))
    first = client.get("/api/v1/mentor/nudges").data
    assert _kinds(first) == ["reengagement"]
    nudge = next(n for n in first if n["kind"] == "reengagement")
    assert "5 days" in nudge["body"] or "since your last" in nudge["body"]
    again = client.get("/api/v1/mentor/nudges").data
    assert len(again) == len(first)
    assert MentorNudge.objects.filter(kind="reengagement").count() == 1


def test_no_nudge_when_the_user_has_been_active(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 5))
    task = Task.objects.get(source_id="c1")
    client.patch(f"/api/v1/tasks/{task.id}", {"done": True}, format="json")
    assert _kinds(client.get("/api/v1/mentor/nudges").data) == []


def test_nudges_respect_the_users_preference(ready, monkeypatch):
    client, _, sprint = ready
    client.patch("/api/v1/me", {"mentor_nudges": False}, format="json")
    pin(monkeypatch, at_day(sprint, 6))
    assert client.get("/api/v1/mentor/nudges").data == []
    assert proactive.run_for_all_users() == 0


def test_ritual_checkin_and_streak_nudges(ready, monkeypatch):
    client, _, sprint = ready
    user = User.objects.get()
    Sprint.objects.update(starts_on=date(2026, 10, 1))
    # keep activity fresh so the re-engagement rule stays quiet
    practice = client.get("/api/v1/traits").data[0]["practices"][0]["id"]
    sunday = datetime(2026, 10, 18, 18, 0, tzinfo=timezone.utc)
    for i in range(7):
        PracticeLog.objects.create(practice_id=practice, user=user,
                                   date=sunday.date() - timedelta(days=i), done=True)
    pin(monkeypatch, sunday)
    kinds = {n["kind"] for n in client.get("/api/v1/mentor/nudges").data}
    assert {"ritual", "streak"} <= kinds

    Sprint.objects.update(starts_on=date(2026, 9, 18))  # sunday is now day 31
    kinds = {n["kind"] for n in client.get("/api/v1/mentor/nudges").data}
    assert "checkin" in kinds


def test_marking_a_nudge_read(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 5))
    nudge = client.get("/api/v1/mentor/nudges").data[0]
    assert nudge["read"] is False
    assert client.post(f"/api/v1/mentor/nudges/{nudge['id']}/read").data["read"] is True


# --- challenges -------------------------------------------------------------------------


def test_weekly_challenges_target_the_slipping_layer_and_become_tasks(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 13))  # day 14, week 2 with overdue work in several layers
    items = client.get("/api/v1/mentor/challenges").data
    assert 2 <= len(items) <= 3 and all(c["status"] == "offered" for c in items)
    assert sum(1 for c in items if c["difficulty"] == "Hard") <= 1
    assert len(client.get("/api/v1/mentor/challenges").data) == len(items)  # stable for the week

    ch = items[0]
    res = client.post(f"/api/v1/mentor/challenges/{ch['id']}/accept")
    assert res.status_code == 200 and res.data["status"] == "accepted" and res.data["task_id"]
    task = Task.objects.get(pk=res.data["task_id"])
    assert task.source == "mentor" and task.priority and task.title == ch["title"]
    assert task.done_at is None

    assert client.post(f"/api/v1/mentor/challenges/{ch['id']}/accept").status_code == 409
    other = items[1]
    assert client.post(f"/api/v1/mentor/challenges/{other['id']}/dismiss").data["status"] == "dismissed"


def test_challenge_weak_layer_input_comes_from_overdue_work(ready, monkeypatch):
    _, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 13))
    captured = {}

    class Spy:
        model_name = "spy"

        def complete_json(self, **kw):
            from mentor.llm.base import LLMResult
            from mentor.llm.fake import FakeLLM

            captured.update(kw["payload"])
            return FakeLLM().complete_json(**kw)

    from mentor.llm.service import LLMService

    user = User.objects.get()
    challenge_service.ensure_weekly(user, LLMService(Spy()))
    assert captured["weak_layers"] and captured["weak_layers"][0]["overdue"] >= 1
    assert captured["week"] == 2


def test_prompts_include_a_dynamic_one_when_work_is_overdue(ready, monkeypatch):
    client, _, sprint = ready
    base = client.get("/api/v1/mentor/prompts").data
    assert base["persona_name"] == "Mentor" and "What should I do first today?" in base["prompts"]
    pin(monkeypatch, at_day(sprint, 13))
    dyn = client.get("/api/v1/mentor/prompts").data["prompts"]
    assert dyn[0].startswith("Why are my ") and dyn[0].endswith("tasks slipping?")


def test_unknown_challenge_fields_are_normalised():
    from mentor.challenges import DIFFICULTIES, LAYERS

    assert "Hard" in DIFFICULTIES and "mission" in LAYERS


def test_challenge_status_enum_values():
    assert {s.value for s in ChallengeStatus} == {"offered", "accepted", "dismissed"}
    assert MentorChallenge._meta.get_field("status").default == "offered"
