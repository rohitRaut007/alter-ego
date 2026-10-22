"""The card engine: what to ask next, how an answer fills slots, and which state each card is in.

Pure functions over plain data. Code decides coverage; the model only extracts and phrases.

A slot's state is `{"value", "confidence", "quote", "source", "followups", "skipped"}`. A slot is
settled when it was skipped, is confident enough, or has had its one follow-up.
"""

import copy
import re
from dataclasses import dataclass, field
from typing import Any, Literal

from .schema import validate_slot_value
from .slots import (
    CARDS,
    DRAFT_CARDS,
    MAX_FOLLOWUPS,
    MIN_CONFIDENCE,
    SLOTS_BY_KEY,
    Choice,
    SlotSpec,
    slots_for,
)

Slots = dict[str, dict[str, Any]]
Source = Literal["user", "llm"]

# Filled from another slot's answer rather than asked: the skills offered but not ticked.
DERIVED_SLOTS: dict[str, frozenset[str]] = {"reality": frozenset({"skills_missing"})}

CardState = Literal["locked", "needs_input", "calibrating", "active", "needs_review"]


class AnswerError(ValueError):
    """The answer does not fit the question (maps to HTTP 400)."""


@dataclass(frozen=True)
class Fill:
    slot: str
    value: Any
    confidence: float = 1.0
    quote: str | None = None
    source: Source = "user"


@dataclass(frozen=True)
class Answer:
    text: str | None = None
    choices: tuple[str, ...] = ()
    skip: bool = False


@dataclass(frozen=True)
class NextQuestion:
    slot: SlotSpec
    is_followup: bool


# --- reading slot state ------------------------------------------------------------------


def is_settled(state: dict[str, Any] | None) -> bool:
    if not state:
        return False
    return bool(
        state.get("skipped")
        or state.get("confidence", 0) >= MIN_CONFIDENCE
        or state.get("followups", 0) >= MAX_FOLLOWUPS
    )


def next_question(card: str, path: str, slots: Slots) -> NextQuestion | None:
    """The first unsettled question whose dependencies are settled, or None when the card is done.

    A dependency that does not apply to this path (the Seed already answered it) counts as met.
    """
    applicable = slots_for(card, path)
    keys = {s.key for s in applicable}
    for spec in applicable:
        state = slots.get(spec.key)
        if is_settled(state):
            continue
        if not all(d not in keys or is_settled(slots.get(d)) for d in spec.depends_on):
            continue
        return NextQuestion(spec, is_followup=state is not None)
    return None


def is_complete(card: str, path: str, slots: Slots) -> bool:
    return next_question(card, path, slots) is None


def progress(card: str, path: str, slots: Slots) -> float:
    applicable = slots_for(card, path)
    if not applicable:
        return 1.0
    return sum(1 for s in applicable if is_settled(slots.get(s.key))) / len(applicable)


def values(slots: Slots) -> dict[str, Any]:
    """Slot values ready to merge into the Goal Model. Skipped slots contribute nothing."""
    return {k: s["value"] for k, s in slots.items() if not s.get("skipped") and "value" in s}


def quotes(slots: Slots) -> dict[str, str]:
    return {k: s["quote"][:200] for k, s in slots.items() if s.get("quote")}


# --- turning an answer into fills --------------------------------------------------------


def text_confidence(text: str) -> float:
    """Answers read by code: a few words are enough to act on; one or two get a follow-up."""
    return 0.9 if len(text.split()) >= 4 else 0.4


_IF_THEN = re.compile(r"^\s*if\s+(?P<cue>.+?)\s*,?\s*then\s+(?P<action>.+?)\s*\.?\s*$",
                      re.IGNORECASE | re.DOTALL)


def parse_if_then(text: str, obstacle: str | None) -> dict[str, str]:
    """Read "If X, then Y" from free text; otherwise the obstacle is the cue."""
    m = _IF_THEN.match(text)
    if m:
        return {"if_cue": m.group("cue")[:200], "then_action": m.group("action")[:200]}
    return {"if_cue": (obstacle or "that shows up")[:200], "then_action": text.strip()[:200]}


def _custom(spec: SlotSpec, value: str) -> str:
    value = " ".join(value.split())
    if not spec.allow_custom:
        raise AnswerError("Pick one of the options.")
    if not value or len(value) > 80:
        raise AnswerError("Keep your own option under 80 characters.")
    return value


def deterministic_fills(
    spec: SlotSpec, answer: Answer, offered: list[Choice], slots: Slots
) -> list[Fill]:
    """Fills that code reads directly from the answer. Text slots that need the model return [].

    `offered` is what the user was shown: the spec's static choices or the model's suggestions.
    """
    by_value = {c.value: c for c in offered}
    text = (answer.text or "").strip()

    if spec.input == "text":
        if not text:
            raise AnswerError("Write an answer, or pick a suggestion.")
        if spec.llm == "extract":
            return []
        return [Fill(spec.key, text, text_confidence(text), quote=text[:200])]

    if spec.input in ("chips", "options"):
        if len(answer.choices) > 1:
            raise AnswerError("Pick one option.")
        if answer.choices and answer.choices[0] in by_value:
            choice = by_value[answer.choices[0]]
            if choice.data and choice.data.get("disabled"):
                raise AnswerError("That option is not available.")
            return _fills_for_choice(spec, choice, slots)
        custom = answer.choices[0] if answer.choices else text
        if not custom:
            raise AnswerError("Pick one of the options.")
        return _fills_for_custom(spec, _custom(spec, custom), slots)

    # multi_chips
    picked: list[str] = []
    for raw in answer.choices:
        value = raw if raw in by_value else _custom(spec, raw)
        if value not in picked:
            picked.append(value)
    if text:
        for part in text.split(";"):
            if part.strip():
                value = _custom(spec, part)
                if value not in picked:
                    picked.append(value)
    if not picked and not spec.allow_empty:
        raise AnswerError("Pick at least one.")
    fills = [Fill(spec.key, picked, 1.0)]
    if spec.key == "skills_have":
        offered_values = [c.value for c in offered]
        fills.append(Fill("skills_missing", [v for v in offered_values if v not in picked], 1.0))
    return fills


def _fills_for_choice(spec: SlotSpec, choice: Choice, slots: Slots) -> list[Fill]:
    data = choice.data or {}
    if spec.key == "statement":
        fills = [Fill("statement", data.get("statement", choice.label), 1.0,
                      quote=data.get("statement", choice.label)[:200])]
        if data.get("success_metric"):
            fills.append(Fill("success_metric", data["success_metric"], 1.0))
        return fills
    if spec.key == "if_then":
        return [Fill("if_then", data.get("if_then") or parse_if_then(choice.label, None), 1.0)]
    return [Fill(spec.key, choice.value, 1.0)]


def _fills_for_custom(spec: SlotSpec, value: str, slots: Slots) -> list[Fill]:
    if spec.key == "if_then":
        obstacle = (slots.get("obstacle") or {}).get("value")
        return [Fill("if_then", parse_if_then(value, obstacle), 1.0, quote=value[:200])]
    return [Fill(spec.key, value, 1.0, quote=value[:200])]


def fallback_fill(spec: SlotSpec, text: str) -> Fill:
    """When the model cannot read a text answer, keep the user's words and ask one follow-up."""
    value: Any = text.strip()
    if spec.key == "success_metric":
        value = {"kind": "custom", "target": text.strip()[:200]}
    return Fill(spec.key, value, min(0.5, text_confidence(text)), quote=text.strip()[:200])


# --- applying fills ----------------------------------------------------------------------


def _norm(text: str) -> str:
    text = text.replace("“", '"').replace("”", '"').replace("’", "'")
    return " ".join(text.lower().split()).strip(" .,!?;:\"'")


def quote_in(quote: str, answer: str) -> bool:
    q = _norm(quote)
    return bool(q) and q in _norm(answer)


def apply_fills(
    card: str,
    path: str,
    slots: Slots,
    fills: list[Fill],
    *,
    target: str,
    answer_text: str | None,
    is_followup: bool,
) -> tuple[Slots, list[str]]:
    """Merge fills into a copy of the card's slots. Returns the new slots and the accepted keys.

    Rules: only this card's slots; values must fit the slot; a model fill whose quote is not in the
    answer is capped at 0.5; a user's own choice is never overwritten by the model; another slot is
    only replaced by a more confident fill. The target slot always ends up with a value, so the
    engine cannot ask the same question forever.
    """
    applicable = {s.key for s in slots_for(card, path)} | DERIVED_SLOTS.get(card, frozenset())
    out = copy.deepcopy(slots)
    accepted: list[str] = []
    for f in fills:
        if f.slot not in applicable:
            continue
        try:
            value = validate_slot_value(f.slot, f.value)
        except ValueError:
            continue
        conf = min(1.0, max(0.0, f.confidence))
        if f.source == "llm" and not (f.quote and answer_text and quote_in(f.quote, answer_text)):
            conf = min(conf, 0.5)
        existing = out.get(f.slot)
        if existing and existing.get("source") == "user" and f.source == "llm":
            continue
        if existing and f.slot != target and existing.get("confidence", 0) >= conf:
            continue
        out[f.slot] = {
            "value": value,
            "confidence": conf,
            "quote": f.quote[:200] if f.quote else None,
            "source": f.source,
            "followups": existing.get("followups", 0) if existing else 0,
        }
        accepted.append(f.slot)

    if target not in accepted and answer_text and target not in out:
        fb = fallback_fill(SLOTS_BY_KEY[target], answer_text)
        out[target] = {"value": validate_slot_value(target, fb.value), "confidence": fb.confidence,
                       "quote": fb.quote, "source": "user", "followups": 0}
        accepted.append(target)
    if is_followup and target in out:
        out[target]["followups"] = out[target].get("followups", 0) + 1
    return out, accepted


def skip(card: str, path: str, slots: Slots, target: str) -> Slots:
    spec = next((s for s in slots_for(card, path) if s.key == target), None)
    if spec is None:
        raise AnswerError("Unknown question.")
    if spec.required:
        raise AnswerError("This question cannot be skipped.")
    out = copy.deepcopy(slots)
    out[target] = {"skipped": True, "confidence": 0.0, "source": "user", "followups": 0}
    return out


# --- card states -------------------------------------------------------------------------


@dataclass(frozen=True)
class GoalFacts:
    """What the engine needs to know to place every card. Built by the service from the DB."""

    days_since_start: int
    completed: frozenset[str] = frozenset()
    feasibility: str | None = None  # latest calibration status
    plan: Literal["none", "building", "ready", "failed"] = "none"
    window_days_left: int | None = None
    drafted: frozenset[str] = frozenset()
    draft_failed: frozenset[str] = frozenset()
    presence_opt_in: bool = False
    # Billing features the user has (legacy and presence need the Full tier).
    entitled: frozenset[str] = field(default_factory=frozenset)


@dataclass(frozen=True)
class CardStatus:
    state: CardState
    reason: str = ""  # token: after_goal, after_reality, not_needed, tradeoffs, after_plan,
    # day:<n>, tier, opt_in, plan_failed, window_ending, draft_failed
    unlocks_in_days: int | None = None


WINDOW_ENDING_DAYS = 2


def card_states(f: GoalFacts) -> dict[str, CardStatus]:
    out: dict[str, CardStatus] = {}
    goal_done = "goal" in f.completed
    reality_done = "reality" in f.completed
    tradeoffs_done = "tradeoffs" in f.completed
    needs_tradeoff = f.feasibility in ("stretch", "tradeoff")

    out["goal"] = CardStatus("active" if goal_done else "needs_input")

    if not goal_done:
        out["reality"] = CardStatus("locked", "after_goal")
    else:
        out["reality"] = CardStatus("active" if reality_done else "needs_input")

    if tradeoffs_done:
        out["tradeoffs"] = CardStatus("active")
    elif not reality_done or f.feasibility is None:
        out["tradeoffs"] = CardStatus("locked", "after_reality")
    elif needs_tradeoff:
        out["tradeoffs"] = CardStatus("needs_input")
    else:
        out["tradeoffs"] = CardStatus("locked", "not_needed")

    if not reality_done:
        out["plan"] = CardStatus("locked", "after_reality")
    elif needs_tradeoff and not tradeoffs_done and f.plan != "ready":
        out["plan"] = CardStatus("locked", "tradeoffs")
    elif f.plan == "failed":
        out["plan"] = CardStatus("needs_review", "plan_failed")
    elif f.plan == "ready":
        ending = f.window_days_left is not None and f.window_days_left <= WINDOW_ENDING_DAYS
        out["plan"] = CardStatus("needs_review", "window_ending") if ending else CardStatus("active")
    else:
        out["plan"] = CardStatus("calibrating")

    for key in DRAFT_CARDS:
        out[key] = _draft_status(key, f)
    return out


def _draft_status(key: str, f: GoalFacts) -> CardStatus:
    spec = CARDS[key]
    if key in f.drafted:
        return CardStatus("active")
    if spec.feature and spec.feature not in f.entitled:
        return CardStatus("locked", "tier")
    day = spec.unlock_day
    opted_in = key == "presence" and f.presence_opt_in
    if day is not None and f.days_since_start < day and not opted_in:
        reason = "opt_in" if key == "presence" else f"day:{day}"
        return CardStatus("locked", reason, unlocks_in_days=day - f.days_since_start)
    if f.plan != "ready":
        return CardStatus("locked", "after_plan")
    if key in f.draft_failed:
        return CardStatus("needs_review", "draft_failed")
    return CardStatus("calibrating")


def next_state(current: CardState | None, target: CardStatus) -> CardStatus:
    """Cards never go back to locked once opened (a tier downgrade keeps a drafted card)."""
    if current not in (None, "locked") and target.state == "locked":
        return CardStatus(current, "")
    return target
