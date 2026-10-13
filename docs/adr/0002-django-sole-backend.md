# ADR 0002: Django as the sole backend

Status: Accepted · Date: 2026-10-13

## Context
PRD §13 mentions Node.js. The owner decided on Django. The legacy frontend used Supabase Auth and edge functions, and a web-tier server function that called an LLM and read `.env` files from disk.

## Decision
- Django + DRF is the only service that holds user data, issues tokens, and calls the model provider.
- Auth: SimpleJWT (short-lived access, rotating refresh with blacklist). No Supabase client in apps. Supabase may host plain Postgres only.
- ASGI (uvicorn) for SSE; Celery + Redis for async work.
- Contract: drf-spectacular OpenAPI is the only interface clients use.

## Consequences
- One place for authorisation, encryption, consent and safety logic.
- Legacy Supabase functions and RLS are not ported; their behaviour is reimplemented and tested in Django.
- We own auth security (rate limits, lockout, password reset). Use `django-axes` or throttles; add email verification in Phase 1.
- PRD §13 should be amended.
