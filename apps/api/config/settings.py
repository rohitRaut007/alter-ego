from datetime import timedelta
from pathlib import Path

import dj_database_url

from .env import env

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = env.django_secret_key
DEBUG = env.django_debug
ALLOWED_HOSTS = env.allowed_hosts

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
    "core",
    "accounts",
    "billing",
    "analytics",
    "mentor",
    "safety",
    "protocol",
    "character",
    "daily_os",
    "knowledge",
    "legacy",
    "personality",
    "calendars",
    "dashboard",
    "goals",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

DATABASES = {"default": dj_database_url.parse(env.database_url, conn_max_age=60)}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication"
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "auth": env.auth_throttle_rate,
        "mentor": env.mentor_throttle_rate,
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.jwt_access_minutes),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.jwt_refresh_days),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Alter Ego OS API",
    "DESCRIPTION": "Contract between the Django API and the web and mobile clients.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    # Same-named fields with different choice sets would otherwise get hash-suffixed names.
    "ENUM_NAME_OVERRIDES": {
        "ProtocolStatusEnum": "config.enums.PROTOCOL_STATUS",
        "ThreadStatusEnum": "config.enums.THREAD_STATUS",
        "ChallengeStatusEnum": "config.enums.CHALLENGE_STATUS",
        "ReadingStatusEnum": "config.enums.READING_STATUS",
        "NudgeKindEnum": "config.enums.NUDGE_KIND",
        "ThreadKindEnum": "config.enums.THREAD_KIND",
        "FactKindEnum": "config.enums.FACT_KIND",
        "NoteKindEnum": "config.enums.NOTE_KIND",
        "RecommendationKindEnum": "knowledge.views.RECOMMENDATION_KINDS",
        "LayerEnum": "daily_os.serializers.LAYERS",
        "ToneEnum": "daily_os.serializers.TONES",
        "HorizonEnum": "config.enums.HORIZON",
    },
}

CORS_ALLOWED_ORIGINS = env.cors_origins

FIELD_ENCRYPTION_KEYS = env.encryption_keys
LLM_PROVIDER = env.llm_provider
FAKE_LLM_DELAY_MS = env.fake_llm_delay_ms
ANTHROPIC_MODEL = env.anthropic_model  # read by the real provider; never hardcoded
SSE_POLL_SECONDS = env.sse_poll_seconds
MENTOR_PERSONA_NAME = env.mentor_persona_name
ALPHA_GRANT_FULL = env.alpha_grant_full

CELERY_BROKER_URL = env.redis_url or "memory://"
CELERY_TASK_ALWAYS_EAGER = not env.redis_url

if env.redis_url:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": env.redis_url,
        }
    }

if env.django_force_https and not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "config.logging.JsonFormatter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}

if env.sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(dsn=env.sentry_dsn, send_default_pii=False, traces_sample_rate=0.0)
