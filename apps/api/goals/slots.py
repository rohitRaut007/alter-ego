"""Cards and their questions, as data. The engine decides what to ask; this module says what exists.

Question copy is English and server-owned because some questions are phrased by the model; the
web owns the Seed copy. Chip values are stable tokens; labels are display text.
"""

from dataclasses import dataclass, field
from typing import Any, Literal

from .schema import PATHS, Path

CardKey = Literal[
    "goal", "reality", "tradeoffs", "plan",
    "daily_os", "knowledge", "character", "identity", "legacy", "presence",
]
CARD_KEYS: tuple[CardKey, ...] = (
    "goal", "reality", "tradeoffs", "plan",
    "daily_os", "knowledge", "character", "identity", "legacy", "presence",
)
CardKind = Literal["questions", "plan", "draft"]

InputKind = Literal["text", "chips", "multi_chips", "options"]
# none: code reads the answer. extract: the model pulls slot values out of free text.
# suggest: the model writes the choices (code has a static fallback). goal_options: the model
# turns a direction or a feeling into three concrete goals.
LLMMode = Literal["none", "extract", "suggest", "goal_options"]

MIN_CONFIDENCE = 0.6
MAX_FOLLOWUPS = 1


@dataclass(frozen=True, eq=False)
class Choice:
    value: str
    label: str
    hours: float | None = None  # weekly hours a cut frees up
    # Structured payload for choices the model or code builds at ask time: a goal option's
    # statement and metric, an if-then plan, a tradeoff option's numbers (`disabled` when it
    # cannot be chosen).
    data: dict[str, Any] | None = None


@dataclass(frozen=True)
class SlotSpec:
    key: str
    card: CardKey
    prompt: str
    input: InputKind
    choices: tuple[Choice, ...] = ()
    required: bool = True
    depends_on: tuple[str, ...] = ()
    llm: LLMMode = "none"
    paths: tuple[Path, ...] = PATHS
    prompt_by_path: dict[str, str] = field(default_factory=dict)
    allow_custom: bool = False
    # Multi-choice slots that accept "none of these" as a real answer.
    allow_empty: bool = False
    placeholder: str = ""
    followup: str = "Could you say a little more about that?"

    def prompt_for(self, path: str) -> str:
        return self.prompt_by_path.get(path, self.prompt)

    @property
    def choice_values(self) -> frozenset[str]:
        return frozenset(c.value for c in self.choices)


@dataclass(frozen=True)
class CardSpec:
    key: CardKey
    title: str
    kind: CardKind
    est_minutes: int = 0
    # Protocol sections this card produces.
    sections: tuple[str, ...] = ()
    # Billing feature that must be entitled before the card spends model calls.
    feature: str | None = None
    # Days after the Seed before a draft card unlocks.
    unlock_day: int | None = None


CARDS: dict[str, CardSpec] = {
    c.key: c
    for c in (
        CardSpec("goal", "Your goal", "questions", est_minutes=4),
        CardSpec("reality", "Starting point", "questions", est_minutes=3),
        CardSpec("tradeoffs", "Tradeoffs", "questions", est_minutes=2),
        CardSpec("plan", "Plan and timeline", "plan", sections=("mission", "sprint_90")),
        CardSpec("daily_os", "Daily rhythm", "draft", sections=("daily_os",)),
        CardSpec("knowledge", "Learning", "draft", sections=("knowledge",)),
        CardSpec("character", "Character", "draft", sections=("character",), unlock_day=3),
        CardSpec("identity", "Identity", "draft", sections=("identity",), unlock_day=14),
        CardSpec("legacy", "Legacy", "draft", sections=("legacy",), feature="legacy",
                 unlock_day=30),
        CardSpec("presence", "Presence", "draft", sections=("presence",), feature="presence",
                 unlock_day=30),
    )
}
QUESTION_CARDS: tuple[str, ...] = tuple(k for k, c in CARDS.items() if c.kind == "questions")
DRAFT_CARDS: tuple[str, ...] = tuple(k for k, c in CARDS.items() if c.kind == "draft")

CUT_CHOICES: tuple[Choice, ...] = (
    Choice("scrolling", "Scrolling (about 5 h a week)", 5),
    Choice("gaming", "Gaming (about 6 h a week)", 6),
    Choice("shows", "Shows and streaming (about 5 h a week)", 5),
    Choice("going_out", "Going out (about 4 h a week)", 4),
    Choice("side_work", "Side work (about 5 h a week)", 5),
    Choice("lie_ins", "Weekend lie-ins (about 3 h a week)", 3),
)
CUT_HOURS: dict[str, float] = {c.value: c.hours or 0 for c in CUT_CHOICES}

OBSTACLE_CHOICES: tuple[Choice, ...] = (
    Choice("I lose interest after the start", "I lose interest after the start"),
    Choice("I overplan and underdo", "I overplan and underdo"),
    Choice("Other people's priorities take over", "Other people's priorities take over"),
    Choice("My phone", "My phone"),
    Choice("I doubt myself when progress is slow", "I doubt myself when progress is slow"),
    Choice("I'm drained after work", "I'm drained after work"),
)

SLOTS: tuple[SlotSpec, ...] = (
    # --- Goal card: wish, outcome, obstacle, plan ------------------------------------------
    SlotSpec(
        "statement", "goal",
        "Here are three concrete goals built from what you told me. Pick one or write your own.",
        "options", llm="goal_options", paths=("navigator", "explorer"), allow_custom=True,
        prompt_by_path={
            "explorer": "Here are three directions worth testing for the next 90 days. "
                        "Pick one or write your own.",
        },
        placeholder="Write the goal in your own words.",
    ),
    SlotSpec(
        "outcome_image", "goal",
        "Picture the day you get there. What is different on an ordinary Tuesday?",
        "text", llm="extract", depends_on=("statement",),
        placeholder="Describe the day, not the feeling.",
        followup="What would you actually be doing on that Tuesday?",
    ),
    SlotSpec(
        "success_metric", "goal",
        "What would prove it to a skeptical friend?",
        "text", llm="extract", depends_on=("outcome_image",),
        choices=(
            Choice("An offer for the role", "An offer for the role"),
            Choice("A number I can check", "A number I can check"),
            Choice("Something shipped that people use", "Something shipped that people use"),
            Choice("A score on a test", "A score on a test"),
            Choice("A demo of the skill", "A demo of the skill"),
        ),
        placeholder="Something you could point to.",
        followup="What exactly would they see or check?",
    ),
    SlotSpec(
        "why", "goal", "Why does this matter to you?", "multi_chips",
        choices=(
            Choice("enjoy", "I enjoy it"),
            Choice("fits_me", "It fits who I am"),
            Choice("serves_value", "It serves something I value"),
            Choice("respect_money", "Respect or money"),
            Choice("guilt", "I'd feel guilty otherwise"),
            Choice("expected", "Someone expects it"),
        ),
        depends_on=("success_metric",),
    ),
    SlotSpec(
        "anonymity", "goal",
        "If you reached this but no one would ever know, would you still want it?", "chips",
        choices=(Choice("yes", "Yes"), Choice("mostly", "Mostly"),
                 Choice("no", "Honestly, no")),
        depends_on=("why",),
    ),
    SlotSpec(
        "obstacle", "goal", "What in you is most likely to get in the way?", "chips",
        choices=OBSTACLE_CHOICES, allow_custom=True, depends_on=("anonymity",),
        placeholder="Name it plainly.",
    ),
    SlotSpec(
        "if_then", "goal", "When that shows up, what will you do instead?", "options",
        llm="suggest", allow_custom=True, depends_on=("obstacle",),
        placeholder="If ..., then I will ...",
    ),
    SlotSpec(
        "commitment", "goal",
        "If the next 90 days go well, what is the one thing that will be different?", "text",
        depends_on=("if_then",), placeholder="One to three sentences.",
        followup="What would you be able to point to at the end of the 90 days?",
    ),
    # --- Reality card -----------------------------------------------------------------------
    SlotSpec(
        "stage", "reality", "Where are you relative to this goal?", "chips",
        choices=(Choice("starting", "Just starting"), Choice("momentum", "Some momentum"),
                 Choice("stuck", "Mid-way and stuck"), Choice("close", "Close")),
    ),
    SlotSpec(
        "skills_have", "reality", "Tick what you can already do without help.", "multi_chips",
        llm="suggest", allow_custom=True, allow_empty=True, depends_on=("stage",),
    ),
    SlotSpec(
        "adherence_bucket", "reality",
        "Last time you committed to something big on your own, how long did it hold?", "chips",
        choices=(Choice("<2w", "Under 2 weeks"), Choice("~1m", "About a month"),
                 Choice("~3m", "About 3 months"), Choice("finished", "I finished it")),
        depends_on=("skills_have",),
    ),
    SlotSpec(
        "fixed_commitments", "reality", "What fixed commitments shape your week?",
        "multi_chips",
        choices=(Choice("Full-time job", "Full-time job"),
                 Choice("Part-time job", "Part-time job"),
                 Choice("College or classes", "College or classes"),
                 Choice("Long commute", "Long commute"),
                 Choice("Caregiving", "Caregiving")),
        required=False, allow_custom=True, allow_empty=True, depends_on=("adherence_bucket",),
    ),
    SlotSpec(
        "resources", "reality", "What can you put into this besides time?", "multi_chips",
        choices=(Choice("Budget for courses or tools", "Budget for courses or tools"),
                 Choice("A mentor or contact", "A mentor or contact"),
                 Choice("Equipment", "Equipment")),
        required=False, allow_custom=True, allow_empty=True, depends_on=("adherence_bucket",),
    ),
    SlotSpec(
        "people", "reality", "Who's in your corner, and who might pull you off course?", "text",
        required=False, depends_on=("adherence_bucket",), placeholder="Optional.",
    ),
    # --- Tradeoffs card ---------------------------------------------------------------------
    SlotSpec(
        "cuts", "tradeoffs", "What are you willing to do less of?", "multi_chips",
        choices=CUT_CHOICES, allow_empty=True,
    ),
    SlotSpec(
        "non_negotiables", "tradeoffs", "What is non-negotiable?", "multi_chips",
        choices=(Choice("7 hours of sleep", "7 hours of sleep"),
                 Choice("Family time", "Family time"), Choice("Exercise", "Exercise"),
                 Choice("Day-job performance", "Day-job performance"),
                 Choice("Faith or rituals", "Faith or rituals"),
                 Choice("Partner time", "Partner time")),
        allow_custom=True, allow_empty=True, depends_on=("cuts",),
    ),
    SlotSpec(
        "deprioritised", "tradeoffs", "What are you okay being average at for a while?",
        "multi_chips",
        choices=(Choice("Reading widely", "Reading widely"),
                 Choice("How I present myself", "How I present myself"),
                 Choice("Side interests", "Side interests"),
                 Choice("Social plans", "Social plans")),
        required=False, allow_custom=True, allow_empty=True, depends_on=("non_negotiables",),
    ),
    SlotSpec(
        "tradeoff_choice", "tradeoffs",
        "Your goal needs more time than you have. Which tradeoff do you choose?", "options",
        depends_on=("non_negotiables",),
    ),
)

SLOTS_BY_KEY: dict[str, SlotSpec] = {s.key: s for s in SLOTS}


def slots_for(card: str, path: str) -> list[SlotSpec]:
    """The card's questions that apply to this path, in asking order."""
    return [s for s in SLOTS if s.card == card and path in s.paths]


def question_count(card: str, path: str) -> int:
    return sum(1 for s in slots_for(card, path) if s.required)
