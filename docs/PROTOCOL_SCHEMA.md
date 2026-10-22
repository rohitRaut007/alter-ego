# Protocol schema

Versioned JSON document produced by the LLM and validated on every generation. Source of truth: pydantic models in `apps/api/protocol/schema/v2.py`. Mirrored to zod in `packages/validation` via exported JSON Schema (CI diff check).

- `schema_version`: semver string. Current is `2.0.0`. Additive changes bump minor; breaking changes bump major and need a migration function.
- Each generation stores `prompt_version` and `model` alongside the document.
- Invalid output triggers up to 2 retries with the validation error fed back; then the protocol is marked `failed` and surfaced to the review queue.
- Section revision regenerates only the named section plus its dependents flagged in `depends_on`.

## Version history

| Version | Change |
|---|---|
| `2.0.0` | Progressive onboarding (ADR 0010). Every section is optional because sections arrive as cards unlock. `Sprint` gains `milestones` and needs 1 to 13 weeks; `Week` gains `outcome` and may have no tasks (weeks beyond the two-week window); `Task` gains `milestone_id`, `fallback`, `fallback_minutes` (at most 15) and `if_then`. `checklist_30` is deprecated: the plan window replaces it, and it is dropped when the v1 interview is removed at the end of Phase 1. Migration: `upgrade_v1_document()` changes only the version, because every 1.0.0 document is valid 2.0.0; data migration `protocol/0002` relabels stored protocols. |
| `1.0.0` | Interview-generated protocol with all nine sections required. |

## Top level

Only `schema_version`, `generated_at` and `disclaimer` are required. A section is present once its card has produced it.

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string | `"2.0.0"` |
| `generated_at` | datetime | |
| `identity` | Identity | Layer 1 |
| `character` | Character | Layer 2 |
| `knowledge` | Knowledge | Layer 3 |
| `mission` | Mission | Layer 4 |
| `daily_os` | DailyOS | Layer 5 |
| `presence` | Presence | Layer 6 (content may be a brief guide in Alpha) |
| `legacy` | Legacy | Layer 7 |
| `checklist_30` | Task[] | Deprecated; produced only by the v1 interview until it is removed |
| `sprint_90` | Sprint | First 90-day wave of the goal: milestones plus a two-week task window |
| `disclaimer` | string | Fixed text: advice is a framework, not a guarantee |

## Types

```text
Identity   { archetype, thesis, alter_ego_name, identity_statement, legacy_definition, why_this_fits[] }
Character  { traits: Trait[3..7] }
Trait      { id, name, statement, rationale, practices: Practice[1..3], failure_mode, monthly_reflection_prompt }
Practice   { id, description, cadence: "daily"|"weekly", minutes }
Knowledge  { reading_list: ReadingItem[5..15], sequencing_rationale, destruction_test_template, weekly_focus_domains[] }
ReadingItem{ id, title, author, why_now, sequence, estimated_hours }
Mission    { statement, strategy, roadmap: Phase[2..5], risks[], execution_system }
Phase      { name, horizon_weeks, outcomes[] }
DailyOS    { schedule: Block[], deep_work_minutes_per_day, shutdown_ritual, reflection_questions: string[3] }
Block      { start: "HH:MM", end: "HH:MM", label, layer, kind: "deep_work"|"recovery"|"practice"|"admin"|"learning" }
Presence   { principles[], micro_practices: MicroPractice[], wardrobe_notes, social_playbook[] }
Legacy     { milestones: Milestone[3] }  // one each: 2y, 5y, life
Milestone  { horizon: "2y"|"5y"|"life", statement, evidence_of_progress[], leading_indicators[] }
Task       { id, title, detail, layer, due_day (1..90), minutes, priority: bool, trait_id?,
             milestone_id?, fallback?, fallback_minutes? (1..15), if_then?: IfThen }
IfThen     { if_cue, then_action }
Sprint     { goal, milestones: SprintMilestone[0..6], weeks: Week[1..13] }
SprintMilestone { id, title, due_day (1..730, from sprint start; may fall after the sprint), evidence,
                  lead_measures[1..3], quote? }
Week       { index (unique), theme, outcome?, tasks: Task[0..20], review_prompt }
```

Constraints: `layer` is one of `identity|character|knowledge|mission|daily_os|presence|legacy`. All ids unique within the document. Tasks may name a `trait_id` only once `character` exists, and a `milestone_id` only from `sprint_90.milestones`. `due_day` counts from the sprint start; day 1 is the day after the plan is built (the Seed's first task is a Daily OS task outside the document). Copy must not promise outcomes (validator rejects phrases from a banned list such as "guarantee", "will make you"). Plan rules that go beyond the shape (capacity, the day-1 task, fallbacks on every window task, milestone order) are enforced by the goal engine's plan validator, not by this schema.

## Example (abridged)

```json
{
  "schema_version": "2.0.0",
  "generated_at": "2026-10-14T05:30:00Z",
  "identity": {
    "archetype": "The Systems Builder",
    "thesis": "Builds durable companies by turning intuition into repeatable process.",
    "alter_ego_name": "The Operator",
    "identity_statement": "I ship deliberately and review honestly.",
    "legacy_definition": "A company that outlives my involvement.",
    "why_this_fits": ["Stated pattern of starting strong then losing structure"]
  },
  "character": {
    "traits": [
      {
        "id": "t1",
        "name": "Follow-through",
        "statement": "I finish what I commit to this week.",
        "rationale": "Your answers named abandoned projects as the main failure mode.",
        "practices": [
          { "id": "p1", "description": "Write tomorrow's single must-finish task", "cadence": "daily", "minutes": 5 }
        ],
        "failure_mode": "Starting new work to avoid finishing old work",
        "monthly_reflection_prompt": "Where did I stop early this month, and what was I avoiding?"
      }
    ]
  },
  "knowledge": {
    "reading_list": [
      { "id": "r1", "title": "Example Title", "author": "Example Author", "why_now": "Builds the habit you named as weakest", "sequence": 1, "estimated_hours": 6 }
    ],
    "sequencing_rationale": "Start with execution habits before strategy.",
    "destruction_test_template": "State the strongest argument against this book's thesis, then test it against your own case.",
    "weekly_focus_domains": ["operations"]
  },
  "mission": { "statement": "...", "strategy": "...", "roadmap": [], "risks": [], "execution_system": "..." },
  "daily_os": {
    "schedule": [{ "start": "06:00", "end": "08:00", "label": "Deep work", "layer": "mission", "kind": "deep_work" }],
    "deep_work_minutes_per_day": 120,
    "shutdown_ritual": "Write the next day's first action.",
    "reflection_questions": ["What compounded today?", "What leaked?", "What is tomorrow's first action?"]
  },
  "presence": { "principles": [], "micro_practices": [], "wardrobe_notes": "", "social_playbook": [] },
  "legacy": { "milestones": [
    { "horizon": "2y", "statement": "...", "evidence_of_progress": [], "leading_indicators": [] },
    { "horizon": "5y", "statement": "...", "evidence_of_progress": [], "leading_indicators": [] },
    { "horizon": "life", "statement": "...", "evidence_of_progress": [], "leading_indicators": [] }
  ] },
  "checklist_30": [
    { "id": "c1", "title": "Define this week's single outcome", "detail": "One sentence.", "layer": "mission", "due_day": 1, "minutes": 15, "priority": true }
  ],
  "sprint_90": {
    "goal": "Have one model deployed and a pipeline started.",
    "milestones": [
      { "id": "m1", "title": "Deploy one model behind an API you wrote", "due_day": 37, "evidence": "A public endpoint returns predictions.", "lead_measures": ["Hours on model serving each week"] }
    ],
    "weeks": [
      { "index": 1, "theme": "Ship a first served model", "outcome": "One model answers requests.", "review_prompt": "...",
        "tasks": [{ "id": "w1_t1", "title": "...", "detail": "...", "layer": "mission", "due_day": 1, "minutes": 10, "priority": true,
                    "milestone_id": "m1", "fallback": "Do the first 15 minutes only.", "fallback_minutes": 10,
                    "if_then": { "if_cue": "I skip two days in a row", "then_action": "I do the 15-minute version before dinner" } }] },
      { "index": 3, "theme": "Feature pipelines", "outcome": "Features are computed the same way in training and serving.", "tasks": [], "review_prompt": "..." }
    ]
  },
  "disclaimer": "This protocol is a planning framework built from your answers. It is not professional advice and it does not promise any particular result. You can change any part of it."
}
```

## Contract files
`packages/validation/protocol.v2.schema.json` (JSON Schema), `packages/validation/fixtures/protocol.v2.example.json` (every section) and `packages/validation/fixtures/protocol.v2.minimal.json` (the plan stage: `mission` and `sprint_90` only) are exported from the pydantic models with `python manage.py export_protocol_contract`. A backend test fails if they drift from the models, and the zod mirror in `packages/validation/src/protocol.ts` is tested against both documents. The deprecated `checklist_30` section is stored as `{ "tasks": [...] }`; the assembled document exposes it as the bare list shown above.
