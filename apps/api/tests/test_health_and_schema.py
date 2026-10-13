import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db


def test_healthz(client):
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.data == {"status": "ok"}


def test_readyz_checks_database(client):
    res = client.get("/readyz")
    assert res.status_code == 200
    assert res.data["checks"]["database"] == "ok"


def test_openapi_schema_is_valid_and_warning_free(tmp_path):
    out = tmp_path / "schema.yaml"
    call_command("spectacular", file=str(out), validate=True, fail_on_warn=True)
    text = out.read_text(encoding="utf-8")
    for path in ("/api/v1/auth/register", "/api/v1/auth/token", "/api/v1/me"):
        assert path in text
