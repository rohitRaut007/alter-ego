"""Distress and crisis detection for free-text user input.

This is a deliberately conservative floor, not a clinical tool: it favours false positives
(a redirect the user can dismiss) over missing real distress. The `Classifier` interface lets a
model-based classifier be layered in later without touching callers.
"""

import re
from dataclasses import dataclass
from typing import Literal, Protocol

Category = Literal["crisis", "distress"]


@dataclass(frozen=True)
class SafetyResult:
    category: Category


class Classifier(Protocol):
    def classify(self, text: str) -> SafetyResult | None: ...


def _normalise(text: str) -> str:
    text = text.lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", text).strip()


_CRISIS = [
    r"\bsuicid(e|al)\b",
    r"\bkill(ing)? my ?self\b",
    r"\bend(ing)? my (own )?life\b",
    r"\bend(ing)? it all\b",
    r"\btake my own life\b",
    r"\bwant(ed|s)? to die\b",
    r"\bwish i (was|were) dead\b",
    r"\b(don'?t|do not) want to (be alive|live|exist|be here)( anymore)?\b",
    r"\bno (reason|point) (in |to )?(living|live|go on|going on|be alive)\b",
    r"\bbetter off (dead|without me)\b",
    r"\b(hurt|harm|cut|injure)(ing)? my ?self\b",
    r"\bself[- ]?harm(ing)?\b",
    r"\bkill (him|her|them|someone|people)\b",
    r"\bcan'?t go on\b",
]

_DISTRESS = [
    r"\bpanic attacks?\b",
    r"\bcan'?t (stop crying|breathe|cope|eat|sleep|function)\b",
    r"\bhopeless(ness)?\b",
    r"\bworthless\b",
    r"\bdepress(ed|ion)\b",
    r"\bfalling apart\b",
    r"\bbreaking down\b",
    r"\bnervous breakdown\b",
    r"\bcan'?t take (it|this) anymore\b",
    r"\bi hate my ?self\b",
    r"\b(burden|waste) (to|of) (everyone|everybody|space)\b",
    r"\bhaven'?t (slept|eaten) in (days|\d+ days)\b",
    r"\bcompletely (numb|broken)\b",
]

_CRISIS_RE = [re.compile(p) for p in _CRISIS]
_DISTRESS_RE = [re.compile(p) for p in _DISTRESS]


class KeywordClassifier:
    def classify(self, text: str) -> SafetyResult | None:
        if not text or not text.strip():
            return None
        norm = _normalise(text)
        if any(p.search(norm) for p in _CRISIS_RE):
            return SafetyResult("crisis")
        if any(p.search(norm) for p in _DISTRESS_RE):
            return SafetyResult("distress")
        return None
