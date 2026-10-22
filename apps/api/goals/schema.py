"""The Goal Model: everything the cards learn about one goal, as one validated object.

Slot keys are Goal Model field names, so a card's filled slots merge straight into the model.
Every field except the Seed's is optional: the model is partial until the cards are done.
"""

from datetime import date
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, TypeAdapter

from protocol.schema.v2 import Id, IfThen, LayerId, SprintMilestone

GOAL_MODEL_VERSION = 1

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ChipText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]

Path = Literal["architect", "navigator", "explorer"]
PATHS: tuple[Path, ...] = ("architect", "navigator", "explorer")
HorizonChoice = Literal["3m", "6m", "1y", "2y", "date"]
Feeling = Literal["drifting", "bored", "capable_of_more", "wrong_place", "just_finished"]
FirstTaskWhen = Literal["now", "evening", "before_bed", "tomorrow_morning"]
MetricKind = Literal["role", "income", "shipped", "score", "skill_demo", "custom"]
WhyToken = Literal["enjoy", "fits_me", "serves_value", "respect_money", "guilt", "expected"]
Anonymity = Literal["yes", "mostly", "no"]
Stage = Literal["starting", "momentum", "stuck", "close"]
AdherenceBucket = Literal["<2w", "~1m", "~3m", "finished"]
CutToken = Literal["scrolling", "gaming", "shows", "going_out", "side_work", "lie_ins"]
OptionKey = Literal["move_date", "add_time", "narrow_scope"]

# Self-concordance: the first three reasons are autonomous, the rest are controlled.
AUTONOMOUS_WHY: frozenset[str] = frozenset({"enjoy", "fits_me", "serves_value"})

MINUTES_PER_DAY_MAX = 720


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SuccessMetric(_Model):
    kind: MetricKind
    target: ShortText


class GoalModelV1(_Model):
    version: Literal[1] = GOAL_MODEL_VERSION
    # Seed
    path: Path
    statement: ShortText | None = None
    feeling: Feeling | None = None
    horizon: HorizonChoice
    target_date: date
    is_hypothesis: bool = False
    weekday_minutes: int = Field(ge=5, le=MINUTES_PER_DAY_MAX)
    weekend_minutes: int = Field(ge=0, le=MINUTES_PER_DAY_MAX)
    first_task_when: FirstTaskWhen
    # Goal card: wish, outcome, obstacle, plan
    outcome_image: Text | None = None
    success_metric: SuccessMetric | None = None
    why: list[WhyToken] | None = None
    anonymity: Anonymity | None = None
    obstacle: ShortText | None = None
    if_then: IfThen | None = None
    commitment: Text | None = None
    # Reality card
    stage: Stage | None = None
    skills_have: list[ChipText] | None = None
    skills_missing: list[ChipText] | None = None
    adherence_bucket: AdherenceBucket | None = None
    fixed_commitments: list[ChipText] | None = None
    resources: list[ChipText] | None = None
    people: Text | None = None
    # Tradeoffs card
    cuts: list[CutToken] | None = None
    non_negotiables: list[ChipText] | None = None
    deprioritised: list[ChipText] | None = None
    tradeoff_choice: OptionKey | None = None
    # The user's own words per slot, so plans and the mentor can quote them back.
    quotes: dict[str, ShortText] = Field(default_factory=dict)

    @property
    def self_concordance(self) -> float | None:
        """Share of autonomous reasons among the reasons given; None until G3 is answered."""
        if not self.why:
            return None
        return sum(1 for w in self.why if w in AUTONOMOUS_WHY) / len(self.why)


# Validates one slot's value on its own, so a bad extraction is dropped without failing the card.
SLOT_TYPES: dict[str, Any] = {
    "statement": ShortText,
    "outcome_image": Text,
    "success_metric": SuccessMetric,
    "why": Annotated[list[WhyToken], Field(min_length=1, max_length=6)],
    "anonymity": Anonymity,
    "obstacle": ShortText,
    "if_then": IfThen,
    "commitment": Text,
    "stage": Stage,
    "skills_have": Annotated[list[ChipText], Field(max_length=12)],
    "skills_missing": Annotated[list[ChipText], Field(max_length=12)],
    "adherence_bucket": AdherenceBucket,
    "fixed_commitments": Annotated[list[ChipText], Field(max_length=8)],
    "resources": Annotated[list[ChipText], Field(max_length=8)],
    "people": Text,
    "cuts": Annotated[list[CutToken], Field(max_length=6)],
    "non_negotiables": Annotated[list[ChipText], Field(max_length=8)],
    "deprioritised": Annotated[list[ChipText], Field(max_length=8)],
    "tradeoff_choice": OptionKey,
}
_ADAPTERS = {key: TypeAdapter(tp) for key, tp in SLOT_TYPES.items()}


def validate_slot_value(key: str, value: Any) -> Any:
    """Return the value in its JSON form, or raise ValueError when it does not fit the slot."""
    adapter = _ADAPTERS.get(key)
    if adapter is None:
        raise ValueError(f"Unknown slot {key!r}")
    try:
        return adapter.dump_python(adapter.validate_python(value), mode="json")
    except Exception as exc:  # pydantic.ValidationError, but keep callers free of pydantic
        raise ValueError(str(exc)[:300]) from None


def merge(base: dict[str, Any], slot_values: dict[str, Any]) -> GoalModelV1:
    """A new Goal Model from the current one plus filled slot values."""
    return GoalModelV1.model_validate({**base, **slot_values})


# --- the plan the model writes (plan_build) ------------------------------------------------


class PlanTask(_Model):
    """A protocol task as the model writes it. Limits the validator explains (fallback length,
    window, capacity) are checked in code so the retry gets a precise error."""

    id: Id
    title: ShortText
    detail: Text
    layer: LayerId
    due_day: int = Field(ge=1, le=90)
    minutes: int = Field(ge=1, le=480)
    priority: bool = False
    milestone_id: Id | None = None
    fallback: ShortText | None = None
    fallback_minutes: int | None = Field(default=None, ge=1)
    if_then: IfThen | None = None


class PlanWeek(_Model):
    index: int = Field(ge=1, le=13)
    theme: ShortText
    outcome: Text | None = None
    tasks: list[PlanTask] = Field(default_factory=list, max_length=20)
    review_prompt: Text | None = None


class PlanRisk(_Model):
    risk: ShortText
    early_signal: ShortText
    response: ShortText


class PlanV1(_Model):
    milestones: list[SprintMilestone] = Field(max_length=12)
    weeks: list[PlanWeek] = Field(min_length=1, max_length=13)
    strategy: Text
    risks: list[PlanRisk] = Field(default_factory=list, max_length=5)
    assumptions: list[ShortText] = Field(default_factory=list, max_length=6)
