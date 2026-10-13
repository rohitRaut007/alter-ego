import logging

import pytest

from accounts.models import User
from analytics.models import EventName, EventOutbox
from mentor.models import LLMUsage
from protocol.models import InterviewTurn, Protocol
from safety.classifier import KeywordClassifier
from safety.models import SafetyEvent
from safety.resources import resources_for_timezone
from tests.test_protocol_flow import ANSWERS, generate_protocol

pytestmark = pytest.mark.django_db

CRISIS_TEXT = "Honestly some days I just want to die and I cannot see the point."
DISTRESS_TEXT = "I had a panic attack again and I feel completely worthless."


@pytest.mark.parametrize(
    "text, category",
    [
        ("I want to kill myself", "crisis"),
        ("I've been thinking about suicide", "crisis"),
        ("I DON’T WANT TO LIVE anymore", "crisis"),
        ("There's no point in going on", "crisis"),
        ("I keep wanting to hurt myself", "crisis"),
        ("I'm going to end my life", "crisis"),
        ("I had a panic attack this morning", "distress"),
        ("I feel hopeless about all of it", "distress"),
        ("i hate myself for quitting again", "distress"),
        ("I am depressed and can't stop crying", "distress"),
    ],
)
def test_classifier_flags_crisis_and_distress(text, category):
    result = KeywordClassifier().classify(text)
    assert result is not None and result.category == category


@pytest.mark.parametrize(
    "text",
    [
        "I want to kill this deadline and ship on Friday.",
        "I am killing it at work lately.",
        "End this meeting early so I can do deep work.",
        "I am hopeful about the next ninety days.",
        "I plan to read the 'Man's Search for Meaning' next.",
        "",
        "   ",
    ],
)
def test_classifier_ignores_ordinary_text(text):
    assert KeywordClassifier().classify(text) is None


def test_crisis_wins_over_distress():
    text = "I feel worthless and I want to end my life."
    assert KeywordClassifier().classify(text).category == "crisis"


def test_resources_are_regional_with_a_global_fallback():
    india = {r.id for r in resources_for_timezone("Asia/Kolkata")}
    assert {"in_tele_manas", "in_kiran", "in_emergency", "global_directory"} <= india
    us = {r.id for r in resources_for_timezone("America/New_York")}
    assert "us_988" in us and "global_directory" in us
    other = {r.id for r in resources_for_timezone("Europe/Berlin")}
    assert other == {"global_directory", "global_local_emergency"}


def test_interview_answer_that_trips_the_boundary_is_not_stored_or_sent(auth_client, caplog):
    first = auth_client.post("/api/v1/interviews").data
    iid = first["interview_id"]
    usage_before = LLMUsage.objects.count()

    with caplog.at_level(logging.INFO):
        res = auth_client.post(f"/api/v1/interviews/{iid}/turns", {"answer": CRISIS_TEXT},
                               format="json")
    assert res.status_code == 200
    assert res.data["safety"]["paused"] is True
    assert res.data["safety"]["category"] == "crisis"
    assert "Coaching is paused" in res.data["safety"]["message"]
    assert res.data["safety"]["resources"]
    # The same question stays open; nothing was stored or sent to the model.
    assert res.data["question"]["idx"] == first["question"]["idx"]
    assert InterviewTurn.objects.filter(answer__isnull=False).count() == 0
    assert LLMUsage.objects.count() == usage_before

    event = SafetyEvent.objects.get()
    assert (event.surface, event.category) == ("interview", "crisis")
    # Nothing the user wrote ends up in logs, the event row, or analytics.
    assert "want to die" not in caplog.text
    assert "safety.boundary_triggered" in caplog.text or "safety boundary triggered" in caplog.text
    assert all(CRISIS_TEXT not in str(v) for v in SafetyEvent.objects.values())
    ev = EventOutbox.objects.get(name=EventName.SAFETY_BOUNDARY_TRIGGERED)
    assert ev.props == {"surface": "interview", "category": "crisis"}

    # The user can carry on with an ordinary answer afterwards.
    ok = auth_client.post(f"/api/v1/interviews/{iid}/turns", {"answer": ANSWERS[0]},
                          format="json")
    assert ok.status_code == 200 and ok.data["safety"] is None
    assert ok.data["question"]["idx"] == 1


def test_distress_gets_a_different_message(auth_client):
    iid = auth_client.post("/api/v1/interviews").data["interview_id"]
    res = auth_client.post(f"/api/v1/interviews/{iid}/turns", {"answer": DISTRESS_TEXT},
                           format="json")
    assert res.data["safety"]["category"] == "distress"
    assert "not mental health care" in res.data["safety"]["message"]


def test_notice_resources_follow_the_users_timezone(auth_client):
    User.objects.update(timezone="Asia/Kolkata")
    iid = auth_client.post("/api/v1/interviews").data["interview_id"]
    res = auth_client.post(f"/api/v1/interviews/{iid}/turns", {"answer": CRISIS_TEXT},
                           format="json")
    ids = [r["id"] for r in res.data["safety"]["resources"]]
    assert ids[:3] == ["in_tele_manas", "in_kiran", "in_emergency"]


def test_revision_instruction_that_trips_the_boundary_changes_nothing(auth_client):
    pid = generate_protocol(auth_client)
    res = auth_client.post(
        f"/api/v1/protocols/{pid}/sections/identity/revise",
        {"instruction": "Rewrite it, I feel worthless and want to disappear."},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["section"] is None
    assert res.data["safety"]["paused"] is True
    detail = auth_client.get(f"/api/v1/protocols/{pid}").data
    assert {s["key"]: s["revision"] for s in detail["sections"]}["identity"] == 1


def test_flagged_rating_comment_is_dropped_but_the_score_counts(auth_client):
    pid = generate_protocol(auth_client)
    res = auth_client.post(
        f"/api/v1/protocols/{pid}/rating",
        {"score": 2, "comment": "It felt hopeless reading this."},
        format="json",
    )
    assert res.status_code == 200 and res.data["safety"]["category"] == "distress"
    p = Protocol.objects.get(pk=pid)
    assert p.accuracy_rating == 2 and p.rating_comment is None
