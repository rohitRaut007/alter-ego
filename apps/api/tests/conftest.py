import pytest
from rest_framework.test import APIClient

PASSWORD = "a-long-enough-passphrase-9"


def consents(analytics: bool = True) -> list[dict]:
    return [
        {"purpose": "terms", "version": "2026-10", "granted": True},
        {"purpose": "privacy", "version": "2026-10", "granted": True},
        {"purpose": "analytics", "version": "2026-10", "granted": analytics},
    ]


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.fixture
def register(client):
    def _register(email: str = "ada@example.com", analytics: bool = True, **extra):
        payload = {
            "email": email,
            "password": PASSWORD,
            "display_name": "Ada",
            "consents": consents(analytics),
            **extra,
        }
        return client.post("/api/v1/auth/register", payload, format="json")

    return _register


@pytest.fixture
def auth_client(register, client):
    res = register()
    assert res.status_code == 201
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return client
