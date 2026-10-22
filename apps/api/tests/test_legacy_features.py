import json
from datetime import date, datetime, timedelta, timezone

import pytest
from django.db import connection
from rest_framework.test import APIClient

from accounts.models import ConsentLedger, User
from billing.models import Subscription
from calendars.models import CalendarEvent
from character.models import PracticeLog
from knowledge.models import KnowledgeNote, ReadingItem
from knowledge.services import ask_advisor
from legacy.models import LegacyMilestone, QuarterlyReview
from mentor.llm.base import LLMResult
from mentor.llm.service import LLMService
from personality.models import PersonalityResult
from personality.questions import QUESTIONS, compute_scores
from protocol.models import Protocol, ProtocolSection
from safety.models import SafetyEvent
from tests.test_daily_os import at_day, pin
from tests.test_protocol_flow import generate_protocol

pytestmark = pytest.mark.django_db


@pytest.fixture
def ready(auth_client):
    pid = generate_protocol(auth_client)
    return auth_client, Protocol.objects.get(pk=pid)


def upgrade() -> None:
    Subscription.objects.update(tier="full")


# --- knowledge --------------------------------------------------------------------------


def test_library_has_sequenced_items_stats_roadmap_and_recommendation(ready):
    client, _ = ready
    lib = client.get("/api/v1/knowledge/library").data
    assert [i["sequence"] for i in lib["items"]] == [1, 2, 3, 4, 5, 6]
    assert lib["stats"] == {"reading": 0, "finished": 0, "want": 6, "notes": 0,
                            "average_progress": 0}
    assert lib["recommendation"]["kind"] == "start"
    assert lib["recommendation"]["title"] == lib["items"][0]["title"]
    assert [p["phase"] for p in lib["roadmap"]] == ["now", "next_90_days", "this_year"]
    assert "destruction" not in lib["destruction_test_template"].lower() or lib["destruction_test_template"]


def test_progress_moves_status_and_changes_the_recommendation(ready):
    client, _ = ready
    first = client.get("/api/v1/knowledge/library").data["items"][0]
    url = f"/api/v1/knowledge/items/{first['id']}"

    res = client.patch(url, {"progress": 10}, format="json")
    assert res.data["status"] == "reading" and res.data["progress"] == 10 and res.data["started_at"]
    lib = client.get("/api/v1/knowledge/library").data
    assert lib["recommendation"]["kind"] == "finish" and lib["stats"]["reading"] == 1

    done = client.patch(url, {"progress": 100}, format="json").data
    assert done["status"] == "finished" and done["finished_at"]
    # Reopening clears the finish date.
    again = client.patch(url, {"status": "reading", "progress": 60}, format="json").data
    assert again["status"] == "reading" and again["finished_at"] is None


def test_invalid_progress_and_foreign_items(ready, register):
    client, _ = ready
    item = client.get("/api/v1/knowledge/library").data["items"][0]
    assert client.patch(f"/api/v1/knowledge/items/{item['id']}", {"progress": 140},
                        format="json").status_code == 400
    assert client.patch(f"/api/v1/knowledge/items/{item['id']}", {"status": "nope"},
                        format="json").status_code == 400
    other = register("other@example.com")
    stranger = APIClient()
    stranger.credentials(HTTP_AUTHORIZATION=f"Bearer {other.data['access']}")
    assert stranger.patch(f"/api/v1/knowledge/items/{item['id']}", {"progress": 5},
                          format="json").status_code == 404


def test_notes_and_the_collision_notebook(ready):
    client, _ = ready
    res = client.post("/api/v1/knowledge/notes", {
        "title": "Impro x Systems", "source": "Impro x Thinking in Systems",
        "body": "Status games are feedback loops.", "kind": "collision",
    }, format="json")
    assert res.status_code == 200 and res.data["safety"] is None
    assert "collision" in res.data["note"]["tags"]
    client.post("/api/v1/knowledge/notes",
                {"title": "Deep Work", "body": "Schedule depth.", "tags": ["focus"]}, format="json")

    assert len(client.get("/api/v1/knowledge/notes").data) == 2
    only = client.get("/api/v1/knowledge/notes?kind=collision").data
    assert [n["title"] for n in only] == ["Impro x Systems"]
    assert client.get("/api/v1/knowledge/library").data["stats"]["notes"] == 2

    with connection.cursor() as cur:
        cur.execute("SELECT body FROM knowledge_knowledgenote")
        assert all(r[0].startswith("v1:") for r in cur.fetchall())

    nid = only[0]["id"]
    assert client.delete(f"/api/v1/knowledge/notes/{nid}").status_code == 204
    assert KnowledgeNote.objects.count() == 1


def test_note_with_crisis_language_is_not_saved(ready):
    client, _ = ready
    res = client.post("/api/v1/knowledge/notes",
                      {"title": "x", "body": "I want to end my life."}, format="json")
    assert res.data["note"] is None and res.data["safety"]["category"] == "crisis"
    assert KnowledgeNote.objects.count() == 0


def test_advisor_cites_only_curated_sources_not_already_owned(ready):
    client, _ = ready
    res = client.post("/api/v1/knowledge/advisor",
                      {"query": "What should I read next about focus and habits?"}, format="json")
    assert res.status_code == 200 and res.data["safety"] is None
    assert res.data["answer"]
    owned = {i.title for i in ReadingItem.objects.all()}
    assert res.data["sources"]
    assert all(s["title"] not in owned for s in res.data["sources"])
    assert all(s["summary"] for s in res.data["sources"])


def test_advisor_drops_source_ids_that_are_not_candidates(ready):
    _, protocol = ready

    class Hallucinating:
        model_name = "bad"

        def complete_json(self, **kw):
            return LLMResult(
                data={"answer": "Read this.", "source_ids": ["essentialism", "totally_made_up_book", "deep_work"]},
                model="bad", input_tokens=1, output_tokens=1,
            )

    user = User.objects.get()
    out = ask_advisor(user, protocol, "focus", LLMService(Hallucinating()))
    assert [s["id"] for s in out["sources"]] == ["essentialism"]


def test_advisor_crisis_query_returns_safety(ready):
    client, _ = ready
    res = client.post("/api/v1/knowledge/advisor",
                      {"query": "I feel hopeless, what do I read"}, format="json")
    assert res.data["safety"]["category"] == "distress" and res.data["answer"] == ""


def test_knowledge_sync_after_revision_keeps_progress(ready):
    client, protocol = ready
    items = client.get("/api/v1/knowledge/library").data["items"]
    client.patch(f"/api/v1/knowledge/items/{items[0]['id']}", {"progress": 40}, format="json")
    sec = ProtocolSection.objects.filter(protocol=protocol, key="knowledge").get()
    content = dict(sec.content)
    content["reading_list"] = [dict(r) for r in content["reading_list"][:5]]
    ProtocolSection.objects.create(protocol=protocol, key="knowledge", revision=2,
                                   content=content, prompt_version="v1", model="fake")
    from knowledge.services import sync_reading

    sync_reading(protocol)
    lib = client.get("/api/v1/knowledge/library").data
    assert len(lib["items"]) == 5
    assert lib["items"][0]["progress"] == 40


# --- legacy timeline --------------------------------------------------------------------


def test_timeline_has_protocol_milestones_per_horizon(ready):
    client, _ = ready
    upgrade()
    tl = client.get("/api/v1/legacy/timeline").data
    by_h = {}
    for m in tl["milestones"]:
        by_h.setdefault(m["horizon"], []).append(m)
    assert set(by_h) == {"2y", "5y", "life"}
    assert all(len(v) == 2 for v in by_h.values())  # statement + one evidence checkpoint
    assert tl["summary"] == {"total": 6, "done": 0, "average_progress": 0}
    assert tl["next_review"] is None


def test_legacy_is_a_full_tier_feature(ready):
    client, _ = ready
    res = client.get("/api/v1/legacy/timeline")
    assert res.status_code == 403 and res.data["feature"] == "legacy"


def test_add_complete_reopen_and_delete_milestones(ready):
    client, _ = ready
    upgrade()
    added = client.post("/api/v1/legacy/milestones", {
        "title": "Publish a book", "horizon": "5y", "detail": "Draft in year 3"}, format="json")
    assert added.status_code == 200
    mid = added.data["milestone"]["id"]
    assert added.data["milestone"]["origin"] == "user"

    done = client.patch(f"/api/v1/legacy/milestones/{mid}", {"done": True}, format="json").data
    assert done["milestone"]["done"] is True and done["milestone"]["progress"] == 100
    reopened = client.patch(f"/api/v1/legacy/milestones/{mid}", {"done": False}, format="json").data
    assert reopened["milestone"]["done"] is False and reopened["milestone"]["progress"] == 0
    part = client.patch(f"/api/v1/legacy/milestones/{mid}", {"progress": 35}, format="json").data
    assert part["milestone"]["progress"] == 35

    assert client.delete(f"/api/v1/legacy/milestones/{mid}").status_code == 204
    protocol_ms = LegacyMilestone.objects.filter(origin="protocol").first()
    blocked = client.delete(f"/api/v1/legacy/milestones/{protocol_ms.id}")
    assert blocked.status_code == 409


def test_milestone_text_is_screened(ready):
    client, _ = ready
    upgrade()
    res = client.post("/api/v1/legacy/milestones",
                      {"title": "I want to die", "horizon": "life"}, format="json")
    assert res.data["milestone"] is None and res.data["safety"]["category"] == "crisis"
    assert not LegacyMilestone.objects.filter(origin="user").exists()


def test_quarterly_review_schedule_and_complete(ready, monkeypatch):
    client, _ = ready
    upgrade()
    pin(monkeypatch, datetime(2026, 10, 13, 9, 0, tzinfo=timezone.utc))
    sched = client.post("/api/v1/legacy/reviews", {}, format="json")
    assert sched.status_code == 201 and sched.data["scheduled_for"] == "2026-12-31"
    assert client.get("/api/v1/legacy/timeline").data["next_review"]["scheduled_for"] == "2026-12-31"

    past = client.post("/api/v1/legacy/reviews", {"scheduled_for": "2026-10-01"}, format="json")
    assert past.status_code == 409

    rid = sched.data["id"]
    body = {"on_track": "Mostly. Shipping slipped.", "change": "Cut two goals."}
    res = client.post(f"/api/v1/legacy/reviews/{rid}/complete", body, format="json")
    assert res.status_code == 200 and res.data["review"]["completed_at"]
    assert client.post(f"/api/v1/legacy/reviews/{rid}/complete", body,
                       format="json").status_code == 409
    assert QuarterlyReview.objects.get().answers["on_track"].startswith("Mostly")


# --- personality ------------------------------------------------------------------------


def test_questionnaire_shape(auth_client):
    data = auth_client.get("/api/v1/personality/questions").data
    assert len(data["questions"]) == 20
    assert {t["trait"] for t in data["traits"]} == {
        "openness", "conscientiousness", "extraversion", "agreeableness", "stability"}


def test_scoring_matches_the_legacy_formula():
    # All 5s: reversed items score 1, so each trait is its non-reversed share.
    all_fives = {q["id"]: 5 for q in QUESTIONS}
    s = compute_scores(all_fives)
    assert s["openness"] == round(((3 * 5 + 1) / 4 - 1) / 4 * 100)
    # Calm and not reactive => high stability; the legacy code inverted neuroticism the same way.
    calm = {"p18": 5, "p19": 1, "p20": 1}
    assert compute_scores(calm)["stability"] == 100
    assert compute_scores({"p18": 1, "p19": 5, "p20": 5})["stability"] == 0
    assert compute_scores({})["openness"] == 50


def test_submit_retake_and_validation(auth_client):
    assert auth_client.get("/api/v1/personality").status_code == 404
    answers = {q["id"]: 4 for q in QUESTIONS}
    res = auth_client.post("/api/v1/personality", {"answers": answers}, format="json")
    assert res.status_code == 200 and res.data["answered"] == 20
    assert set(res.data["scores"]) == {"openness", "conscientiousness", "extraversion",
                                       "agreeableness", "stability"}
    partial = auth_client.post("/api/v1/personality", {"answers": {"p1": 5}}, format="json")
    assert partial.data["answered"] == 1 and PersonalityResult.objects.count() == 1

    assert auth_client.post("/api/v1/personality", {"answers": {"zz": 3}},
                            format="json").status_code == 400
    assert auth_client.post("/api/v1/personality", {"answers": {"p1": 9}},
                            format="json").status_code == 400
    with connection.cursor() as cur:
        cur.execute("SELECT answers FROM personality_personalityresult")
        assert cur.fetchone()[0].startswith("v1:")


def test_personality_feeds_the_mentor_context(ready):
    client, _ = ready
    client.post("/api/v1/personality", {"answers": {"p1": 5}}, format="json")
    from mentor.context import build_payload
    from mentor.models import MentorThread

    user = User.objects.get()
    thread = MentorThread.objects.create(user=user)
    assert build_payload(user, thread, "hi")["personality"]["openness"] == 100


# --- calendar ---------------------------------------------------------------------------


def test_calendar_demo_connect_sync_is_idempotent_and_honest(ready):
    client, _ = ready
    upgrade()
    assert client.get("/api/v1/calendar").data["connected"] is False
    assert client.post("/api/v1/calendar/sync").status_code == 404  # connect first

    st = client.post("/api/v1/calendar", {"account_email": "me@gmail.com"}, format="json").data
    assert st["connected"] and st["link"]["mode"] == "demo"
    assert "Demo mode" in st["demo_notice"]

    first = client.post("/api/v1/calendar/sync").data
    assert first["created"] > 0 and first["mode"] == "demo"
    assert client.post("/api/v1/calendar/sync").data["created"] == 0

    events = client.get("/api/v1/calendar/events").data
    assert events and {e["category"] for e in events} <= {"deep_work", "task"}
    assert any(e["category"] == "deep_work" for e in events)

    assert client.delete("/api/v1/calendar").status_code == 204
    assert CalendarEvent.objects.count() == 0
    assert client.get("/api/v1/calendar").data["connected"] is False


def test_calendar_is_a_full_tier_feature(ready):
    client, _ = ready
    assert client.get("/api/v1/calendar").status_code == 403


# --- dashboard --------------------------------------------------------------------------


def test_dashboard_aggregates_everything(ready, monkeypatch):
    client, _ = ready
    upgrade()
    sprint_start = date.today()
    pin(monkeypatch, datetime(sprint_start.year, sprint_start.month, sprint_start.day, 12,
                              tzinfo=timezone.utc) + timedelta(days=2))
    practice = client.get("/api/v1/traits").data[0]["practices"][0]["id"]
    client.post(f"/api/v1/practices/{practice}/logs", {"done": True}, format="json")

    d = client.get("/api/v1/dashboard").data
    assert d["day_number"] == 3 and d["total_days"] == 90 and d["sprint_percent"] == 3
    assert d["alter_ego_name"] == "The Operator"
    assert [layer["id"] for layer in d["layers"]] == [
        "identity", "character", "knowledge", "mission", "daily_os", "presence", "legacy"]
    assert d["layers"][0]["progress"] == 100 and d["layers"][0]["status"] == "locked_in"
    assert len(d["weekly_momentum"]) == 7
    assert {k["id"] for k in d["key_results"]} == {"tasks", "practices", "reading"}
    assert d["stats"]["practices_done"] == 1 and d["stats"]["longest_streak"] >= 1
    assert d["priority_task"] is not None and d["personality_completed"] is False


# --- settings, export, reset ------------------------------------------------------------


def test_preferences_and_analytics_opt_in_are_exposed(auth_client):
    me = auth_client.get("/api/v1/me").data
    assert me["mentor_nudges"] is True and me["analytics_opt_in"] is True
    auth_client.patch("/api/v1/me", {"mentor_nudges": False, "weekly_digest": False}, format="json")
    me = auth_client.get("/api/v1/me").data
    assert me["mentor_nudges"] is False and me["weekly_digest"] is False

    auth_client.post("/api/v1/me/consents",
                     {"purpose": "analytics", "version": "2", "granted": False}, format="json")
    assert auth_client.get("/api/v1/me").data["analytics_opt_in"] is False
    assert ConsentLedger.objects.filter(purpose="analytics").count() == 2


def test_identity_can_be_edited_directly_without_a_model(ready):
    client, protocol = ready
    res = client.patch("/api/v1/me/identity", {
        "alter_ego_name": "The Quiet Architect",
        "identity_statement": "I build calm systems and review them weekly."}, format="json")
    assert res.status_code == 200 and res.data["me"]["alter_ego_name"] == "The Quiet Architect"
    assert client.get("/api/v1/me").data["identity_statement"].startswith("I build calm systems")
    sec = ProtocolSection.objects.filter(protocol=protocol, key="identity").order_by("-revision").first()
    assert sec.revision == 2 and sec.model == "user" and sec.prompt_version == "manual"

    banned = client.patch("/api/v1/me/identity",
                          {"identity_statement": "This will guarantee my success."}, format="json")
    assert banned.status_code == 409
    flagged = client.patch("/api/v1/me/identity",
                           {"identity_statement": "I feel worthless."}, format="json")
    assert flagged.data["safety"]["category"] == "distress" and flagged.data["me"] is None
    assert SafetyEvent.objects.filter(surface="identity_edit").count() == 1


def test_export_contains_decrypted_user_data(ready):
    client, _ = ready
    client.post("/api/v1/reflections", {"answers": {"compounded": "Shipped the fix."}}, format="json")
    client.post("/api/v1/knowledge/notes", {"title": "T", "body": "Body text"}, format="json")
    res = client.get("/api/v1/me/export")
    assert res.status_code == 200
    assert "attachment" in res["Content-Disposition"]
    data = json.loads(res.content)
    assert data["account"]["email"] == "ada@example.com"
    assert data["protocols"][0]["document"]["schema_version"] == "2.0.0"
    assert data["reflections"][0]["answers"]["compounded"] == "Shipped the fix."
    assert data["knowledge"]["notes"][0]["body"] == "Body text"
    assert len(data["interviews"][0]["answers"]) == 8
    assert "password" not in json.dumps(data).lower()


def test_reset_requires_confirmation_and_clears_the_protocol(ready):
    client, _ = ready
    assert client.post("/api/v1/me/reset", {"confirm": False}, format="json").status_code == 400
    assert client.get("/api/v1/daily/brief").status_code == 200
    client.post("/api/v1/reflections", {"answers": {"compounded": "Kept."}}, format="json")

    res = client.post("/api/v1/me/reset", {"confirm": True}, format="json")
    assert res.status_code == 200 and res.data["protocols"] == 1
    assert Protocol.objects.count() == 0
    assert client.get("/api/v1/daily/brief").status_code == 404
    # The user's reflections survive a protocol reset.
    assert client.get("/api/v1/reflections").data["reflection"]["answers"]["compounded"] == "Kept."
    # And they can begin again.
    assert client.post("/api/v1/interviews").status_code == 201


def test_alpha_grant_full_tier(register, settings):
    settings.ALPHA_GRANT_FULL = True
    res = register("alpha@example.com")
    assert res.data["user"]["tier"] == "full"
    assert "legacy" in res.data["user"]["entitlements"]
    settings.ALPHA_GRANT_FULL = False
    assert register("core@example.com").data["user"]["tier"] == "core"


def test_practice_streak_unaffected_by_reset(ready):
    client, _ = ready
    user = User.objects.get()
    practice = client.get("/api/v1/traits").data[0]["practices"][0]["id"]
    PracticeLog.objects.create(practice_id=practice, user=user, date=date.today(), done=True)
    client.post("/api/v1/me/reset", {"confirm": True}, format="json")
    # Logs hang off practices, which hang off the protocol; they go with it.
    assert PracticeLog.objects.count() == 0
