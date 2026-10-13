from datetime import timedelta

import pytest

from accounts.models import User
from analytics.models import EventName, EventOutbox
from character.models import PracticeLog, TraitRating, TraitReflection
from core import clock
from daily_os.models import Sprint
from protocol.models import Protocol
from tests.test_daily_os import at_day, pin
from tests.test_protocol_flow import generate_protocol

pytestmark = pytest.mark.django_db


@pytest.fixture
def ready(auth_client):
    pid = generate_protocol(auth_client)
    return auth_client, Protocol.objects.get(pk=pid), Sprint.objects.get(protocol_id=pid)


def first_practice(client):
    trait = client.get("/api/v1/traits").data[0]
    return trait, trait["practices"][0]


def test_log_practice_builds_a_streak_and_tracks_once(ready):
    client, _, _ = ready
    _, practice = first_practice(client)
    url = f"/api/v1/practices/{practice['id']}/logs"

    assert client.post(url, {"done": True}, format="json").data["done"] is True
    client.post(url, {"done": True}, format="json")  # idempotent
    assert PracticeLog.objects.count() == 1
    assert EventOutbox.objects.filter(name=EventName.PRACTICE_COMPLETED).count() == 1

    today = clock.local_today(User.objects.get())
    yesterday = (today - timedelta(days=1)).isoformat()
    client.post(url, {"done": True, "date": yesterday}, format="json")

    trait, got = first_practice(client)
    assert got["done_today"] is True and got["streak"] == 2 and got["best_streak"] == 2
    assert trait["streak"] == 2
    assert got["history"][-1] is True and got["history"][-2] is True
    assert len(got["history"]) == 14


def test_undo_and_date_window(ready):
    client, _, _ = ready
    _, practice = first_practice(client)
    url = f"/api/v1/practices/{practice['id']}/logs"
    client.post(url, {"done": True}, format="json")
    client.post(url, {"done": False}, format="json")
    assert first_practice(client)[1]["done_today"] is False

    too_old = (clock.local_today(User.objects.get()) - timedelta(days=3)).isoformat()
    assert client.post(url, {"done": True, "date": too_old}, format="json").status_code == 409
    future = (clock.local_today(User.objects.get()) + timedelta(days=1)).isoformat()
    assert client.post(url, {"done": True, "date": future}, format="json").status_code == 409


def test_other_users_practices_are_invisible(ready, register, client):
    _, practice = first_practice(ready[0])
    other = register("other@example.com")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {other.data['access']}")
    res = client.post(f"/api/v1/practices/{practice['id']}/logs", {"done": True}, format="json")
    assert res.status_code == 404
    assert client.get("/api/v1/traits").status_code == 404  # no protocol yet


def test_rating_schedule_follows_the_sprint(ready, monkeypatch):
    client, _, sprint = ready
    pin(monkeypatch, at_day(sprint, 0))
    trait = client.get("/api/v1/traits").data[0]
    assert trait["rating_due_offset"] == 0

    res = client.post(f"/api/v1/traits/{trait['id']}/ratings",
                      {"day_offset": 0, "score": 2}, format="json")
    assert res.status_code == 200 and res.data["rating"] == {"day_offset": 0, "score": 2}
    assert client.post(f"/api/v1/traits/{trait['id']}/ratings",
                       {"day_offset": 0, "score": 3}, format="json").status_code == 409
    assert client.get("/api/v1/traits").data[0]["rating_due_offset"] is None

    pin(monkeypatch, at_day(sprint, 14))
    assert client.get("/api/v1/traits").data[0]["rating_due_offset"] == 14
    pin(monkeypatch, at_day(sprint, 30))
    assert client.get("/api/v1/traits").data[0]["rating_due_offset"] == 14  # earliest unrated
    client.post(f"/api/v1/traits/{trait['id']}/ratings", {"day_offset": 14, "score": 3},
                format="json")
    assert client.get("/api/v1/traits").data[0]["rating_due_offset"] == 30

    ev = EventOutbox.objects.filter(name=EventName.TRAIT_RATING_SUBMITTED).first()
    assert ev.props == {"day": 0, "score": 2}


def test_rating_validation(ready):
    client, _, _ = ready
    trait = client.get("/api/v1/traits").data[0]
    for body in ({"day_offset": 7, "score": 3}, {"day_offset": 0, "score": 9}):
        res = client.post(f"/api/v1/traits/{trait['id']}/ratings", body, format="json")
        assert res.status_code == 400


def test_flagged_rating_note_is_dropped_but_score_is_kept(ready):
    client, _, _ = ready
    trait = client.get("/api/v1/traits").data[0]
    res = client.post(
        f"/api/v1/traits/{trait['id']}/ratings",
        {"day_offset": 0, "score": 1, "note": "I feel worthless about this."},
        format="json",
    )
    assert res.data["safety"]["category"] == "distress" and res.data["rating"]["score"] == 1
    assert TraitRating.objects.get().note is None


def test_monthly_reflection_upserts_and_screens(ready):
    client, _, _ = ready
    trait = client.get("/api/v1/traits").data[0]
    url = f"/api/v1/traits/{trait['id']}/reflections"
    assert client.post(url, {"text": "I stopped early twice."}, format="json").data["saved"] is True
    client.post(url, {"text": "Revised: I stopped early once."}, format="json")
    assert TraitReflection.objects.count() == 1
    assert client.get("/api/v1/traits").data[0]["reflection_done_this_month"] is True

    flagged = client.post(url, {"text": "I want to hurt myself."}, format="json")
    assert flagged.data["saved"] is False and flagged.data["safety"]["category"] == "crisis"
    assert "stopped early once" in TraitReflection.objects.get().text


def test_character_requires_the_entitlement(ready):
    from billing.models import Subscription

    client, _, _ = ready
    Subscription.objects.filter(user=User.objects.get()).update(status="canceled")
    res = client.get("/api/v1/traits")
    assert res.status_code == 403 and res.data["feature"] == "character"
