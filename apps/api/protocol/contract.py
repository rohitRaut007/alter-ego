"""Shared contract artifacts for the protocol schema (JSON Schema + example document).

The zod mirror in packages/validation is tested against these files, and a backend test fails
when they drift from the pydantic models.
"""

import json
from pathlib import Path
from typing import Any

from mentor.llm.fake import SECTION_BUILDERS

from .schema.v1 import DISCLAIMER, SCHEMA_VERSION, SECTION_KEYS, ProtocolDocument

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = REPO_ROOT / "packages" / "validation" / "protocol.v1.schema.json"
EXAMPLE_PATH = REPO_ROOT / "packages" / "validation" / "fixtures" / "protocol.v1.example.json"

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


def example_document() -> dict[str, Any]:
    parts = {k: SECTION_BUILDERS[k](_EXAMPLE_ANSWERS, "Ada") for k in SECTION_KEYS}
    doc = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": "2026-10-14T05:30:00Z",
        "identity": parts["identity"],
        "character": parts["character"],
        "knowledge": parts["knowledge"],
        "mission": parts["mission"],
        "daily_os": parts["daily_os"],
        "presence": parts["presence"],
        "legacy": parts["legacy"],
        "checklist_30": parts["checklist_30"]["tasks"],
        "sprint_90": parts["sprint_90"],
        "disclaimer": DISCLAIMER,
    }
    # Validate and normalise through the real model so the fixture is exactly what the API emits.
    return ProtocolDocument.model_validate(doc).model_dump(mode="json", exclude_none=True)


def schema_json() -> str:
    return json.dumps(ProtocolDocument.model_json_schema(), indent=2, sort_keys=True) + "\n"


def example_json() -> str:
    return json.dumps(example_document(), indent=2, ensure_ascii=False) + "\n"
