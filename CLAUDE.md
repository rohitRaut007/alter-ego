# Alter Ego OS

AI-powered personal transformation platform. Product source of truth: `docs/PRD.md`. Reconciliations: `docs/PRD_GAPS.md`. Design: `docs/ARCHITECTURE.md`.

## Stack (decided; changing requires an ADR)
- Monorepo: pnpm workspaces + Turborepo. One lockfile: `pnpm-lock.yaml`. No `package-lock.json`, no `bun.lock`.
- `apps/web`: Vite + React + TypeScript + Tailwind, React Router, TanStack Query
- `apps/mobile`: Expo (React Native) + TypeScript + NativeWind, Expo Router, TanStack Query
- `apps/api`: Django + DRF, Postgres (pgvector), SimpleJWT, Celery + Redis, ASGI + SSE, drf-spectacular
- `packages/api-client` (generated from OpenAPI), `packages/validation` (zod), `packages/ui-tokens`
- `infra/`: docker-compose (api, postgres, redis), Dockerfiles, GitHub Actions
- Django is the only auth and data backend. No Supabase client in any app.

## Commands
| Task | Command |
|---|---|
| Install JS deps | `pnpm install` |
| API venv (once) | `cd apps/api && python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt` (Windows) |
| Whole stack | `docker compose -f infra/docker-compose.yml up --build` |
| Web dev | `pnpm --filter web dev` (needs `apps/web/.env` from `.env.example`) |
| API dev | `cd apps/api && python manage.py migrate && python manage.py runserver` (env from root `.env`) |
| Regenerate OpenAPI + client | `pnpm gen:api` (CI fails if this leaves a diff) |
| Re-export protocol contract | `cd apps/api && python manage.py export_protocol_contract` (a test fails on drift) |
| Typecheck / lint / test / build | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` |
| API tests | `cd apps/api && .venv/Scripts/python -m pytest` (sqlite default; set `DATABASE_URL` for Postgres) |

`apps/mobile` does not exist yet; it is scaffolded in Phase 6 (one Expo codebase, iOS and Android together).

## Folder map
```
apps/web        React web app (primary)
apps/mobile     Expo app (one codebase, iOS and Android together)
apps/api        Django project; one Django app per domain:
                accounts protocol daily_os character knowledge presence legacy mentor billing analytics
packages/api-client  generated; never hand-edit
packages/validation  zod mirrors of the protocol schema and shared payloads
packages/ui-tokens   colors, spacing, type scale for Tailwind and NativeWind
infra/          docker, CI
docs/           PRD, ADRs, architecture, contracts
```

## Conventions
- Web and mobile reach the API only through `packages/api-client`.
- Feature-first in apps: thin route files, logic in `features/<domain>`; features never import sibling features (pattern from Scrap-it mobile).
- Named exports; semantic Tailwind classes (`bg-background`, `text-muted-foreground`), no raw hex in JSX.
- Light theme only. No dark variants.
- All LLM calls go through `apps/api/mentor/llm` (one interface). Model ID from env, never hardcoded. Prompts are versioned files.
- Copy never promises outcomes. Frame as system and discipline.
- Branches `type/scope-desc`; Conventional Commits `type(scope): summary`; scopes: `web mobile api shared infra docs`. Trunk-based, PR per change.

## Secrets rule
- Never commit `.env*` (other than `.env.example` with placeholders), keys, tokens, dumps, or credentials.
- Never copy secrets, `.env` files, or `supabase/` from the legacy repo or Scrap-it-.
- Config via validated environment variables; the app fails fast on missing config.
- No sensitive user content in logs, Sentry events, or analytics properties.

## Definition of done
1. Typecheck, lint, tests pass locally and in CI.
2. Backend logic, protocol schema validation, and api-client contract have tests.
3. OpenAPI regenerated and client up to date.
4. Loading, empty, success and error states exist for every new screen.
5. Docs updated (ADR if a decision changed; API_CONTRACT or PROTOCOL_SCHEMA if a contract changed).
6. No new dependency that is unused.
7. After each deliverable: state what exists, what is stubbed, what is next.
