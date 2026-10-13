"""Validated environment configuration. The process fails fast on invalid config."""

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

    @model_validator(mode="after")
    def _no_placeholder_secret_in_production(self) -> "Env":
        if not self.django_debug and self.django_secret_key.startswith("change-me"):
            raise ValueError(
                "DJANGO_SECRET_KEY must be a real secret when DJANGO_DEBUG is false"
            )
        return self

    @staticmethod
    def _csv(value: str) -> list[str]:
        return [v.strip() for v in value.split(",") if v.strip()]

    @property
    def allowed_hosts(self) -> list[str]:
        return self._csv(self.django_allowed_hosts)

    @property
    def cors_origins(self) -> list[str]:
        return self._csv(self.cors_allowed_origins)


env = Env()  # type: ignore[call-arg]
