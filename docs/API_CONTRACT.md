# Alter Ego OS — API Contract & Specification

## 1. Overview
This document specifies the REST endpoints for Seed Calibration, Protocol Cards, Feasibility Verdicts, Tradeoffs, and Fallback Plans.

---

## 2. Authentication & Authorization
All authenticated requests must include the Bearer token in the `Authorization` header:
```http
Authorization: Bearer <supabase_or_jwt_token>
```
Unauthenticated requests return `401 Unauthorized`. Access to resources belonging to other users returns `403 Forbidden`.

---

## 3. Endpoints

### 3.1 `POST /api/seed/`
Initializes a user's transformation seed trajectory from the four-question intake.

#### Request Headers
`Content-Type: application/json`

#### Request Body
```json
{
  "situation": "know_goal",
  "target_statement": "A sovereign builder who ships autonomous systems without permission.",
  "target_date": "2027-04-01",
  "weekday_minutes": 90,
  "weekend_minutes": 180,
  "today_minutes": 10,
  "today_availability": "Right now"
}
```

#### Validation Rules
- `target_date`: Must be between **14 days** and **730 days** (2 years) from `now()`.
- `weekday_minutes`, `weekend_minutes`: Must be positive integers.
- `situation`: One of `"know_goal"`, `"direction"`, `"change"`.

#### Response `201 Created`
```json
{
  "goal": {
    "id": "goal-001",
    "user_id": "usr-123",
    "title": "A sovereign builder who ships autonomous systems without permission.",
    "target_date": "2027-04-01",
    "weekday_minutes": 90,
    "weekend_minutes": 180,
    "today_minutes": 10,
    "situation": "know_goal",
    "created_at": "2026-10-29T00:00:00Z"
  },
  "first_task": {
    "id": "task-001",
    "title": "10-minute kick-off: outline identity statement",
    "estimated_minutes": 10,
    "layer": "identity",
    "priority": true,
    "status": "pending"
  },
  "cards": [
    {
      "id": "card-goal",
      "slug": "goal",
      "title": "Goal Card",
      "state": "active",
      "question_count": 3,
      "estimated_minutes": 5
    }
  ]
}
```

#### Conflict Behavior `409 Conflict`
- When a user has already calibrated a goal, the server responds with `409 Conflict`.
- **Client Contract Requirement**: Clients must catch `409` and immediately navigate to `/dashboard`.

---

### 3.2 `GET /api/cards/`
Retrieves all protocol cards for the authenticated user.

#### Response `200 OK`
```json
[
  {
    "id": "card-1-locked",
    "slug": "identity-depth",
    "title": "Deep Identity Architecture",
    "state": "locked",
    "unlock_reason": "Opens on day 3",
    "question_count": 5,
    "estimated_minutes": 10
  },
  {
    "id": "card-2-calibrating",
    "slug": "calibration-engine",
    "title": "Feasibility Calibration",
    "state": "calibrating",
    "verdict": {
      "status": "stretch",
      "effort_hours": 180,
      "weekly_hours": 12,
      "coverage_pct": 75,
      "verdict_text": "High ambition target. May require timeline shift or daily load adjustment.",
      "tradeoff_options": [
        {
          "id": "move_date",
          "label": "Move the date out by 4 weeks",
          "available": true,
          "impact_summary": "+28 days timeline relief"
        },
        {
          "id": "add_time",
          "label": "Add 3 hours/week of deep work",
          "available": true,
          "impact_summary": "+36 total project hours"
        },
        {
          "id": "narrow_scope",
          "label": "Narrow the scope to core MVP",
          "available": false,
          "reason_disabled": "Scope is already minimized to core protocol modules."
        }
      ]
    }
  }
]
```

---

### 3.3 `POST /api/cards/:card_id/steps/:step_number/answer/`
Submits an answer for a card step.

#### Supported Types
- `"text"`: `{ "answer": "I will protect morning deep work." }`
- `"chips"`: `{ "answer": "Unshakable Focus" }`
- `"multi_chips"`: `{ "answer": ["Unshakable Focus", "Direct Candor"] }`
- `"options"`: `{ "answer": "Early Morning (6:00 - 8:30 AM)" }`

#### Safety Boundary Trigger
- If user input contains acute distress keywords (e.g. `"burnout"`, `"hopeless"`), the response returns:
```json
{
  "safety_notice": "Pacing matters. Alter Ego OS emphasizes sustainable progression and healthy boundaries.",
  "accepted": true,
  "next_step": 2
}
```
- **Rule**: Client must display the safety notice without aborting or closing the active step.

---

### 3.4 `POST /api/cards/:card_id/tradeoffs/`
Applies a calibrated tradeoff lever.

#### Request Body
```json
{
  "choices": ["move_date"]
}
```

#### Response `200 OK`
```json
{
  "applied_choice": "move_date",
  "updated_target_date": "2027-05-01",
  "new_status": "feasible"
}
```

---

### 3.5 `PATCH /api/tasks/:task_id/fallback/`
Toggles the 15-minute emergency fallback version of a scheduled task.

#### Request Body
```json
{
  "did_15_min_version": true
}
```

#### Response `200 OK`
```json
{
  "id": "task-002",
  "did_15_min_version": true,
  "status": "pending"
}
```

---

### 3.6 `POST /api/sprint/rebuild/`
Re-calibrates and plans the upcoming two-week task horizon when `needs_review: true`.

#### Response `200 OK`
```json
{
  "sprint_id": "sprint-2026-q4",
  "needs_review": false,
  "generated_tasks_count": 6
}
```

