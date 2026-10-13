# Protocol schema

Versioned JSON document produced by the LLM and validated on every generation. Source of truth: pydantic models in `apps/api/protocol/schema/v1.py`. Mirrored to zod in `packages/validation` via exported JSON Schema (CI diff check).

- `schema_version`: semver string. v1 is `1.0.0`. Additive changes bump minor; breaking changes bump major and need a migration function.
- Each generation stores `prompt_version` and `model` alongside the document.
- Invalid output triggers up to 2 retries with the validation error fed back; then the protocol is marked `failed` and surfaced to the review queue.
- Section revision regenerates only the named section plus its dependents flagged in `depends_on`.

## Top level

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string | `"1.0.0"` |
| `generated_at` | datetime | |
| `identity` | Identity | Layer 1 |
| `character` | Character | Layer 2 |
| `knowledge` | Knowledge | Layer 3 |
| `mission` | Mission | Layer 4 |
| `daily_os` | DailyOS | Layer 5 |
| `presence` | Presence | Layer 6 (content may be a brief guide in Alpha) |
| `legacy` | Legacy | Layer 7 |
| `checklist_30` | Task[] | 30-day checklist |
| `sprint_90` | Sprint | 90-day sprint |
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
Task       { id, title, detail, layer, due_day (1..30), minutes, priority: bool, trait_id? }
Sprint     { goal, weeks: Week[12..13] }
Week       { index, theme, tasks: Task[], review_prompt }
```

Constraints: `layer` is one of `identity|character|knowledge|mission|daily_os|presence|legacy`. All ids unique within the document. `checklist_30` day 1 task is due at 06:00 local time next morning (PRD §7.1). Copy must not promise outcomes (validator rejects phrases from a banned list such as "guarantee", "will make you").

## Example (abridged)

```json
{
  "schema_version": "1.0.0",
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
  "sprint_90": { "goal": "...", "weeks": [] },
  "disclaimer": "This protocol is a planning framework based on your answers. It is not professional advice and carries no guarantee of results."
}
```
