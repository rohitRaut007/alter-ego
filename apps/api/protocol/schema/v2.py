"""Protocol document schema v2.0.0. Mirrored in packages/validation (zod); see docs/PROTOCOL_SCHEMA.md.

Additive changes bump the minor version; breaking changes bump the major and need a migration.

2.0.0 (ADR 0010): sections are optional because they arrive as cards unlock; the sprint carries
milestones and a rolling two-week task window (later weeks have an outcome and no tasks); tasks
carry a 15-minute fallback, a milestone and an if-then plan. Every 1.0.0 document is a valid
2.0.0 document, so `upgrade_v1_document` only changes the version.
"""

import re
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

SCHEMA_VERSION = "2.0.0"
V1_SCHEMA_VERSION = "1.0.0"

DISCLAIMER = (
    "This protocol is a planning framework built from your answers. It is not professional "
    "advice and it does not promise any particular result. You can change any part of it."
)

# Copy must never promise outcomes (PRD risk: overclaiming).
_BANNED = re.compile(
    r"\b(guarantee[sd]?|will make you|you will become|100% (?:success|certain)|never fail)\b",
    re.IGNORECASE,
)

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Id = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{0,31}$")]
Clock = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]

LayerId = Literal["identity", "character", "knowledge", "mission", "daily_os", "presence", "legacy"]

# A fallback is the bad-day version of a task: doing it keeps the streak (never miss twice).
FALLBACK_MAX_MINUTES = 15


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Practice(_Model):
    id: Id
    description: Text
    cadence: Literal["daily", "weekly"]
    minutes: int = Field(ge=1, le=180)


class Trait(_Model):
    id: Id
    name: ShortText
    statement: Text
    rationale: Text
    practices: list[Practice] = Field(min_length=1, max_length=3)
    failure_mode: Text
    monthly_reflection_prompt: Text


class Identity(_Model):
    archetype: ShortText
    thesis: Text
    alter_ego_name: ShortText
    identity_statement: Text
    legacy_definition: Text
    why_this_fits: list[Text] = Field(min_length=1, max_length=6)


class Character(_Model):
    traits: list[Trait] = Field(min_length=3, max_length=7)


class ReadingItem(_Model):
    id: Id
    title: ShortText
    author: ShortText
    why_now: Text
    sequence: int = Field(ge=1)
    estimated_hours: int = Field(ge=1, le=100)


class Knowledge(_Model):
    reading_list: list[ReadingItem] = Field(min_length=5, max_length=15)
    sequencing_rationale: Text
    destruction_test_template: Text
    weekly_focus_domains: list[ShortText] = Field(min_length=1, max_length=6)


class Phase(_Model):
    name: ShortText
    horizon_weeks: int = Field(ge=1, le=104)
    outcomes: list[Text] = Field(min_length=1, max_length=6)


class Mission(_Model):
    statement: Text
    strategy: Text
    roadmap: list[Phase] = Field(min_length=2, max_length=5)
    risks: list[Text] = Field(min_length=1, max_length=8)
    execution_system: Text


class Block(_Model):
    start: Clock
    end: Clock
    label: ShortText
    layer: LayerId
    kind: Literal["deep_work", "recovery", "practice", "admin", "learning"]


class DailyOS(_Model):
    schedule: list[Block] = Field(min_length=1, max_length=14)
    deep_work_minutes_per_day: int = Field(ge=0, le=480)
    shutdown_ritual: Text
    reflection_questions: list[Text] = Field(min_length=3, max_length=3)


class MicroPractice(_Model):
    id: Id
    description: Text
    minutes: int = Field(ge=1, le=60)


class Presence(_Model):
    principles: list[Text] = Field(min_length=1, max_length=8)
    micro_practices: list[MicroPractice] = Field(min_length=1, max_length=10)
    wardrobe_notes: Text
    social_playbook: list[Text] = Field(min_length=1, max_length=8)


class Milestone(_Model):
    horizon: Literal["2y", "5y", "life"]
    statement: Text
    evidence_of_progress: list[Text] = Field(min_length=1, max_length=6)
    leading_indicators: list[Text] = Field(min_length=1, max_length=6)


class Legacy(_Model):
    milestones: list[Milestone] = Field(min_length=3, max_length=3)

    @model_validator(mode="after")
    def _one_per_horizon(self) -> "Legacy":
        if {m.horizon for m in self.milestones} != {"2y", "5y", "life"}:
            raise ValueError("Legacy needs exactly one milestone each for 2y, 5y and life")
        return self


class IfThen(_Model):
    """An implementation intention: when the cue happens, do the action."""

    if_cue: ShortText
    then_action: ShortText


class Task(_Model):
    id: Id
    title: ShortText
    detail: Text
    layer: LayerId
    due_day: int = Field(ge=1, le=90)
    minutes: int = Field(ge=1, le=480)
    priority: bool = False
    trait_id: Id | None = None
    milestone_id: Id | None = None
    fallback: ShortText | None = None
    fallback_minutes: int | None = Field(default=None, ge=1, le=FALLBACK_MAX_MINUTES)
    if_then: IfThen | None = None


class Checklist(_Model):
    """Deprecated in 2.0.0: the plan's two-week window replaces it. Kept so 1.0.0 documents load.

    The document stores this section as a bare `checklist_30` task list.
    """

    tasks: list[Task] = Field(min_length=5, max_length=60)

    @model_validator(mode="after")
    def _within_30_days(self) -> "Checklist":
        if any(t.due_day > 30 for t in self.tasks):
            raise ValueError("checklist_30 tasks must be due within 30 days")
        if not any(t.due_day == 1 for t in self.tasks):
            raise ValueError("checklist_30 needs a Day 1 task")
        return self


class Week(_Model):
    index: int = Field(ge=1, le=13)
    theme: ShortText
    # What this week should produce. Weeks beyond the planned window carry an outcome and no tasks.
    outcome: Text | None = None
    tasks: list[Task] = Field(default_factory=list, max_length=20)
    review_prompt: Text


class SprintMilestone(_Model):
    """A checkpoint on the way to the goal. `due_day` counts from the sprint start and may fall
    after the sprint ends, because milestones run to the goal's target date."""

    id: Id
    title: ShortText
    due_day: int = Field(ge=1, le=730)
    evidence: Text
    lead_measures: list[ShortText] = Field(min_length=1, max_length=3)
    quote: ShortText | None = None


class Sprint(_Model):
    goal: Text
    milestones: list[SprintMilestone] = Field(default_factory=list, max_length=6)
    weeks: list[Week] = Field(min_length=1, max_length=13)

    @model_validator(mode="after")
    def _consistent(self) -> "Sprint":
        indexes = [w.index for w in self.weeks]
        if len(set(indexes)) != len(indexes):
            raise ValueError("Sprint week indexes must be unique")
        milestone_ids = {m.id for m in self.milestones}
        unknown = {
            t.milestone_id
            for w in self.weeks
            for t in w.tasks
            if t.milestone_id and t.milestone_id not in milestone_ids
        }
        if unknown:
            raise ValueError(f"Tasks reference unknown milestones: {sorted(unknown)}")
        return self


SECTION_MODELS: dict[str, type[BaseModel]] = {
    "identity": Identity,
    "character": Character,
    "knowledge": Knowledge,
    "mission": Mission,
    "daily_os": DailyOS,
    "presence": Presence,
    "legacy": Legacy,
    "checklist_30": Checklist,
    "sprint_90": Sprint,
}
SECTION_KEYS: tuple[str, ...] = tuple(SECTION_MODELS)
# Sections a 2.0.0 protocol can contain. checklist_30 only appears in upgraded 1.0.0 documents.
ACTIVE_SECTION_KEYS: tuple[str, ...] = tuple(k for k in SECTION_KEYS if k != "checklist_30")


class ProtocolDocument(_Model):
    schema_version: Literal["2.0.0"]
    generated_at: datetime
    identity: Identity | None = None
    character: Character | None = None
    knowledge: Knowledge | None = None
    mission: Mission | None = None
    daily_os: DailyOS | None = None
    presence: Presence | None = None
    legacy: Legacy | None = None
    checklist_30: Annotated[list[Task], Field(min_length=5, max_length=60)] | None = None
    sprint_90: Sprint | None = None
    disclaimer: Text

    @model_validator(mode="after")
    def _cross_checks(self) -> "ProtocolDocument":
        traits = self.character.traits if self.character else []
        checklist = self.checklist_30 or []
        sprint_tasks = [t for w in self.sprint_90.weeks for t in w.tasks] if self.sprint_90 else []

        ids: list[str] = [t.id for t in traits]
        ids += [p.id for t in traits for p in t.practices]
        ids += [r.id for r in self.knowledge.reading_list] if self.knowledge else []
        ids += [m.id for m in self.presence.micro_practices] if self.presence else []
        ids += [t.id for t in checklist]
        ids += [t.id for t in sprint_tasks]
        dupes = {i for i in ids if ids.count(i) > 1}
        if dupes:
            raise ValueError(f"Duplicate ids in protocol: {sorted(dupes)}")

        # Trait links are checked once character exists; until then tasks may not name a trait.
        trait_ids = {t.id for t in traits}
        unknown = {t.trait_id for t in checklist + sprint_tasks
                   if t.trait_id and t.trait_id not in trait_ids}
        if unknown:
            raise ValueError(f"Tasks reference unknown traits: {sorted(unknown)}")
        if self.checklist_30 is not None:
            if not any(t.due_day == 1 for t in checklist):
                raise ValueError("checklist_30 needs a Day 1 task")
            if any(t.due_day > 30 for t in checklist):
                raise ValueError("checklist_30 tasks must be due within 30 days")
        return self


def upgrade_v1_document(doc: dict[str, Any]) -> dict[str, Any]:
    """Return a 2.0.0 copy of a 1.0.0 document. Every 1.0.0 document is valid under 2.0.0."""
    if doc.get("schema_version") == SCHEMA_VERSION:
        return doc
    if doc.get("schema_version") != V1_SCHEMA_VERSION:
        raise ValueError(f"Cannot upgrade schema version {doc.get('schema_version')!r}")
    upgraded = {**doc, "schema_version": SCHEMA_VERSION}
    return ProtocolDocument.model_validate(upgraded).model_dump(mode="json", exclude_none=True)


def find_banned_phrases(value: Any) -> list[str]:
    """Return outcome-promising phrases found anywhere in a JSON-like value."""
    found: list[str] = []
    if isinstance(value, str):
        found += [m.group(0) for m in _BANNED.finditer(value)]
    elif isinstance(value, dict):
        for v in value.values():
            found += find_banned_phrases(v)
    elif isinstance(value, list):
        for v in value:
            found += find_banned_phrases(v)
    return found
