import logging
from dataclasses import dataclass

from analytics.models import EventName
from analytics.services import track

from .classifier import Classifier, KeywordClassifier
from .models import SafetyEvent
from .resources import Resource, resources_for_timezone

log = logging.getLogger("safety")

_classifier: Classifier = KeywordClassifier()

MESSAGES = {
    "crisis": (
        "What you wrote sounds like you may be going through something very painful. "
        "This is beyond what this product can help with, and you deserve support from a real "
        "person. If you might be in danger, please contact local emergency services now. "
        "You can also reach a trained listener right away. Coaching is paused for this "
        "message, and your protocol and progress are untouched."
    ),
    "distress": (
        "It sounds like things are heavy right now. This product is a system for planning and "
        "discipline, not mental health care, so I am stepping back from coaching on this. "
        "Talking with someone you trust or a professional can help, and these services are "
        "free and confidential. Your protocol and progress are untouched."
    ),
}


@dataclass(frozen=True)
class SafetyNotice:
    paused: bool
    category: str
    message: str
    resources: list[Resource]


def set_classifier(classifier: Classifier) -> None:
    """Swap the classifier (tests, or a model-based one later)."""
    global _classifier
    _classifier = classifier


def screen(user, text: str, surface: str) -> SafetyNotice | None:
    """Check user text. On a hit: record a content-free event and return the notice.

    Callers must stop coaching and must not forward, store for coaching, or log the text.
    """
    result = _classifier.classify(text)
    if result is None:
        return None
    SafetyEvent.objects.create(user=user, surface=surface, category=result.category)
    log.warning(
        f"safety boundary triggered surface={surface} category={result.category}",
        extra={"event": "safety.boundary_triggered", "user_id": str(user.id)},
    )
    track(user, EventName.SAFETY_BOUNDARY_TRIGGERED,
          {"surface": surface, "category": result.category})
    return SafetyNotice(
        paused=True,
        category=result.category,
        message=MESSAGES[result.category],
        resources=resources_for_timezone(user.timezone),
    )


def screen_all(user, texts: list[str], surface: str) -> SafetyNotice | None:
    """Screen several inputs together; the most serious category wins, one event is recorded."""
    return screen(user, "\n".join(t for t in texts if t), surface)
