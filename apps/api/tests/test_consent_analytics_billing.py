import pytest
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from accounts.models import ConsentLedger, User, has_consent
from analytics.models import EventName, EventOutbox
from analytics.services import track
from billing.models import Subscription, Tier
from billing.permissions import HasFeature

pytestmark = pytest.mark.django_db


def make_user(email="u@example.com") -> User:
    return User.objects.create_user(email=email, password="x" * 12)


# --- consent ledger ---------------------------------------------------------


def test_consent_ledger_is_append_only():
    user = make_user()
    row = ConsentLedger.objects.create(user=user, purpose="analytics", version="1", granted=True)
    row.granted = False
    with pytest.raises(PermissionError):
        row.save()
    with pytest.raises(PermissionError):
        row.delete()
    with pytest.raises(PermissionError):
        ConsentLedger.objects.filter(user=user).update(granted=False)
    with pytest.raises(PermissionError):
        ConsentLedger.objects.filter(user=user).delete()


def test_latest_consent_wins(auth_client):
    user = User.objects.get()
    assert has_consent(user, "analytics") is True
    res = auth_client.post(
        "/api/v1/me/consents",
        {"purpose": "analytics", "version": "2026-11", "granted": False},
        format="json",
    )
    assert res.status_code == 201
    assert has_consent(user, "analytics") is False
    # History is kept.
    assert ConsentLedger.objects.filter(user=user, purpose="analytics").count() == 2


# --- analytics --------------------------------------------------------------


def test_register_emits_account_created_when_analytics_consented(register):
    register(analytics=True)
    assert EventOutbox.objects.filter(name=EventName.ACCOUNT_CREATED).count() == 1


def test_no_events_without_analytics_consent(register):
    register(analytics=False)
    assert EventOutbox.objects.count() == 0


def test_track_rejects_free_text_and_bad_names():
    user = make_user()
    ConsentLedger.objects.create(user=user, purpose="analytics", version="1", granted=True)
    with pytest.raises(ValueError):
        track(user, EventName.TASK_COMPLETED, {"note": "I felt anxious about my father today"})
    with pytest.raises(ValueError):
        track(user, "not_an_event")
    ok = track(user, EventName.TASK_COMPLETED, {"layer": "knowledge", "minutes": 25})
    assert ok is not None


def test_events_are_anonymised_when_user_is_deleted():
    user = make_user()
    ConsentLedger.objects.create(user=user, purpose="analytics", version="1", granted=True)
    track(user, EventName.SESSION_ACTIVE)
    user.delete()
    assert EventOutbox.objects.get().user is None


# --- entitlements -----------------------------------------------------------


def _presence_view():
    class PresenceView(APIView):
        permission_classes = [IsAuthenticated, HasFeature("presence")]

        def get(self, request):
            return Response({"ok": True})

    return PresenceView.as_view()


def test_core_user_is_blocked_from_full_feature():
    user = make_user()
    req = APIRequestFactory().get("/x")
    force_authenticate(req, user=user)
    res = _presence_view()(req)
    assert res.status_code == 403
    assert res.data["code"] == "entitlement_required"
    assert res.data["feature"] == "presence"


def test_full_tier_unlocks_feature_and_canceled_removes_everything():
    user = make_user()
    Subscription.objects.filter(user=user).update(tier=Tier.FULL)
    req = APIRequestFactory().get("/x")
    force_authenticate(req, user=User.objects.get(pk=user.pk))
    assert _presence_view()(req).status_code == 200

    Subscription.objects.filter(user=user).update(status="canceled")
    force_authenticate(req, user=User.objects.get(pk=user.pk))
    assert _presence_view()(req).status_code == 403


def test_unknown_feature_key_fails_fast():
    with pytest.raises(ValueError):
        HasFeature("teleportation")
