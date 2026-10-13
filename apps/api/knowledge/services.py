"""Knowledge curriculum: reading list, notes, collision notebook, advisor, recommendations."""

import re
from datetime import timedelta
from typing import Any

from django.db import transaction

from core import clock
from mentor.llm.service import LLMService, get_llm_service
from protocol.models import Protocol
from protocol.services import current_sections

from .curated import BY_ID, CURATED, Source
from .models import KnowledgeNote, NoteKind, ReadingItem, ReadingStatus

MAX_ADVISOR_CANDIDATES = 6


class KnowledgeError(Exception):
    """Conflicts with current state (maps to HTTP 409)."""


@transaction.atomic
def sync_reading(protocol: Protocol) -> None:
    """Materialise the reading list. Progress and status are never overwritten."""
    section = current_sections(protocol).get("knowledge")
    if section is None:
        return
    now = clock.now()
    seen: set[str] = set()
    for r in section.content["reading_list"]:
        ReadingItem.objects.update_or_create(
            protocol=protocol,
            source_id=r["id"],
            defaults={
                "user": protocol.user,
                "sequence": r["sequence"],
                "title": r["title"],
                "author": r["author"],
                "why_now": r["why_now"],
                "estimated_hours": r["estimated_hours"],
                "archived_at": None,
            },
        )
        seen.add(r["id"])
    for item in ReadingItem.objects.filter(protocol=protocol, archived_at__isnull=True):
        if item.source_id in seen:
            continue
        if item.progress == 0 and item.status == ReadingStatus.WANT:
            item.delete()
        else:
            item.archived_at = now
            item.save(update_fields=["archived_at"])


def active_items(user, protocol: Protocol):
    return ReadingItem.objects.filter(user=user, protocol=protocol, archived_at__isnull=True)


def set_progress(item: ReadingItem, progress: int | None, status: str | None) -> ReadingItem:
    now = clock.now()
    if status is not None:
        if status not in ReadingStatus.values:
            raise KnowledgeError("Unknown status.")
        item.status = status
        if status == ReadingStatus.FINISHED:
            progress = 100
        elif status == ReadingStatus.WANT and progress is None:
            progress = 0
    if progress is not None:
        item.progress = max(0, min(100, progress))
        if item.progress >= 100:
            item.status = ReadingStatus.FINISHED
        elif item.progress > 0 and item.status == ReadingStatus.WANT:
            item.status = ReadingStatus.READING
    if item.status == ReadingStatus.READING and item.started_at is None:
        item.started_at = now
    if item.status == ReadingStatus.FINISHED and item.finished_at is None:
        item.finished_at = now
    if item.status != ReadingStatus.FINISHED:
        item.finished_at = None
    item.save()
    return item


def stats(items: list[ReadingItem], note_count: int) -> dict[str, int]:
    return {
        "reading": sum(1 for i in items if i.status == ReadingStatus.READING),
        "finished": sum(1 for i in items if i.status == ReadingStatus.FINISHED),
        "want": sum(1 for i in items if i.status == ReadingStatus.WANT),
        "notes": note_count,
        "average_progress": round(sum(i.progress for i in items) / len(items)) if items else 0,
    }


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z]{4,}", text.lower()))


def _score(source: Source, words: set[str]) -> int:
    return len(words & _tokens(f"{source.title} {source.summary} {' '.join(source.tags)}"))


def candidates_for(query: str, goal: str, owned_titles: set[str]) -> list[Source]:
    """Curated sources ranked by overlap with the question and goal, excluding what is owned."""
    words = _tokens(query) | _tokens(goal)
    pool = [s for s in CURATED if s.title.lower() not in owned_titles]
    ranked = sorted(pool, key=lambda s: (-_score(s, words), s.title))
    return ranked[:MAX_ADVISOR_CANDIDATES]


def weekly_recommendation(items: list[ReadingItem], goal: str) -> dict[str, Any] | None:
    """Finish what is open; otherwise the next sequenced title; otherwise a curated match."""
    reading = [i for i in items if i.status == ReadingStatus.READING]
    if reading:
        i = reading[0]
        return {
            "kind": "finish",
            "title": i.title,
            "author": i.author,
            "reason": i.why_now or "Focus compounds. Complete what you started before opening the next volume.",
            "item_id": i.id,
            "source_id": None,
        }
    upcoming = [i for i in items if i.status == ReadingStatus.WANT]
    if upcoming:
        i = upcoming[0]
        return {"kind": "start", "title": i.title, "author": i.author, "reason": i.why_now,
                "item_id": i.id, "source_id": None}
    owned = {i.title.lower() for i in items}
    picks = candidates_for(goal, goal, owned)
    if picks:
        s = picks[0]
        return {"kind": "discover", "title": s.title, "author": s.author, "reason": s.summary,
                "item_id": None, "source_id": s.id}
    return None


def roadmap(items: list[ReadingItem], focus_domains: list[str]) -> list[dict[str, Any]]:
    """Three horizons from the sequenced list: now, the next 90 days, this year."""
    open_items = [i for i in items if i.status != ReadingStatus.FINISHED]
    now_items = [i for i in open_items if i.status == ReadingStatus.READING] or open_items[:1]
    rest = [i for i in open_items if i not in now_items]
    domain = focus_domains[0] if focus_domains else "your domain"
    return [
        {"phase": "now", "focus": f"{domain} foundations", "titles": [i.title for i in now_items]},
        {"phase": "next_90_days", "focus": "Build on what is in progress",
         "titles": [i.title for i in rest[:2]]},
        {"phase": "this_year", "focus": "The long arc of the list", "titles": [i.title for i in rest[2:]]},
    ]


def library(user, protocol: Protocol) -> dict[str, Any]:
    items = list(active_items(user, protocol))
    note_count = KnowledgeNote.objects.filter(user=user).count()
    section = current_sections(protocol)["knowledge"].content
    goal = current_sections(protocol)["mission"].content["statement"]
    return {
        "items": items,
        "stats": stats(items, note_count),
        "recommendation": weekly_recommendation(items, goal),
        "roadmap": roadmap(items, section.get("weekly_focus_domains", [])),
        "destruction_test_template": section["destruction_test_template"],
        "sequencing_rationale": section["sequencing_rationale"],
    }


def create_note(user, *, title: str, body: str, source: str = "", tags: list[str] | None = None,
                kind: str = NoteKind.NOTE, item: ReadingItem | None = None) -> KnowledgeNote:
    if kind not in NoteKind.values:
        raise KnowledgeError("Unknown note kind.")
    clean = [t.strip().lower()[:24] for t in (tags or []) if t.strip()][:6]
    if kind == NoteKind.COLLISION and "collision" not in clean:
        clean.append("collision")
    return KnowledgeNote.objects.create(
        user=user, item=item, kind=kind, title=title, body=body, source=source, tags=clean
    )


def ask_advisor(user, protocol: Protocol, query: str,
                llm: LLMService | None = None) -> dict[str, Any]:
    """Answer from the curated set and the user's own list and notes; unknown ids are dropped."""
    llm = llm or get_llm_service()
    sections = current_sections(protocol)
    goal = sections["mission"].content["statement"]
    domain = (sections["knowledge"].content.get("weekly_focus_domains") or [""])[0]
    items = list(active_items(user, protocol))
    notes = list(KnowledgeNote.objects.filter(user=user)[:12])
    owned = {i.title.lower() for i in items}
    cands = candidates_for(query, goal, owned)
    try:
        scores = user.personality.scores
    except Exception:  # noqa: BLE001 - optional context
        scores = None
    result = llm.run_json(user=user, task="knowledge_advisor", payload={
        "query": query,
        "goal": goal,
        "domain": domain,
        "reading": [{"title": i.title, "author": i.author, "progress": i.progress,
                     "status": i.status} for i in items],
        "notes": [{"title": n.title, "body": n.body[:400]} for n in notes],
        "candidates": [{"id": c.id, "title": c.title, "author": c.author, "tags": list(c.tags),
                        "summary": c.summary} for c in cands],
        "personality": scores,
    })
    allowed = {c.id for c in cands}
    ids = [i for i in result.data.get("source_ids", []) if i in allowed]
    return {
        "answer": str(result.data.get("answer", "")),
        "sources": [
            {"id": BY_ID[i].id, "title": BY_ID[i].title, "author": BY_ID[i].author,
             "summary": BY_ID[i].summary}
            for i in ids
        ],
    }


def week_start_for(user):
    today = clock.local_today(user)
    return today - timedelta(days=today.weekday())
