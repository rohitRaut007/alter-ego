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

## Phase 2 as built
Added to the contract above: `GET /interviews/current` (resume), `GET /protocols/latest`. `POST /interviews` returns 201 and resumes an open interview instead of creating a second one. `POST /interviews/{id}/turns` returns `{question | null, acknowledgement, progress, done}`; `POST /interviews/{id}/complete` returns 202 and is idempotent. `POST /protocols/{id}/sections/{key}/revise` returns the new revision, 409 for unknown sections or protocols that are not ready, and 422 when the revised output fails validation after retries. `POST /protocols/{id}/rating` returns 204. Interview and protocol endpoints require the `protocol` entitlement (403 `entitlement_required`). The OpenAPI file is the authority; the typed client is generated from it.

## Phase 3 as built
Entitlement `daily_os` gates `/daily/*`, `/sprints/*`, `/tasks*`, `/reflections`, `/deep-work/*`, `/weekly-ritual`; `character` gates `/traits*` and `/practices/*`. All return 404 `{detail}` until a protocol is ready. Dates are the user's local date (profile timezone).

| Method | Path | Notes |
|---|---|---|
| GET | `/daily/brief?date=` | Tone, headline, factual week insight, focus tasks, practices, schedule, deep work minutes, ritual state |
| GET | `/sprints/current` | Weeks with tasks and progress, 30-day checklist, day number |
| GET | `/tasks?from=&to=&layer=&done=` | Active tasks |
| PATCH | `/tasks/{id}` | `{done}`; idempotent |
| POST | `/practices/{id}/logs` | `{date?, done}`; today or yesterday only |
| GET | `/traits` | Practices with streak, 14-day history, ratings, `rating_due_offset`, monthly reflection state |
| POST | `/traits/{id}/ratings` | `{day_offset: 0|14|30, score 1-5, note?}`; 409 if already recorded |
| POST | `/traits/{id}/reflections` | `{text}`; one per trait per month, upsert |
| GET/POST | `/reflections` | Three evening questions plus optional rating; today or yesterday |
| POST | `/deep-work/sessions` | `{planned_minutes 5-240, task_id?}`; 409 when one is running |
| GET | `/deep-work/sessions/active` | 404 when none |
| PATCH | `/deep-work/sessions/{id}` | `{action: end|abandon}` |
| GET/POST | `/weekly-ritual` | Opens Sunday 17:00 local, stays open through Wednesday; 409 outside the window |

**Safety:** every endpoint that accepts free text may return HTTP 200 with `safety: {paused, category, message, resources[]}` instead of the normal result, and in that case nothing was stored for coaching. Changed in this phase: `POST /protocols/{id}/sections/{key}/revise` now returns `{section, safety}`, `POST /protocols/{id}/rating` returns `{safety}`, and interview turns include `safety`.

## Phase 4 and legacy-feature endpoints as built
| Area | Endpoints |
|---|---|
| Mentor | `GET/POST /mentor/threads`, `GET/DELETE /mentor/threads/{id}`, `POST /mentor/threads/{id}/messages` (SSE; JSON with `safety` when the boundary triggers; `stream:false` for JSON), `POST /mentor/threads/{id}/resume`, `GET /mentor/memory`, `DELETE /mentor/memory/{id}`, `GET /mentor/nudges`, `POST /mentor/nudges/{id}/read`, `GET /mentor/challenges`, `POST /mentor/challenges/{id}/accept|dismiss`, `GET /mentor/prompts` |
| Daily OS additions | `POST /tasks/new`, `DELETE /tasks/{id}` (user-added only); tasks now carry `block` |
| Knowledge | `GET /knowledge/library`, `PATCH /knowledge/items/{id}`, `GET/POST /knowledge/notes`, `DELETE /knowledge/notes/{id}`, `POST /knowledge/advisor` |
| Legacy | `GET /legacy/timeline`, `POST /legacy/milestones`, `PATCH/DELETE /legacy/milestones/{id}`, `POST /legacy/reviews`, `POST /legacy/reviews/{id}/complete` |
| Personality | `GET /personality/questions`, `GET/POST /personality` |
| Calendar | `GET/POST/DELETE /calendar`, `POST /calendar/sync`, `GET /calendar/events` (demo mode is reported in the response) |
| Dashboard | `GET /dashboard` |
| Settings | `PATCH /me` (preferences), `PATCH /me/identity`, `GET /me/export`, `POST /me/reset` |

Rate limit: mentor messages 30 per hour per user (`MENTOR_THROTTLE_RATE`). Entitlements: `mentor`, `knowledge`, `legacy` (Full), `calendar` (Full).
