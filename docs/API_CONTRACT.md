# API contract: P0 flows

Base path `/api/v1`. JSON, `snake_case`. Auth: `Authorization: Bearer <access>`. Errors: `{ "error": { "code", "message", "fields"? } }`. The generated OpenAPI (`/api/schema/`) is authoritative; this file describes intent and flows.

## Auth (accounts)
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | email, password, display_name, timezone, consents[] |
| POST | `/auth/token` | email, password → access, refresh |
| POST | `/auth/token/refresh` | rotating refresh |
| POST | `/auth/logout` | blacklist refresh |
| GET/PATCH | `/me` | profile, `entitlements[]`, `ai_training_opt_out` |
| GET/POST | `/me/consents` | ledger read, append |
| POST | `/me/export` → 202 | async JSON export; `GET /me/export/{id}` |
| DELETE | `/me` | hard delete (requires password) |

## Onboarding and protocol
| Method | Path | Notes |
|---|---|---|
| POST | `/interviews` | start; returns first question |
| POST | `/interviews/{id}/turns` | `{answer}` → `{question, progress, done}`; 409 if safety paused |
| POST | `/interviews/{id}/complete` | → 202 `{protocol_id}` |
| GET | `/protocols/{id}` | status + sections ready so far |
| GET | `/protocols/{id}/events` | SSE: `progress`, `section.ready{key}`, `done`, `error` |
| POST | `/protocols/{id}/sections/{key}/revise` | `{instruction}` → new section revision |
| POST | `/protocols/{id}/rating` | `{score 1-5, comment?}` |
| GET | `/protocols/{id}/pdf` | PDF stream |

## Daily OS
| Method | Path | Notes |
|---|---|---|
| GET | `/daily/brief?date=` | morning brief: priorities, sprint progress, mentor note |
| GET | `/tasks?from=&to=&layer=` | |
| PATCH | `/tasks/{id}` | `{done: bool}`; idempotent with `client_op_id` |
| GET | `/sprints/current` | weeks, completion by layer |
| POST | `/deep-work/sessions` · PATCH `/{id}` | start, end |
| POST | `/reflections` | 3 answers; safety screened |
| GET/POST | `/weekly-ritual` | Sunday ritual |

## Character
| Method | Path | Notes |
|---|---|---|
| GET | `/traits` | with practices and streaks |
| POST | `/practices/{id}/logs` | `{date, done}` |
| POST | `/traits/{id}/ratings` | `{day_offset, score}` |
| POST | `/traits/{id}/reflections` | monthly |

## Knowledge (Alpha slice)
| Method | Path | Notes |
|---|---|---|
| GET | `/reading-items` | sequence + rationale |
| PATCH | `/reading-items/{id}` | status |
| GET/PUT | `/reading-items/{id}/notes` | |

## Mentor (Phase 4)
| Method | Path | Notes |
|---|---|---|
| GET | `/mentor/threads` | |
| POST | `/mentor/threads/{id}/messages` | streamed (SSE) reply; `Idempotency-Key` header |
| GET | `/mentor/memory` · DELETE `/{id}` | user can view and delete facts |

## Cross-cutting
- Pagination: `?cursor=&limit=`; responses `{results, next}`.
- Idempotency: write endpoints accept `Idempotency-Key` or `client_op_id` (offline outbox).
- Rate limits: auth 5/min per IP; mentor 30 messages/hour per user (tunable).
- Feature gating: 403 `{code: "entitlement_required", feature}`.
- Safety: 200 with `{safety: {paused: true, message, resources[]}}` instead of a coaching reply.
- Versioning: breaking changes under `/api/v2`; additive changes are non-breaking.
- Contract tests: schema snapshot test in API repo, generated-client typecheck, MSW-based client tests in `packages/api-client`.
