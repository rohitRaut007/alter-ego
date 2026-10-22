"""Shared contract artifacts for the protocol schema (JSON Schema + example documents).

The zod mirror in packages/validation is tested against these files, and a backend test fails
when they drift from the pydantic models.
"""

import json
from pathlib import Path
from typing import Any

from mentor.llm.fake import SECTION_BUILDERS

from .schema.v2 import DISCLAIMER, SCHEMA_VERSION, SECTION_KEYS, ProtocolDocument

REPO_ROOT = Path(__file__).resolve().parents[3]
VALIDATION_DIR = REPO_ROOT / "packages" / "validation"
SCHEMA_PATH = VALIDATION_DIR / "protocol.v2.schema.json"
EXAMPLE_PATH = VALIDATION_DIR / "fixtures" / "protocol.v2.example.json"
MINIMAL_PATH = VALIDATION_DIR / "fixtures" / "protocol.v2.minimal.json"

_EXAMPLE_ANSWERS = [
    {"stage": "Ambition", "question": "q", "answer": text}
    for text in [
        "I want to become a founder who ships a product people pay for.",
        "Developer tools for small teams, specifically a deployment dashboard.",
        "Strong engineering, six months of savings, a small network, a day job.",
        "Deep morning blocks, and I lose focus when messages pile up.",
        "I start projects and abandon them when they get hard.",
        "That I stay a person with a lot of potential and nothing to show.",
        "A product with 50 paying customers and a revenue number I can check.",
        "Two hours a day, and visible change within 90 days.",
    ]
]


def _normalise(doc: dict[str, Any]) -> dict[str, Any]:
    """Validate through the real model so a fixture is exactly what the API emits."""
    return ProtocolDocument.model_validate(doc).model_dump(mode="json", exclude_none=True)


def example_document() -> dict[str, Any]:
    """Every section present, as a protocol looks once all cards have unlocked."""
    parts = {k: SECTION_BUILDERS[k](_EXAMPLE_ANSWERS, "Ada") for k in SECTION_KEYS}
    doc: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": "2026-10-14T05:30:00Z",
        "disclaimer": DISCLAIMER,
    }
    for key in SECTION_KEYS:
        doc[key] = parts[key]["tasks"] if key == "checklist_30" else parts[key]
    return _normalise(doc)


def _window_task(i: int, day: int, minutes: int, milestone: str, **extra: Any) -> dict[str, Any]:
    return {
        "id": f"w{(day - 1) // 7 + 1}_t{i}",
        "title": f"Model serving step {i}",
        "detail": "Work on the current milestone for the time shown.",
        "layer": "mission",
        "due_day": day,
        "minutes": minutes,
        "priority": i == 1,
        "milestone_id": milestone,
        "fallback": "Do the first 15 minutes only.",
        "fallback_minutes": 10 if minutes <= 15 else 15,
        **extra,
    }


def minimal_document() -> dict[str, Any]:
    """The plan stage: goal, reality and tradeoffs are done, later layers have not unlocked."""
    if_then = {"if_cue": "I skip two days in a row",
               "then_action": "I do the 15-minute version before dinner"}
    weeks = [
        {
            "index": 1, "theme": "Ship a first served model",
            "outcome": "One model answers requests through an API you wrote.",
            "tasks": [
                _window_task(1, 1, 10, "m1"),
                _window_task(2, 2, 60, "m1", if_then=if_then),
                _window_task(3, 4, 60, "m1"),
                _window_task(4, 6, 120, "m1"),
            ],
            "review_prompt": "What did the model do that you did not expect?",
        },
        {
            "index": 2, "theme": "Make it repeatable",
            "outcome": "The same model rebuilds and redeploys from one command.",
            "tasks": [
                _window_task(5, 8, 60, "m1"),
                _window_task(6, 10, 60, "m1", if_then=if_then),
                _window_task(7, 13, 120, "m1"),
            ],
            "review_prompt": "Which step still needs you to remember something?",
        },
    ]
    weeks += [
        {"index": i, "theme": "Feature pipelines",
         "outcome": "Features are computed the same way in training and serving.",
         "review_prompt": "What did you learn that changes the next milestone?"}
        for i in range(3, 14)
    ]
    milestones = [
        {"id": "m1", "title": "Deploy one model behind an API you wrote", "due_day": 37,
         "evidence": "A public endpoint returns predictions.",
         "lead_measures": ["Hours on model serving each week"],
         "quote": "works as an ML engineer"},
        {"id": "m2", "title": "Build a feature pipeline end to end", "due_day": 120,
         "evidence": "One pipeline runs on a schedule and is monitored.",
         "lead_measures": ["Pipeline runs completed", "Hours on data work each week"]},
        {"id": "m3", "title": "Apply to five MLOps roles with a portfolio", "due_day": 266,
         "evidence": "Five applications sent with links to shipped work.",
         "lead_measures": ["Applications sent", "Portfolio pieces shipped"]},
    ]
    doc = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": "2026-10-22T05:30:00Z",
        "mission": {
            "statement": "Work as an ML engineer on a platform or MLOps team.",
            "strategy": "Reuse backend strengths: serve models first, then pipelines, then apply.",
            "roadmap": [
                {"name": "Deploy one model behind an API you wrote", "horizon_weeks": 6,
                 "outcomes": ["A public endpoint returns predictions."]},
                {"name": "Build a feature pipeline end to end", "horizon_weeks": 18,
                 "outcomes": ["One pipeline runs on a schedule and is monitored."]},
                {"name": "Apply to five MLOps roles with a portfolio", "horizon_weeks": 38,
                 "outcomes": ["Five applications sent with links to shipped work."]},
            ],
            "risks": ["Losing interest after the first two weeks."],
            "execution_system": "Two-week task windows, rebuilt from what actually got done.",
        },
        "sprint_90": {"goal": "Have one model deployed and a pipeline started.",
                      "milestones": milestones, "weeks": weeks},
        "disclaimer": DISCLAIMER,
    }
    return _normalise(doc)


def schema_json() -> str:
    return json.dumps(ProtocolDocument.model_json_schema(), indent=2, sort_keys=True) + "\n"


def _json(doc: dict[str, Any]) -> str:
    return json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


def example_json() -> str:
    return _json(example_document())


def minimal_json() -> str:
    return _json(minimal_document())
