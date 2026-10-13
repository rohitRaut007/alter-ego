# Roadmap

Baseline: team is **solo**; public launch **Q2 2027**; today is 13 Oct 2026. Success metrics from PRD §10.

## Feasibility verdict for the Alpha window

PRD Alpha: Oct–Dec 2026, 200 invited users, Daily OS + Character Builder + Knowledge + Calendar. Phase 0 (interview + protocol, 20 internal users) never happened. About **11 weeks** remain.

**Verdict: the PRD's Alpha scope is not feasible for one person. A thin vertical slice is.**

Why: onboarding→protocol alone (interview design, structured generation with validation, section reveal, revision, PDF, review queue) is a 4–5 week effort when done properly, and the PRD's own risk table makes protocol quality the make-or-break. Auth, infra, CI and the generated client take another 2 weeks. That leaves ~4 weeks for Daily OS, Character Builder and a basic mentor, with no buffer.

| Cut | Reason |
|---|---|
| 200 users → **20 users** by 31 Dec; widen to 200 in Jan | The PRD itself wanted 20-user validation (Phase 0) before scale. Human review of first 500 protocols is a bottleneck anyway |
| Knowledge → reading list + notes only | Retrieval, destruction tests, collision notebook, weekly recommendation are Phase 5 |
| Calendar integration → Beta | Not needed to test whether the protocol is accurate or retained |
| Proactive mentor engine → Beta | Alpha mentor is reactive chat with memory; Sunday ritual is a scheduled prompt, not a conversation engine |
| Mobile → after Alpha | Web is primary; mobile (one cross-platform Expo app) needs the store-billing decision anyway (ADR 0007) |
| Presence, Legacy, board, quarterly review → Beta | Roadmap already places them there |
| PDF export → simple HTML-to-PDF | Polished layout later |

Risks that would break even the thin slice: writing the interview/protocol prompts takes iteration time that is not engineering time; the mentor persona is undecided; safety resource list needs a human; porting legacy UI is cheaper than designing but each page still needs wiring to real data.

## Timeline (weeks from 13 Oct 2026)

| Phase | Weeks | Output |
|---|---|---|
| 1 Foundation | 1–2 (to 27 Oct) | Monorepo, Django auth, OpenAPI client, CI green, docker-compose, consent + analytics skeleton, entitlement stub |
| 2 Onboarding + protocol | 3–6 (to 24 Nov) | Interview, async generation, section reveal, revision, PDF, review queue |
| 3 Daily OS + Character | 7–9 (to 15 Dec) | Sprint/checklist, brief, timer, reflection, streaks, Sunday ritual |
| 4 Mentor (basic) | 10–11 (to 31 Dec) | Streaming chat, memory v1, safety boundary. Proactive engine deferred |
| Alpha gate | 31 Dec | 20 users, accuracy + completion measured |
| 5 Knowledge | Jan | Full curriculum (web) |
| 6 Mobile (Expo, iOS + Android) | Jan–Mar | Protocol, Daily OS, reminders, push, mentor, offline. One codebase, no per-platform staging |
| 7 Calendar | Feb–Mar | Google (server OAuth), device calendars via expo-calendar |
| 8 Later | Q2 2027 | Presence, Legacy, board, quarterly review, Notion; cohorts, voice |

## Phase acceptance criteria

| Phase | Done when | PRD metric tie |
|---|---|---|
| 1 | `docker compose up` works; register→login→`/me` through generated client on web; CI green incl. stale-client check; consent ledger and entitlement tests pass | – |
| 2 | ≥70% of 20 test users who start the interview finish and receive a protocol; protocol validates against schema in 100% of stored outputs; ≥80% rate it accurate (4–5 of 5) | Onboarding completion >70%, accuracy >80% |
| 3 | A user can see today's tasks tied to checklist and sprint, run a deep-work timer, complete 3-question reflection; streaks compute correctly; D7 retention measurable | D7 >60%, streak, sprint completion >50% |
| 4 | Mentor streams with memory across sessions; distress test set always triggers redirect; no content in logs (log audit test) | NPS collection live; D30 measurable |
| 5 | Reading list sequenced with rationale; notes and collision capture; recommendations cite curated sources | Practice/knowledge completion |
| 6 | Offline: airplane-mode completes a task, syncs on reconnect without duplicates | D30 retention |
| 7 | Google and device-calendar events created and updated idempotently | Task completion |

North star (trait or habit change within 30 days) is instrumented from Phase 3 (`trait_rating_submitted` at day 0, 14, 30).

## Gates before real users
1. Rotate the credential exposed in the legacy repo.
2. Provider DPA signed and unverified items in ADR 0006 confirmed.
3. Crisis resource list reviewed by a human.
4. Key backup and rotation runbook for field encryption.
5. Privacy notice and consent text reviewed.

## Status
- **Phase 1 Foundation: done** (auth, consent ledger, entitlements, generated client, CI).
- **Phase 2 Onboarding and protocol: built against a fake LLM.** Interview, async generation with validation and retry, SSE section reveal, per-section revision, PDF export, accuracy rating and Django-admin review queue all work end to end. Not done: a real model provider (blocked on persona and model id), the safety boundary (Phase 4), interview quality tuning against real answers, and the 20-user accuracy test, which needs the real provider.

- **Phase 3 Daily OS and Character: built (web)** with the safety boundary pulled forward from Phase 4. Brief, plan, tasks, practices with streaks, deep work timer, evening reflection, Sunday ritual and trait check-ins work end to end. The brief is rule-based (no model); the mentor-written brief arrives with Phase 4.
- **Gate still open:** a qualified human must review the crisis resource list and the classifier before any real user touches the product.

- **Phase 4 Mentor: built.** Streaming chat over SSE with the safety stop, encrypted history, structured memory the user can see and delete, rolling summaries, proactive nudges (re-engagement, ritual, 30/60/90 check-ins, streak milestones) evaluated lazily or by `manage.py run_proactive`, and weekly challenges that become Daily OS tasks. Still on the fake provider; the persona name and model id are the remaining inputs.
- **Knowledge, Legacy timeline, personality, calendar (demo mode), dashboard and settings are built** to bring the whole legacy frontend over (see MIGRATION_FROM_LEGACY.md). Google Calendar OAuth and the Presence module remain open.
