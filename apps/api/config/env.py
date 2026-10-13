"""Validated environment configuration. The process fails fast on invalid config."""

import base64
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_API_DIR = Path(__file__).resolve().parents[1]
_ROOT = _API_DIR.parents[1]


class Env(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT / ".env", _API_DIR / ".env"),
        extra="ignore",
    )

    django_secret_key: str = Field(min_length=16)
    django_debug: bool = False
    django_allowed_hosts: str = "localhost,127.0.0.1"
    django_force_https: bool = False
    database_url: str
    redis_url: str = ""
    cors_allowed_origins: str = ""
    sentry_dsn: str = ""
    jwt_access_minutes: int = Field(default=15, ge=1)
    jwt_refresh_days: int = Field(default=14, ge=1)
    auth_throttle_rate: str = "5/min"
    # "key_id:base64(32 bytes)" pairs, comma separated. The first key encrypts new data.
    field_encryption_keys: str = Field(min_length=1)
    llm_provider: str = "fake"
    fake_llm_delay_ms: int = Field(default=0, ge=0)
    anthropic_model: str = ""
    sse_poll_seconds: float = Field(default=0.5, ge=0)
    mentor_persona_name: str = "Mentor"
    mentor_throttle_rate: str = "30/hour"
    # Alpha invitees get the Full tier. Off by default so production stays Core.
    alpha_grant_full: bool = False

    @model_validator(mode="after")
    def _no_placeholder_secret_in_production(self) -> "Env":
        if not self.django_debug and self.django_secret_key.startswith("change-me"):
            raise ValueError(
                "DJANGO_SECRET_KEY must be a real secret when DJANGO_DEBUG is false"
            )
        return self

    @model_validator(mode="after")
    def _valid_encryption_keys(self) -> "Env":
        for pair in self._csv(self.field_encryption_keys):
            key_id, _, b64 = pair.partition(":")
            try:
                raw = base64.urlsafe_b64decode(b64.encode("ascii"))
            except Exception as exc:
                raise ValueError("FIELD_ENCRYPTION_KEYS must be key_id:base64 pairs") from exc
            if not key_id or len(raw) != 32:
                raise ValueError("Each field encryption key must be 32 bytes, base64 encoded")
        return self

    @staticmethod
    def _csv(value: str) -> list[str]:
        return [v.strip() for v in value.split(",") if v.strip()]

    @property
    def allowed_hosts(self) -> list[str]:
        return self._csv(self.django_allowed_hosts)

    @property
    def encryption_keys(self) -> list[tuple[str, bytes]]:
        out = []
        for pair in self._csv(self.field_encryption_keys):
            key_id, _, b64 = pair.partition(":")
            out.append((key_id, base64.urlsafe_b64decode(b64.encode("ascii"))))
        return out

    @property
    def cors_origins(self) -> list[str]:
        return self._csv(self.cors_allowed_origins)


env = Env()  # type: ignore[call-arg]
