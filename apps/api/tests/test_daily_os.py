import logging
from datetime import date, datetime, timedelta, timezone

import pytest
from django.db import connection

from accounts.models import User
from analytics.models import EventName, EventOutbox
from billing.models import Subscription
from character.models import PracticeLog
from character.streaks import streak_stats
from core import clock
from daily_os.models import DailyReflection, DeepWorkSession, Sprint, Task
from daily_os.services import (
    choose_tone,
    ritual_state,
    sync_protocol,
    week_insight,
)
from protocol.models import Protocol, ProtocolSection
from tests.test_protocol_flow import generate_protocol

pytestmark = pytest.mark.django_db


@pytest.fixture
def ready(auth_client):
    """A signed-in client with a generated protocol, plus its sprint."""
    pid = generate_protocol(auth_client)
    sprint = Sprint.objects.get(protocol_id=pid)
    return auth_client, Protocol.objects.get(pk=pid), sprint


def pin(monkeypatch, moment: datetime) -> None:
    monkeypatch.setattr(clock, "now", lambda: moment)


def at_day(sprint: Sprint, days: int, hour: int = 12) -> datetime:
    d = sprint.starts_on + timedelta(days=days)
    return datetime(d.year, d.month, d.day, hour, 0, tzinfo=timezone.utc)


def task_by_source(source_id: str) -> Task:
    return Task.objects.get(source_id=source_id)


# --- streak maths -------------------------------------------------------------------------


def d(n: int) -> date:
    return date(2026, 10, 1) + timedelta(days=n)


def test_daily_streak_counts_through_yesterday_when_today_is_open():
    assert streak_stats({d(0), d(1), d(2)}, d(3)) == (3, 3)


def test_daily_streak_resets_after_a_missed_day():
    assert streak_stats({d(0), d(1), d(2)}, d(4)) == (0, 3)


def test_daily_streak_best_survives_a_gap():
    assert streak_stats({d(0), d(1), d(2), d(4), d(5)}, d(5)) == (2, 3)


def test_streak_with_no_history():
    assert streak_stats(set(), d(3)) == (0, 0)


def test_weekly_streak_counts_consecutive_weeks():
    # Mondays: Oct 5, Oct 12, Oct 19 2026
    done = {date(2026, 10, 6), date(2026, 10, 14), date(2026, 10, 21)}
    assert streak_stats(done, date(2026, 10, 21), "weekly") == (3, 3)
    # This week not yet done: previous weeks still count.
    assert streak_stats(done, date(2026, 10, 27), "weekly") == (3, 3)
    assert streak_stats(done, date(2026, 11, 3), "weekly") == (0, 3)


# --- materialisation ----------------------------------------------------------------------


def test_protocol_becomes_sprint_tasks_and_traits(ready):
    client, protocol, sprint = ready
    assert (sprint.ends_on - sprint.starts_on).days == 90
    assert Task.objects.filter(source="checklist30").count() == 12
    assert Task.objects.filter(source="sprint90").count() == 36
    day1 = task_by_source("c1")
    assert day1.due_date == sprint.starts_on + timedelta(days=1)  # first task is due tomorrow
    assert day1.priority and day1.layer == "mission"

    traits = client.get("/api/v1/traits").data
    assert [t["name"] for t in traits] == ["Follow-through", "Honest review", "Deep focus",
                                           "Steady courage"]
    assert traits[0]["practices"][0]["cadence"] == "daily"
    assert Task.objects.get(source_id="c4").trait.name == "Follow-through"


def test_sync_is_idempotent_and_preserves_completion(ready):
    client, protocol, _ = ready
    task = task_by_source("c1")
    assert client.patch(f"/api/v1/tasks/{task.id}", {"done": True}, format="json").status_code == 200
    before = (Task.objects.count(), Sprint.objects.count())

    sync_protocol(protocol)
    sync_protocol(protocol)

    assert (Task.objects.count(), Sprint.objects.count()) == before
    assert Task.objects.get(pk=task.id).done_at is not None


def test_sync_after_revision_adds_archives_and_keeps_history(ready):
    client, protocol, sprint = ready
    done_task = task_by_source("c1")
    client.patch(f"/api/v1/tasks/{done_task.id}", {"done": True}, format="json")
    section = ProtocolSection.objects.filter(protocol=protocol, key="checklist_30").get()
    tasks = [t for t in section.content["tasks"] if t["id"] not in ("c1", "c2")]
    tasks.append({**tasks[0], "id": "c99", "title": "A new task", "due_day": 4})
    ProtocolSection.objects.create(
        protocol=protocol, key="checklist_30", revision=2, content={"tasks": tasks},
        prompt_version="v1", model="fake-llm-1",
    )

    sync_protocol(protocol)

    assert Task.objects.filter(source_id="c99", archived_at__isnull=True).exists()
    # Untouched removed task is deleted; the completed one is archived, not lost.
    assert not Task.objects.filter(source_id="c2").exists()
    archived = Task.objects.get(source_id="c1")
    assert archived.archived_at is not None and archived.done_at is not None
    assert client.get("/api/v1/tasks").data and all(
        t["id"] != str(done_task.id) for t in client.get("/api/v1/tasks").data
    )
    assert Sprint.objects.get(pk=sprint.pk).starts_on == sprint.starts_on


def test_no_protocol_yields_a_clear_404(auth_client):
    res = auth_client.get("/api/v1/daily/brief")
    assert res.status_code == 404
    assert res.data["detail"].startswith("Complete the interview")


# --- tasks --------------------------------------------------------------------------------


def test_complete_and_undo_a_task_tracks_once(ready):
    client, _, _ = ready
    task = task_by_source("c3")
    url = f"/api/v1/tasks/{task.id}"
    assert client.patch(url, {"done": True}, format="json").data["done"] is True
    assert client.patch(url, {"done": True}, format="json").data["done"] is True  # idempotent
    events = EventOutbox.objects.filter(name=EventName.TASK_COMPLETED)
    assert events.count() == 1
    assert events.get().props == {"layer": "knowledge", "source": "checklist30"}
    assert client.patch(url, {"done": False}, format="json").data["done"] is False


def test_task_filters(ready):
    client, _, sprint = ready
    knowledge = client.get("/api/v1/tasks?layer=knowledge").data
    assert knowledge and all(t["layer"] == "knowledge" for t in knowledge)
    first_week = sprint.starts_on + timedelta(days=7)
    window = client.get(f"/api/v1/tasks?to={first_week.isoformat()}").data
    assert window and all(t["due_date"] <= first_week.isoformat() for t in window)
    assert client.get("/api/v1/tasks?from=not-a-date").status_code == 400


def test_other_users_tasks_are_invisible(ready, register, client):
    _, _, _ = ready
    task = task_by_source("c1")
    other = register("other@example.com")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {other.data['access']}")
    assert client.patch(f"/api/v1/tasks/{task.id}", {"done": True}, format="json").status_code == 404


# --- brief --------------------------------------------------------------------------------


def test_day_one_brief_starts_gently(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 0))
    brief = client.get("/api/v1/daily/brief").data
    assert brief["day_number"] == 1 and brief["tone"] == "start"
    assert brief["week"]["week"] == 1 and brief["week"]["total"] == 3
    assert brief["insight"] == "You have completed 0 of 3 Week 1 tasks. Nothing is overdue."
    assert brief["alter_ego_name"] == "The Operator"
    assert [b["label"] for b in brief["schedule"]][:2] == ["Plan the day", "Deep work"]
    assert brief["checklist"] == {"total": 12, "done": 0, "overdue": 0}
    assert all(p["cadence"] in ("daily", "weekly") for p in brief["practices"])
    # Active-day analytics fire once per local day.
    client.get("/api/v1/daily/brief")
    assert EventOutbox.objects.filter(name=EventName.SESSION_ACTIVE).count() == 1


def test_day_fourteen_brief_names_the_layer_that_slipped(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 13))  # day 14, week 2
    for source_id in ("s2_1", "s2_3"):
        client.patch(f"/api/v1/tasks/{task_by_source(source_id).id}", {"done": True}, format="json")
    brief = client.get("/api/v1/daily/brief").data
    assert brief["day_number"] == 14 and brief["week"]["week"] == 2
    assert brief["insight"] == (
        "You have completed 2 of 3 Week 2 tasks. The 1 overdue is all in Knowledge."
    )
    assert brief["week"]["overdue_by_layer"] == {"knowledge": 1}
    assert brief["focus"] and brief["focus"][0]["priority"] is True


def test_week_insight_when_several_layers_slip():
    wp = {"week": 2, "total": 12, "done": 8, "overdue": 4,
          "overdue_by_layer": {"knowledge": 3, "presence": 1}}
    assert week_insight(wp) == (
        "You have completed 8 of 12 Week 2 tasks. The 4 overdue are 3 in Knowledge, 1 in Presence."
    )
    assert week_insight({"week": 1, "total": 0, "done": 0, "overdue": 0,
                         "overdue_by_layer": {}}) is None


def test_tone_follows_completion_and_streak():
    on_track = {"done": 9, "overdue": 1}
    behind = {"done": 1, "overdue": 6}
    assert choose_tone({"done": 0, "overdue": 0}, 0, has_history=False) == "start"
    assert choose_tone(on_track, 5, True) == "push"
    assert choose_tone(on_track, 1, True) == "balanced"
    assert choose_tone(behind, 0, True) == "steady"


def test_brief_tone_becomes_push_with_a_streak(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 9))
    practice = client.get("/api/v1/traits").data[0]["practices"][0]
    today = sprint.starts_on + timedelta(days=9)
    for i in range(1, 5):
        PracticeLog.objects.create(practice_id=practice["id"], user=User.objects.get(),
                                   date=today - timedelta(days=i), done=True)
    for t in Task.objects.filter(week_index=2):
        client.patch(f"/api/v1/tasks/{t.id}", {"done": True}, format="json")
    brief = client.get("/api/v1/daily/brief").data
    assert brief["practice_streak"] == 4
    assert brief["tone"] == "push"


def test_brief_requires_the_daily_os_entitlement(ready):
    client, _, _ = ready
    Subscription.objects.filter(user=User.objects.get()).update(status="canceled")
    res = client.get("/api/v1/daily/brief")
    assert res.status_code == 403 and res.data["feature"] == "daily_os"


# --- sprint -------------------------------------------------------------------------------


def test_sprint_view_groups_weeks_and_marks_current(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 8))  # day 9 -> week 2
    data = client.get("/api/v1/sprints/current").data
    assert data["day_number"] == 9 and len(data["weeks"]) == 12 and len(data["checklist"]) == 12
    current = [w for w in data["weeks"] if w["is_current"]]
    assert [w["index"] for w in current] == [2]
    assert data["weeks"][0]["total"] == 3


# --- reflection ---------------------------------------------------------------------------


def test_reflection_is_saved_encrypted_and_editable_same_day(ready):
    client, _, _ = ready
    body = {"answers": {"compounded": "Shipped the onboarding fix.", "leaked": "Slack.",
                        "tomorrow": "Write the pricing page."}, "rating": 4}
    res = client.post("/api/v1/reflections", body, format="json")
    assert res.status_code == 200 and res.data["reflection"]["rating"] == 4
    assert len(res.data["prompts"]) == 3
    with connection.cursor() as cur:
        cur.execute("SELECT answers FROM daily_os_dailyreflection")
        raw = cur.fetchone()[0]
    assert raw.startswith("v1:") and "onboarding" not in raw

    body["answers"]["compounded"] = "Shipped it and wrote the changelog."
    client.post("/api/v1/reflections", body, format="json")
    assert DailyReflection.objects.count() == 1
    got = client.get("/api/v1/reflections").data["reflection"]
    assert "changelog" in got["answers"]["compounded"]
    assert EventOutbox.objects.filter(name=EventName.REFLECTION_COMPLETED).count() == 1


def test_reflection_validation_and_date_window(ready):
    client, _, _ = ready
    assert client.post("/api/v1/reflections", {"answers": {"compounded": ""}},
                       format="json").status_code == 400
    old = (clock.local_today(User.objects.get()) - timedelta(days=5)).isoformat()
    res = client.post("/api/v1/reflections",
                      {"answers": {"compounded": "x"}, "date": old}, format="json")
    assert res.status_code == 409


def test_reflection_with_crisis_language_is_not_saved(ready, caplog):
    client, _, _ = ready
    text = "Nothing compounded. I want to end my life."
    with caplog.at_level(logging.INFO):
        res = client.post("/api/v1/reflections", {"answers": {"compounded": text}}, format="json")
    assert res.status_code == 200
    assert res.data["reflection"] is None and res.data["safety"]["category"] == "crisis"
    assert DailyReflection.objects.count() == 0
    assert "end my life" not in caplog.text
    assert not EventOutbox.objects.filter(name=EventName.REFLECTION_COMPLETED).exists()


# --- deep work ----------------------------------------------------------------------------


def test_deep_work_lifecycle(ready, monkeypatch):
    client, _, sprint = ready
    start = at_day(sprint, 1, hour=9)
    pin(monkeypatch, start)
    task = task_by_source("c1")
    res = client.post("/api/v1/deep-work/sessions",
                      {"planned_minutes": 90, "task_id": str(task.id)}, format="json")
    assert res.status_code == 201
    sid = res.data["id"]
    assert client.get("/api/v1/deep-work/sessions/active").data["id"] == sid
    assert client.post("/api/v1/deep-work/sessions", {"planned_minutes": 25},
                       format="json").status_code == 409

    pin(monkeypatch, start + timedelta(minutes=52))
    done = client.patch(f"/api/v1/deep-work/sessions/{sid}", {"action": "end"}, format="json")
    assert done.status_code == 200 and done.data["actual_minutes"] == 52
    assert client.get("/api/v1/deep-work/sessions/active").status_code == 404
    ev = EventOutbox.objects.get(name=EventName.DEEP_WORK_SESSION_COMPLETED)
    assert ev.props == {"minutes": 52, "planned": 90}

    pin(monkeypatch, at_day(sprint, 1, hour=13))
    brief = client.get(f"/api/v1/daily/brief?date={(sprint.starts_on + timedelta(days=1))}").data
    assert brief["deep_work_minutes_today"] == 52


def test_abandoned_session_is_not_counted(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 1, hour=9))
    sid = client.post("/api/v1/deep-work/sessions", {"planned_minutes": 30},
                      format="json").data["id"]
    client.patch(f"/api/v1/deep-work/sessions/{sid}", {"action": "abandon"}, format="json")
    assert DeepWorkSession.objects.get(pk=sid).abandoned is True
    assert not EventOutbox.objects.filter(name=EventName.DEEP_WORK_SESSION_COMPLETED).exists()


def test_deep_work_bounds_and_foreign_task(ready):
    client, _, _ = ready
    assert client.post("/api/v1/deep-work/sessions", {"planned_minutes": 1},
                       format="json").status_code == 400
    assert client.post("/api/v1/deep-work/sessions",
                       {"planned_minutes": 25, "task_id": "00000000-0000-0000-0000-000000000000"},
                       format="json").status_code == 404


# --- weekly ritual ------------------------------------------------------------------------


def test_ritual_window_opens_sunday_evening(ready, monkeypatch):
    client, _, _ = ready
    Sprint.objects.update(starts_on=date(2026, 10, 1))
    user = User.objects.get()

    def state(y, m, day, hour):
        pin(monkeypatch, datetime(y, m, day, hour, 0, tzinfo=timezone.utc))
        return ritual_state(user)

    assert state(2026, 10, 17, 20)["available"] is False       # Saturday
    assert state(2026, 10, 18, 16)["available"] is False       # Sunday before 17:00
    sunday = state(2026, 10, 18, 17)
    assert sunday["due"] and sunday["week_start"] == date(2026, 10, 12)
    monday = state(2026, 10, 19, 9)                            # still open on Monday
    assert monday["due"] and monday["week_start"] == date(2026, 10, 12)
    assert state(2026, 10, 22, 9)["available"] is False        # Thursday


def test_ritual_does_not_open_for_a_week_before_the_sprint_began(ready, monkeypatch):
    client, _, _ = ready
    Sprint.objects.update(starts_on=date(2026, 10, 19))  # sprint begins on the Monday after
    pin(monkeypatch, datetime(2026, 10, 20, 9, 0, tzinfo=timezone.utc))  # Tuesday
    assert ritual_state(User.objects.get())["available"] is False
    pin(monkeypatch, datetime(2026, 10, 25, 18, 0, tzinfo=timezone.utc))  # first Sunday
    assert ritual_state(User.objects.get())["due"] is True


def test_ritual_completes_once_with_stats(ready, monkeypatch):
    client, _, sprint = ready
    Sprint.objects.update(starts_on=date(2026, 10, 1))
    pin(monkeypatch, datetime(2026, 10, 18, 18, 0, tzinfo=timezone.utc))
    got = client.get("/api/v1/weekly-ritual").data
    assert got["state"]["due"] is True and len(got["prompts"]) == 3
    assert {"tasks_due", "tasks_done", "missed_by_layer", "practice_days",
            "deep_work_minutes"} <= set(got["stats"])

    answers = {"shipped": "The onboarding flow.", "slipped": "Reading.", "next_outcome": "Pricing."}
    res = client.post("/api/v1/weekly-ritual", answers, format="json")
    assert res.status_code == 200 and res.data["state"]["completed"] is True
    assert res.data["answers"]["next_outcome"] == "Pricing."
    assert EventOutbox.objects.filter(name=EventName.WEEKLY_RITUAL_COMPLETED).count() == 1
    # Completing again edits it without a second analytics event.
    client.post("/api/v1/weekly-ritual", {**answers, "slipped": "Writing."}, format="json")
    assert EventOutbox.objects.filter(name=EventName.WEEKLY_RITUAL_COMPLETED).count() == 1


def test_ritual_not_available_midweek_and_screened(ready, monkeypatch):
    client, _, _ = ready
    Sprint.objects.update(starts_on=date(2026, 10, 1))
    pin(monkeypatch, datetime(2026, 10, 22, 18, 0, tzinfo=timezone.utc))  # Thursday
    body = {"shipped": "Things.", "slipped": "", "next_outcome": "More."}
    assert client.post("/api/v1/weekly-ritual", body, format="json").status_code == 409

    pin(monkeypatch, datetime(2026, 10, 18, 18, 0, tzinfo=timezone.utc))
    flagged = {"shipped": "Nothing.", "slipped": "I feel hopeless.", "next_outcome": "Survive."}
    res = client.post("/api/v1/weekly-ritual", flagged, format="json")
    assert res.data["safety"]["category"] == "distress" and res.data["state"]["completed"] is False


# --- user-added tasks -------------------------------------------------------------------


def test_user_can_add_and_delete_their_own_task_and_sync_keeps_it(ready):
    client, protocol, sprint = ready
    res = client.post("/api/v1/tasks/new", {"title": "Write the launch email", "minutes": 40,
                                            "block": "evening"}, format="json")
    assert res.status_code == 200 and res.data["safety"] is None
    task = res.data["task"]
    assert task["source"] == "user" and task["block"] == "evening" and task["minutes"] == 40

    sync_protocol(protocol)  # must not remove tasks the user added
    assert Task.objects.filter(pk=task["id"]).exists()

    brief = client.get("/api/v1/daily/brief").data
    assert any(t["id"] == task["id"] for t in brief["due_tasks"])

    assert client.delete(f"/api/v1/tasks/{task['id']}").status_code == 204
    protocol_task = Task.objects.filter(source="checklist30").first()
    assert client.delete(f"/api/v1/tasks/{protocol_task.id}").status_code == 409


def test_user_task_text_is_screened(ready):
    client, _, _ = ready
    res = client.post("/api/v1/tasks/new", {"title": "I want to end my life"}, format="json")
    assert res.data["task"] is None and res.data["safety"]["category"] == "crisis"
    assert not Task.objects.filter(source="user").exists()


def test_tasks_get_a_block_for_grouping(ready):
    _, _, _ = ready
    blocks = set(Task.objects.values_list("block", flat=True))
    assert blocks <= {"morning", "deep_work", "evening"} and len(blocks) >= 2
