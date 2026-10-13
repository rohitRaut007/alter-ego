"""Mentor conversation: persistence, safety, memory extraction, rolling summaries."""

import logging
from collections.abc import Iterator
from dataclasses import dataclass

from django.db import transaction

from analytics.models import EventName
from analytics.services import track
from core import clock
from safety.services import SafetyNotice, screen

from .context import SUMMARY_EVERY, build_payload
from .llm.service import LLMService, get_llm_service
from .models import (
    FactKind,
    MemoryFact,
    MentorMessage,
    MentorThread,
    MessageRole,
    ThreadStatus,
    ThreadSummary,
)

log = logging.getLogger(__name__)

MAX_MESSAGE_CHARS = 4000


class ChatError(Exception):
    """Conflicts with current state (maps to HTTP 409)."""


@dataclass
class Turn:
    """Result of preparing a user message: either a safety stop, or a reply stream."""

    safety: SafetyNotice | None = None
    user_message: MentorMessage | None = None
    chunks: Iterator[str] | None = None
    finalize: "callable | None" = None  # type: ignore[valid-type]


def create_thread(user, kind: str = "chat") -> MentorThread:
    return MentorThread.objects.create(user=user, kind=kind)


def begin_turn(user, thread: MentorThread, text: str, llm: LLMService | None = None) -> Turn:
    """Validate and screen the message, persist it, and return the reply stream.

    Flagged text is never stored, never sent to a model, and pauses the thread.
    """
    llm = llm or get_llm_service()
    text = text.strip()
    if not text:
        raise ChatError("Message cannot be empty.")
    if len(text) > MAX_MESSAGE_CHARS:
        raise ChatError(f"Message is too long (max {MAX_MESSAGE_CHARS} characters).")
    if thread.status == ThreadStatus.PAUSED_SAFETY:
        raise ChatError("This conversation is paused. Resume it to continue.")

    notice = screen(user, text, "mentor")
    if notice is not None:
        thread.status = ThreadStatus.PAUSED_SAFETY
        thread.save(update_fields=["status"])
        return Turn(safety=notice)

    payload = build_payload(user, thread, text)
    user_msg = MentorMessage.objects.create(thread=thread, role=MessageRole.USER, body=text)
    if not thread.title:
        thread.title = " ".join(text.split())[:60]
    track(user, EventName.MENTOR_MESSAGE_SENT)

    parts: list[str] = []

    def stream() -> Iterator[str]:
        for chunk in llm.stream_text(user=user, task="mentor_reply", payload=payload):
            parts.append(chunk)
            yield chunk

    def finalize() -> MentorMessage:
        reply = MentorMessage.objects.create(
            thread=thread, role=MessageRole.MENTOR, body="".join(parts),
            prompt_version="v1", model=llm.client.model_name,
        )
        thread.updated_at = clock.now()
        thread.save(update_fields=["title", "updated_at"])
        _remember(user, thread, text, llm)
        _maybe_summarise(user, thread, llm)
        return reply

    return Turn(user_message=user_msg, chunks=stream(), finalize=finalize)


def run_turn(user, thread: MentorThread, text: str, llm: LLMService | None = None) -> Turn:
    """Non-streaming convenience: consume the stream and finalise."""
    turn = begin_turn(user, thread, text, llm)
    if turn.safety is None:
        for _ in turn.chunks:  # type: ignore[union-attr]
            pass
        turn.finalize()  # type: ignore[misc]
    return turn


def resume(thread: MentorThread) -> MentorThread:
    thread.status = ThreadStatus.OPEN
    thread.save(update_fields=["status"])
    return thread


# --- memory -------------------------------------------------------------------------------


def _remember(user, thread: MentorThread, text: str, llm: LLMService) -> None:
    """Extract durable facts from the user's message. Never lets a failure break the chat."""
    try:
        known = [f.text for f in MemoryFact.objects.filter(user=user)[:40]]
        res = llm.run_json(user=user, task="memory_extract",
                           payload={"message": text, "known_facts": known})
        for f in res.data.get("facts", [])[:3]:
            kind = f.get("kind")
            body = str(f.get("text", "")).strip()
            if kind in FactKind.values and body and body not in known:
                MemoryFact.objects.create(
                    user=user, kind=kind, text=body, source_thread=thread,
                    confidence=float(f.get("confidence", 0.7)),
                )
    except Exception:  # noqa: BLE001
        log.warning("memory extraction failed", extra={"event": "mentor.memory_failed"})


def _maybe_summarise(user, thread: MentorThread, llm: LLMService) -> None:
    total = thread.messages.count()
    if total == 0 or total % SUMMARY_EVERY != 0:
        return
    try:
        last = thread.summaries.first()
        recent = list(thread.messages.order_by("-created_at")[:SUMMARY_EVERY])
        recent.reverse()
        res = llm.run_json(user=user, task="thread_summary", payload={
            "previous_summary": last.text if last else None,
            "messages": [{"role": m.role, "content": m.body} for m in recent],
        })
        with transaction.atomic():
            ThreadSummary.objects.create(
                thread=thread, text=str(res.data.get("summary", "")), covers_messages=total
            )
    except Exception:  # noqa: BLE001
        log.warning("thread summary failed", extra={"event": "mentor.summary_failed"})
