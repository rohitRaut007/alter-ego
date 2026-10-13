"""Assemble the mentor's context: pinned protocol summary, selected facts, rolling summaries,
and the last few raw messages. The full history is never sent."""

import re
from typing import Any

from django.conf import settings

from core import clock
from daily_os.services import get_sprint, progress_snapshot
from knowledge.models import ReadingStatus
from knowledge.services import active_items
from protocol.services import current_sections

from .models import FactKind, MemoryFact, MentorMessage, MentorThread, ThreadSummary

RECENT_MESSAGES = 6
MAX_FACTS = 6
SUMMARY_EVERY = 8


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{3,}", text.lower()))


def retrieve_facts(user, query: str, k: int = MAX_FACTS) -> list[MemoryFact]:
    """Always include active commitments, then rank the rest by overlap with the message.

    Lexical on purpose for local SQLite; the interface is the same when pgvector replaces it.
    """
    facts = list(MemoryFact.objects.filter(user=user).order_by("-created_at")[:60])
    words = _tokens(query)
    must = [f for f in facts if f.kind == FactKind.COMMITMENT][:3]
    rest = [f for f in facts if f not in must]
    rest.sort(key=lambda f: (-len(words & _tokens(f.text)), -f.created_at.timestamp()))
    chosen = (must + rest)[:k]
    now = clock.now()
    MemoryFact.objects.filter(pk__in=[f.pk for f in chosen]).update(last_used_at=now)
    return chosen


def build_payload(user, thread: MentorThread, message: str) -> dict[str, Any]:
    sprint = get_sprint(user)
    sections = current_sections(sprint.protocol)
    today = clock.local_today(user)
    snap = progress_snapshot(user, sprint, today)

    items = list(active_items(user, sprint.protocol))
    current = next((i for i in items if i.status == ReadingStatus.READING), None)
    snap["reading"] = {
        "current_title": current.title if current else None,
        "current_progress": current.progress if current else None,
        "finished": sum(1 for i in items if i.status == ReadingStatus.FINISHED),
    }

    identity = sections["identity"].content
    traits = sections["character"].content["traits"]
    try:
        personality = user.personality.scores
    except Exception:  # noqa: BLE001 - optional context
        personality = None

    summaries = list(ThreadSummary.objects.filter(thread=thread)[:2])
    recent = list(MentorMessage.objects.filter(thread=thread).order_by("-created_at")[:RECENT_MESSAGES])
    recent.reverse()

    return {
        "persona": {"name": settings.MENTOR_PERSONA_NAME},
        "user": {
            "display_name": user.display_name,
            "alter_ego_name": identity["alter_ego_name"],
            "identity_statement": identity["identity_statement"],
            "timezone": user.timezone,
        },
        "protocol": {
            "mission": sections["mission"].content["statement"],
            "sprint_goal": sections["sprint_90"].content["goal"],
            "traits": [{"name": t["name"], "statement": t["statement"],
                        "failure_mode": t["failure_mode"]} for t in traits],
        },
        "progress": snap,
        "personality": personality,
        "facts": [{"kind": f.kind, "text": f.text} for f in retrieve_facts(user, message)],
        "summaries": [s.text for s in summaries],
        "recent_messages": [{"role": m.role, "content": m.body} for m in recent],
        "message": message,
    }
