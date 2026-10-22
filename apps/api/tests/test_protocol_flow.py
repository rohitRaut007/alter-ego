import json

import pytest
from asgiref.sync import async_to_sync
from django.db import connection

from accounts.models import User
from analytics.models import EventName, EventOutbox
from billing.models import Subscription
from mentor.models import LLMUsage
from protocol.models import (
    Interview,
    InterviewStatus,
    Protocol,
    ProtocolEvent,
    ProtocolSection,
    ProtocolStatus,
)
from protocol.schema.v2 import SECTION_KEYS

pytestmark = pytest.mark.django_db

ANSWERS = [
    "I want to become a founder who actually ships a product people pay for.",
    "Developer tools for small teams, specifically a deployment dashboard.",
    "Strong engineering, six months of savings, a small network, a day job.",
    "Deep morning blocks, and I lose focus when messages pile up.",
    "I start projects and abandon them when they get hard.",
    "That I stay a person with a lot of potential and nothing to show.",
    "A product with 50 paying customers and a recurring revenue number I can check.",
    "Two hours a day, and I want visible change within 90 days.",
]


def read_stream(response) -> str:
    """Drain an async StreamingHttpResponse from sync test code."""

    async def collect() -> bytes:
        return b"".join([chunk async for chunk in response.streaming_content])

    return async_to_sync(collect)().decode()


def run_interview(client) -> tuple[str, dict]:
    res = client.post("/api/v1/interviews")
    assert res.status_code == 201, res.data
    iid = res.data["interview_id"]
    assert res.data["question"]["idx"] == 0
    step = res.data
    for answer in ANSWERS:
        res = client.post(f"/api/v1/interviews/{iid}/turns", {"answer": answer}, format="json")
        assert res.status_code == 200, res.data
        step = res.data
    return iid, step


def generate_protocol(client) -> str:
    iid, step = run_interview(client)
    assert step["done"] is True and step["question"] is None
    res = client.post(f"/api/v1/interviews/{iid}/complete")
    assert res.status_code == 202, res.data
    return res.data["protocol_id"]


def test_full_flow_produces_valid_personalised_protocol(auth_client):
    iid, step = run_interview(auth_client)
    assert step["progress"] == 1.0 and step["answered_count"] == len(ANSWERS)

    res = auth_client.post(f"/api/v1/interviews/{iid}/complete")
    assert res.status_code == 202
    pid = res.data["protocol_id"]

    detail = auth_client.get(f"/api/v1/protocols/{pid}")
    assert detail.status_code == 200
    assert detail.data["status"] == "ready"
    assert [s["key"] for s in detail.data["sections"]] == sorted(SECTION_KEYS)
    doc = detail.data["document"]
    assert doc["schema_version"] == "2.0.0"
    # Personalised from the user's own words.
    assert "ships a product" in doc["identity"]["thesis"]
    assert doc["disclaimer"]
    assert len(doc["character"]["traits"]) >= 3
    assert any(t["due_day"] == 1 for t in doc["checklist_30"])

    p = Protocol.objects.get(pk=pid)
    assert p.prompt_version == "v1" and p.model == "fake-llm-1"
    assert p.review_required is True
    assert Interview.objects.get(pk=iid).status == InterviewStatus.COMPLETED


def test_interview_resumes_instead_of_restarting(auth_client):
    first = auth_client.post("/api/v1/interviews").data
    auth_client.post(
        f"/api/v1/interviews/{first['interview_id']}/turns",
        {"answer": ANSWERS[0]},
        format="json",
    )
    again = auth_client.post("/api/v1/interviews").data
    assert again["interview_id"] == first["interview_id"]
    assert again["question"]["idx"] == 1
    current = auth_client.get("/api/v1/interviews/current").data
    assert current["question"]["idx"] == 1


def test_cannot_complete_before_interview_is_done(auth_client):
    iid = auth_client.post("/api/v1/interviews").data["interview_id"]
    res = auth_client.post(f"/api/v1/interviews/{iid}/complete")
    assert res.status_code == 409
    assert Protocol.objects.count() == 0


def test_empty_and_oversized_answers_rejected(auth_client):
    iid = auth_client.post("/api/v1/interviews").data["interview_id"]
    assert auth_client.post(f"/api/v1/interviews/{iid}/turns", {"answer": "  "},
                            format="json").status_code == 400
    assert auth_client.post(f"/api/v1/interviews/{iid}/turns", {"answer": "x" * 4001},
                            format="json").status_code == 400


def test_complete_is_idempotent(auth_client):
    iid, _ = run_interview(auth_client)
    a = auth_client.post(f"/api/v1/interviews/{iid}/complete").data["protocol_id"]
    b = auth_client.post(f"/api/v1/interviews/{iid}/complete").data["protocol_id"]
    assert a == b
    assert Protocol.objects.count() == 1
    assert ProtocolSection.objects.filter(protocol_id=a).count() == len(SECTION_KEYS)


def test_answers_and_sections_are_encrypted_at_rest(auth_client):
    pid = generate_protocol(auth_client)
    with connection.cursor() as cur:
        cur.execute("SELECT answer FROM protocol_interviewturn WHERE answer IS NOT NULL")
        raw_answers = [r[0] for r in cur.fetchall()]
        cur.execute("SELECT content FROM protocol_protocolsection")
        raw_sections = [r[0] for r in cur.fetchall()]
    assert len(raw_answers) == len(ANSWERS)
    assert all(a.startswith("v1:") for a in raw_answers)
    assert all("founder" not in a for a in raw_answers)
    assert all(c.startswith("v1:") and "ships a product" not in c for c in raw_sections)
    # And they decrypt transparently through the ORM.
    assert Interview.objects.get().turns.first().answer == ANSWERS[0]


def test_users_cannot_see_each_others_protocols(auth_client, register, client):
    pid = generate_protocol(auth_client)
    other = register("other@example.com")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {other.data['access']}")
    assert client.get(f"/api/v1/protocols/{pid}").status_code == 404
    assert client.get(f"/api/v1/protocols/{pid}/pdf").status_code == 404
    assert client.get("/api/v1/protocols/latest").status_code == 404


def test_latest_returns_most_recent(auth_client):
    pid = generate_protocol(auth_client)
    assert str(auth_client.get("/api/v1/protocols/latest").data["id"]) == str(pid)


def test_sse_replays_events_and_resumes_by_id(auth_client):
    pid = generate_protocol(auth_client)

    res = auth_client.get(f"/api/v1/protocols/{pid}/events")
    assert res.status_code == 200
    assert res["Content-Type"].startswith("text/event-stream")
    body = read_stream(res)
    assert body.count("event: section.ready") == len(SECTION_KEYS)
    assert "event: done" in body
    assert "ships a product" not in body  # events never carry section content

    events = list(ProtocolEvent.objects.filter(protocol_id=pid))
    midpoint = events[len(events) // 2].id
    res2 = auth_client.get(f"/api/v1/protocols/{pid}/events", HTTP_LAST_EVENT_ID=str(midpoint))
    resumed = read_stream(res2)
    assert f"id: {midpoint}\n" not in resumed
    assert f"id: {events[-1].id}\n" in resumed


def test_revise_changes_only_the_named_section(auth_client):
    pid = generate_protocol(auth_client)
    before = {
        s["key"]: s["revision"] for s in auth_client.get(f"/api/v1/protocols/{pid}").data["sections"]
    }
    res = auth_client.post(
        f"/api/v1/protocols/{pid}/sections/identity/revise",
        {"instruction": "Make the thesis about shipping weekly."},
        format="json",
    )
    assert res.status_code == 200, res.data
    assert res.data["safety"] is None
    assert res.data["section"]["revision"] == 2
    assert "shipping weekly" in res.data["section"]["content"]["thesis"]

    after = {
        s["key"]: s["revision"] for s in auth_client.get(f"/api/v1/protocols/{pid}").data["sections"]
    }
    assert after["identity"] == 2
    assert all(after[k] == before[k] for k in before if k != "identity")
    # History is kept.
    assert ProtocolSection.objects.filter(protocol_id=pid, key="identity").count() == 2


def test_revise_rejects_outcome_promising_language(auth_client):
    pid = generate_protocol(auth_client)
    res = auth_client.post(
        f"/api/v1/protocols/{pid}/sections/mission/revise",
        {"instruction": "Say this will guarantee my success."},
        format="json",
    )
    assert res.status_code == 422
    assert ProtocolSection.objects.filter(protocol_id=pid, key="mission").count() == 1


def test_revise_unknown_section_is_conflict(auth_client):
    pid = generate_protocol(auth_client)
    res = auth_client.post(
        f"/api/v1/protocols/{pid}/sections/nope/revise", {"instruction": "x"}, format="json"
    )
    assert res.status_code == 409


def test_rating_is_stored_and_tracked(auth_client):
    pid = generate_protocol(auth_client)
    assert auth_client.post(f"/api/v1/protocols/{pid}/rating", {"score": 9},
                            format="json").status_code == 400
    res = auth_client.post(f"/api/v1/protocols/{pid}/rating",
                           {"score": 4, "comment": "Mostly right."}, format="json")
    assert res.status_code == 200
    assert res.data["safety"] is None
    p = Protocol.objects.get(pk=pid)
    assert p.accuracy_rating == 4 and p.rating_comment == "Mostly right."
    ev = EventOutbox.objects.get(name=EventName.PROTOCOL_RATED)
    assert ev.props == {"score": 4}


def test_pdf_export(auth_client):
    pid = generate_protocol(auth_client)
    res = auth_client.get(f"/api/v1/protocols/{pid}/pdf")
    assert res.status_code == 200
    assert res["Content-Type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")
    assert len(res.content) > 5_000


def test_analytics_funnel_events(auth_client):
    generate_protocol(auth_client)
    names = set(EventOutbox.objects.values_list("name", flat=True))
    assert {"onboarding_started", "interview_completed", "protocol_generated"} <= names


def test_llm_usage_is_logged_without_content(auth_client):
    generate_protocol(auth_client)
    tasks = set(LLMUsage.objects.values_list("task", flat=True))
    assert tasks == {"interview_turn", "protocol_section"}
    assert LLMUsage.objects.filter(task="protocol_section").count() == len(SECTION_KEYS)
    row = LLMUsage.objects.first()
    assert row.input_tokens > 0 and row.output_tokens > 0 and row.prompt_version == "v1"
    assert LLMUsage.objects.model._meta.get_fields()  # no content columns
    assert {f.name for f in LLMUsage._meta.get_fields()} >= {"task", "model", "input_tokens"}


def test_feature_gate_blocks_inactive_subscription(auth_client):
    Subscription.objects.filter(user=User.objects.get()).update(status="canceled")
    res = auth_client.post("/api/v1/interviews")
    assert res.status_code == 403
    assert res.data["code"] == "entitlement_required"
    assert res.data["feature"] == "protocol"


def test_requires_authentication(client):
    assert client.post("/api/v1/interviews").status_code == 401
    assert client.get("/api/v1/protocols/latest").status_code == 401


def test_event_log_contains_no_section_content(auth_client):
    pid = generate_protocol(auth_client)
    blob = json.dumps(list(ProtocolEvent.objects.filter(protocol_id=pid).values_list("data", flat=True)))
    assert "ships a product" not in blob
    assert Protocol.objects.get(pk=pid).status == ProtocolStatus.READY
