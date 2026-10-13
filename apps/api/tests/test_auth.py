import pytest
from rest_framework.test import APIClient

from accounts.models import User
from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db


def test_register_returns_tokens_and_core_entitlements(register):
    res = register()
    assert res.status_code == 201
    assert res.data["access"] and res.data["refresh"]
    user = res.data["user"]
    assert user["email"] == "ada@example.com"
    assert user["tier"] == "core"
    assert "protocol" in user["entitlements"]
    assert "presence" not in user["entitlements"]
    assert user["ai_training_opt_out"] is True


def test_register_requires_terms_and_privacy(client):
    res = client.post(
        "/api/v1/auth/register",
        {
            "email": "x@example.com",
            "password": PASSWORD,
            "consents": [{"purpose": "terms", "version": "1", "granted": True}],
        },
        format="json",
    )
    assert res.status_code == 400
    assert "consents" in res.data


def test_register_rejects_duplicate_email_case_insensitively(register):
    assert register("Ada@Example.com").status_code == 201
    assert register("ada@example.com").status_code == 400


def test_register_rejects_weak_password(client):
    res = client.post(
        "/api/v1/auth/register",
        {"email": "w@example.com", "password": "password", "consents": []},
        format="json",
    )
    assert res.status_code == 400


def test_login_refresh_rotates_and_logout_blacklists(register, client):
    register()
    login = client.post(
        "/api/v1/auth/token", {"email": "ada@example.com", "password": PASSWORD}, format="json"
    )
    assert login.status_code == 200
    refresh = login.data["refresh"]

    rotated = client.post("/api/v1/auth/token/refresh", {"refresh": refresh}, format="json")
    assert rotated.status_code == 200
    # Old refresh token is blacklisted after rotation.
    reuse = client.post("/api/v1/auth/token/refresh", {"refresh": refresh}, format="json")
    assert reuse.status_code == 401

    new_refresh = rotated.data["refresh"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {rotated.data['access']}")
    out = client.post("/api/v1/auth/logout", {"refresh": new_refresh}, format="json")
    assert out.status_code == 204
    after = client.post("/api/v1/auth/token/refresh", {"refresh": new_refresh}, format="json")
    assert after.status_code == 401


def test_login_wrong_password(register, client):
    register()
    res = client.post(
        "/api/v1/auth/token", {"email": "ada@example.com", "password": "nope"}, format="json"
    )
    assert res.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/v1/me").status_code == 401


def test_me_get_and_patch(auth_client):
    res = auth_client.patch(
        "/api/v1/me", {"display_name": "Ada L", "timezone": "Asia/Kolkata"}, format="json"
    )
    assert res.status_code == 200
    assert res.data["display_name"] == "Ada L"
    # Read-only fields are ignored.
    res = auth_client.patch("/api/v1/me", {"email": "evil@example.com"}, format="json")
    assert res.data["email"] == "ada@example.com"


def test_delete_account_requires_password_and_hard_deletes(auth_client):
    bad = auth_client.delete("/api/v1/me", {"password": "wrong"}, format="json")
    assert bad.status_code == 400
    assert User.objects.count() == 1
    ok = auth_client.delete("/api/v1/me", {"password": PASSWORD}, format="json")
    assert ok.status_code == 204
    assert User.objects.count() == 0


def test_users_cannot_read_each_others_consents(register):
    register("a@example.com")
    b = APIClient()
    res = b.post(
        "/api/v1/auth/register",
        {
            "email": "b@example.com",
            "password": PASSWORD,
            "consents": [
                {"purpose": "terms", "version": "1", "granted": True},
                {"purpose": "privacy", "version": "1", "granted": True},
            ],
        },
        format="json",
    )
    b.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    rows = b.get("/api/v1/me/consents").data
    assert len(rows) == 2
