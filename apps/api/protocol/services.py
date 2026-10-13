"""Interview, generation and revision logic. Views and tasks stay thin."""

import logging
from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.utils.timezone import now
from pydantic import ValidationError

from accounts.models import User
from analytics.models import EventName
from analytics.services import track
from mentor.llm.service import LLMService, get_llm_service

from .models import (
    Interview,
    InterviewStatus,
    InterviewTurn,
    Protocol,
    ProtocolEvent,
    ProtocolSection,
    ProtocolStatus,
)
from .schema.v1 import (
    DISCLAIMER,
    SCHEMA_VERSION,
    SECTION_KEYS,
    SECTION_MODELS,
    ProtocolDocument,
    find_banned_phrases,
)

log = logging.getLogger(__name__)

REVIEW_FIRST_N = 500
MAX_ATTEMPTS = 3  # first try plus two retries with the validation error fed back
MAX_ANSWER_CHARS = 4000


class InterviewError(Exception):
    pass


@dataclass(frozen=True)
class NextStep:
    """What the client should show next: a question, or the end of the interview."""

    turn: InterviewTurn | None
    acknowledgement: str
    progress: float
    done: bool


class SectionGenerationError(Exception):
    pass


# --- interview --------------------------------------------------------------


def _history(interview: Interview) -> list[dict[str, str]]:
    return [
        {"stage": t.stage, "question": t.question, "answer": t.answer or ""}
        for t in interview.turns.all()
        if t.answer
    ]


def _ask_next(interview: Interview, llm: LLMService) -> NextStep:
    """Create the next pending question, or mark the interview ready when the model is done."""
    history = _history(interview)
    result = llm.run_json(
        user=interview.user,
        task="interview_turn",
        payload={
            "display_name": interview.user.display_name,
            "answers": history,
            "min_questions": 5,
        },
    )
    interview.prompt_version = result.prompt_version
    data = result.data
    ack = str(data.get("acknowledgement", ""))[:300]
    if data.get("done") and history:
        interview.ready_to_complete = True
        interview.save(update_fields=["ready_to_complete", "prompt_version"])
        return NextStep(turn=None, acknowledgement=ack, progress=1.0, done=True)
    progress = min(1.0, max(0.0, float(data.get("progress", 0))))
    turn = InterviewTurn.objects.create(
        interview=interview,
        idx=interview.turns.count(),
        stage=str(data["stage"])[:64],
        question=str(data["question"]),
        suggestions=[str(s)[:80] for s in data.get("suggestions", [])][:6],
        multi_select=bool(data.get("multi_select", False)),
        placeholder=str(data.get("placeholder", ""))[:200],
        acknowledgement=ack,
        progress=progress,
    )
    interview.save(update_fields=["prompt_version"])
    return NextStep(turn=turn, acknowledgement=ack, progress=progress, done=False)


def pending_turn(interview: Interview) -> InterviewTurn | None:
    return interview.turns.filter(answer__isnull=True).order_by("idx").first()


def step_for(interview: Interview) -> NextStep:
    """Describe the current state of an interview without calling the model."""
    turn = pending_turn(interview)
    if turn is not None:
        return NextStep(turn=turn, acknowledgement=turn.acknowledgement,
                        progress=turn.progress, done=False)
    return NextStep(turn=None, acknowledgement="", progress=1.0,
                    done=interview.ready_to_complete)


@transaction.atomic
def start_interview(user: User, llm: LLMService | None = None) -> tuple[Interview, NextStep]:
    """Resume the open interview, or begin a new one."""
    llm = llm or get_llm_service()
    existing = (
        Interview.objects.filter(user=user, status=InterviewStatus.IN_PROGRESS)
        .order_by("-started_at")
        .first()
    )
    if existing:
        return existing, step_for(existing)
    interview = Interview.objects.create(user=user)
    track(user, EventName.ONBOARDING_STARTED)
    return interview, _ask_next(interview, llm)


@transaction.atomic
def submit_answer(interview: Interview, answer: str, llm: LLMService | None = None) -> NextStep:
    """Record the answer to the pending question and return what comes next."""
    llm = llm or get_llm_service()
    if interview.status != InterviewStatus.IN_PROGRESS:
        raise InterviewError("Interview is already completed.")
    turn = pending_turn(interview)
    if turn is None:
        raise InterviewError("There is no open question to answer.")
    answer = answer.strip()
    if not answer:
        raise InterviewError("Answer cannot be empty.")
    if len(answer) > MAX_ANSWER_CHARS:
        raise InterviewError(f"Answer is too long (max {MAX_ANSWER_CHARS} characters).")
    turn.answer = answer
    turn.answered_at = now()
    turn.save(update_fields=["answer", "answered_at"])
    return _ask_next(interview, llm)


# --- generation -------------------------------------------------------------


def emit(protocol: Protocol, type_: str, **data: Any) -> ProtocolEvent:
    return ProtocolEvent.objects.create(protocol=protocol, type=type_, data=data)


def create_protocol(interview: Interview) -> tuple[Protocol, bool]:
    """Create the protocol for a finished interview. Returns (protocol, created)."""
    if interview.status == InterviewStatus.COMPLETED and hasattr(interview, "protocol"):
        return interview.protocol, False
    if not interview.ready_to_complete:
        raise InterviewError("The interview is not finished yet.")
    with transaction.atomic():
        interview.status = InterviewStatus.COMPLETED
        interview.completed_at = now()
        interview.save(update_fields=["status", "completed_at"])
        protocol = Protocol.objects.create(
            user=interview.user,
            interview=interview,
            schema_version=SCHEMA_VERSION,
            review_required=Protocol.objects.count() < REVIEW_FIRST_N,
        )
        track(interview.user, EventName.INTERVIEW_COMPLETED)
    return protocol, True


def _generate_section(
    llm: LLMService,
    user: User,
    key: str,
    base_payload: dict[str, Any],
    task: str = "protocol_section",
) -> tuple[dict[str, Any], str, str]:
    """Call the model, validate against the section schema, retry with the error fed back."""
    model_cls = SECTION_MODELS[key]
    payload = {**base_payload, "validation_error": None}
    last_error = ""
    for _ in range(MAX_ATTEMPTS):
        result = llm.run_json(user=user, task=task, payload=payload)
        try:
            parsed = model_cls.model_validate(result.data)
            content = parsed.model_dump(mode="json", exclude_none=True)
            banned = find_banned_phrases(content)
            if banned:
                raise ValueError(f"Outcome-promising language is not allowed: {sorted(set(banned))}")
            return content, result.prompt_version, result.model
        except (ValidationError, ValueError) as exc:
            last_error = str(exc)[:600]
            payload = {**base_payload, "validation_error": last_error}
    raise SectionGenerationError(f"{key}: {last_error}")


def current_sections(protocol: Protocol) -> dict[str, ProtocolSection]:
    latest: dict[str, ProtocolSection] = {}
    for s in protocol.sections.order_by("key", "revision"):
        latest[s.key] = s
    return latest


def assemble_document(protocol: Protocol) -> dict[str, Any]:
    sections = {k: s.content for k, s in current_sections(protocol).items()}
    doc: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": (protocol.completed_at or now()).isoformat(),
        "identity": sections["identity"],
        "character": sections["character"],
        "knowledge": sections["knowledge"],
        "mission": sections["mission"],
        "daily_os": sections["daily_os"],
        "presence": sections["presence"],
        "legacy": sections["legacy"],
        "checklist_30": sections["checklist_30"]["tasks"],
        "sprint_90": sections["sprint_90"],
        "disclaimer": DISCLAIMER,
    }
    return ProtocolDocument.model_validate(doc).model_dump(mode="json", exclude_none=True)


def run_generation(protocol_id: str, llm: LLMService | None = None) -> None:
    """Generate every section, publishing progress events as each one lands."""
    protocol = Protocol.objects.select_related("user", "interview").get(pk=protocol_id)
    if protocol.status != ProtocolStatus.GENERATING:
        return
    llm = llm or get_llm_service()
    user = protocol.user
    answers = _history(protocol.interview)  # type: ignore[arg-type]
    total = len(SECTION_KEYS)
    done = {s.key for s in protocol.sections.all()}  # resume after a worker restart
    previous: dict[str, Any] = {s.key: s.content for s in protocol.sections.all()}
    try:
        for key in SECTION_KEYS:
            if key in done:
                continue
            content, prompt_version, model = _generate_section(
                llm,
                user,
                key,
                {
                    "section": key,
                    "display_name": user.display_name,
                    "answers": answers,
                    "previous_sections": previous,
                },
            )
            ProtocolSection.objects.create(
                protocol=protocol, key=key, revision=1, content=content,
                prompt_version=prompt_version, model=model,
            )
            previous[key] = content
            protocol.prompt_version, protocol.model = prompt_version, model
            emit(protocol, "section.ready", key=key, revision=1)
            emit(protocol, "progress", done=len(previous), total=total)
        protocol.completed_at = now()
        assemble_document(protocol)  # whole-document validation before we call it ready
        protocol.status = ProtocolStatus.READY
        protocol.save(update_fields=["status", "completed_at", "prompt_version", "model"])
        track(user, EventName.PROTOCOL_GENERATED, {"schema": SCHEMA_VERSION,
                                                    "prompt": protocol.prompt_version})
        emit(protocol, "done")
    except Exception as exc:
        code = "validation" if isinstance(exc, (SectionGenerationError, ValidationError)) else "internal"
        log.warning("protocol generation failed", extra={"event": "protocol.failed",
                                                          "user_id": str(user.id)})
        protocol.status = ProtocolStatus.FAILED
        protocol.failure_code = code
        protocol.save(update_fields=["status", "failure_code"])
        emit(protocol, "error", code=code)


# --- revision ---------------------------------------------------------------


@transaction.atomic
def revise_section(
    protocol: Protocol, key: str, instruction: str, llm: LLMService | None = None
) -> ProtocolSection:
    """Revise one section from a conversational instruction. Other sections are untouched."""
    if key not in SECTION_MODELS:
        raise InterviewError("Unknown section.")
    if protocol.status != ProtocolStatus.READY:
        raise InterviewError("The protocol is not ready to revise.")
    llm = llm or get_llm_service()
    sections = current_sections(protocol)
    current = sections[key]
    base = {
        "section": key,
        "instruction": instruction,
        "current": current.content,
        "other_sections": {k: s.content for k, s in sections.items() if k != key},
        "answers": _history(protocol.interview) if protocol.interview else [],
    }
    content, prompt_version, model = _generate_section(
        llm, protocol.user, key, base, task="protocol_section_revise"
    )
    revision = ProtocolSection.objects.create(
        protocol=protocol, key=key, revision=current.revision + 1, content=content,
        instruction=instruction, prompt_version=prompt_version, model=model,
    )
    assemble_document(protocol)  # the revised whole must still be valid
    return revision
