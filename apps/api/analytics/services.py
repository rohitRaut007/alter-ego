import re
from typing import Any

from accounts.models import ConsentPurpose, User, has_consent

from .models import EventName, EventOutbox

_KEY = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
# Short token-like strings only (enums, ids). Anything sentence-like is rejected.
_TOKEN = re.compile(r"^[A-Za-z0-9_.:-]{1,40}$")


def _validate_props(props: dict[str, Any]) -> None:
    for key, value in props.items():
        if not _KEY.match(key):
            raise ValueError(f"Invalid analytics property name: {key!r}")
        if isinstance(value, (bool, int, float)) or value is None:
            continue
        if isinstance(value, str) and _TOKEN.match(value):
            continue
        raise ValueError(f"Analytics property {key!r} must be a number, bool or short token")


def track(user: User, name: EventName, props: dict[str, Any] | None = None) -> EventOutbox | None:
    """Queue an analytics event if the user has granted analytics consent.

    Raises ValueError for unknown event names or properties that could carry free text.
    """
    name = EventName(name)
    props = props or {}
    _validate_props(props)
    if not has_consent(user, ConsentPurpose.ANALYTICS):
        return None
    return EventOutbox.objects.create(name=name, user=user, props=props)
