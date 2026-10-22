# ADR 0010: Progressive onboarding and the goal engine

Status: Proposed · Date: 2026-10-22

## Context
Onboarding v1 is a 15 to 25 minute interview (`interview_turn/v1`) whose length and coverage are decided by the model, followed by generation of all nine protocol sections. Nothing useful appears until both finish: `GET /dashboard` and every screen that calls `get_sprint()` return 404 until a protocol is `ready`. The whole protocol rests on what users say about themselves on Day 0, which is the least reliable data the product will ever have: people overstate their time, describe an ideal day they do not live, and give the answer that sounds right before they trust the product. The PRD names Day 14 as the drop-off point.

The v2 proposal ("Progressive Protocol Blueprint") moves questions out of one sitting and into the dashboard cards they feed, checks feasibility in code, and plans only the next two weeks in detail. Product decisions for Phase 1 (2026-10-18): the product is for anyone with a "become" goal, not only founders; we are pre-launch, so v1 is replaced outright with no flags or backfill; the nine-section protocol stays and is filled from cards; the LLM stays on the fake provider for this round.

## Decision

**Seed, then cards.** Sign-up is followed by a four-question Seed (`POST /onboarding/seed`): path (architect, navigator, explorer), goal sentence and horizon, weekday and weekend minutes, and when the user can spend ten minutes today. It creates the goal, a `building` protocol, the sprint and a first task of ten minutes or less due today. Every other question lives in a card. A card is a server-side state machine (`locked → needs_input → calibrating → active → needs_review`) whose questions fill named slots in a versioned Goal Model. Phase 1 cards with questions: Goal (wish, outcome, obstacle, plan), Reality, Tradeoffs. Phase 1 cards without questions are drafted from the Goal Model on their unlock day: Daily OS and Knowledge with the plan, Character on day 3, Identity on day 14, Legacy on day 30 (Full tier), Presence on opt-in (Full tier). Phase 2 adds questions to them.

**The model proposes, code decides.**
- Code picks which slot to ask next, so coverage is guaranteed. The model only extracts values from free text (each with a confidence and the user's quote) and phrases suggestions. A value whose quote is not in the answer is capped at 0.5 confidence; below 0.6 gets one follow-up, then is accepted. If the model fails, the raw text is kept and the user is never blocked.
- Feasibility is a pure function: `coverage = weekly_hours × weeks_left × adherence / effort_hours`. Coverage of 1.0 or more is feasible, 0.8 to 1.0 a stretch, below 0.8 needs a tradeoff. Effort is a model estimate (low, likely, high hours); adherence starts from a self-reported prior (0.5 to 0.8 from "how long did your last big commitment hold") and is blended with measured completion as days accumulate (`k = 14`).
- When coverage is below 1.0 the Tradeoffs card offers three options with numbers computed in code: move the date, add time (naming what gets cut, never a non-negotiable), or narrow the scope. The user chooses; the engine never chooses silently.
- Plans are validated in code (weekly minutes at most 85% of budget, per-day capacity, a day-1 task under 15 minutes, a 15-minute fallback on every task, three to six ascending milestones ending on the target day, no outcome promises). On failure the model gets one retry with structured errors `{code, path, observed, allowed}`. A second failure puts the plan card in `needs_review` with a manual retry; there is no silent heuristic plan.

**Rolling wave.** Milestones run to the target date; daily tasks cover the next two weeks only; later weeks carry a theme and an outcome. The sprint is the first 90-day wave of the goal (`ends_on = start + min(90, target_day)`). Near the end of the window the plan card asks to build the next two weeks, carrying past tasks over. Weekly replanning and sprint rollover are Phase 2.

**Protocol schema 2.0.0.** Sections become optional (they arrive as cards unlock), `Week.tasks` may be empty with an `outcome`, `Sprint` gains `milestones`, and tasks gain `fallback`, `fallback_minutes`, `milestone_id` and `if_then`. Relaxing required fields breaks readers, so this is a major version. Every 1.0.0 document is a valid 2.0.0 document, so the migration only changes the version. `checklist_30` is deprecated; the two-week window replaces it.

**Storage.** A new `goals` app holds `Goal`, append-only `GoalVersion` (highest version is current, the same pattern as `ProtocolSection`), `Card`, `CardTurn`, `Calibration` (effort plus feasibility for one goal version) and append-only `PlanVersion`. User content is encrypted with the existing field types. The plan is projected deterministically into the `sprint_90` and `mission` sections, and the existing `sync_protocol` materialises tasks, so Today, Plan, the mentor and the dashboard keep one source of tasks.

**LLM layer.** New versioned prompts: `card_turn`, `first_task`, `goal_options`, `effort_estimate`, `tradeoff_options`, `plan_build`, `section_draft`. Each task has a tier (`fast` or `strong`) so a real provider can route models without code changes; the fake provider ignores the tier. Payloads are assembled in a fixed order (rules, Goal Model, plan window, memory, task input) so the stable prefix can be cached.

## Consequences
- A first task is on screen in about three minutes instead of after a 25-minute interview and a generation wait.
- Every reader of protocol sections must handle missing sections. Screens show a locked state with the unlock reason instead of a 404.
- Phase 1 is built and tested against the deterministic fake provider. Code enforces every rule that can be checked, but prompt quality is unmeasured until a real provider and the golden-persona evals land.
- Feasibility thresholds, the adherence priors and the 85% budget are starting assumptions to tune against real usage.
- Goals longer than 90 days need sprint rollover (Phase 2); until then the plan card flags review when the first sprint ends.
- The v1 interview, its prompts and `checklist_30` are deleted at the end of Phase 1.
