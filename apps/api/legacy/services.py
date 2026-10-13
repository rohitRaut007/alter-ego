"""Legacy timeline: milestones at 2-year, 5-year and life horizons, and quarterly reviews."""

from datetime import date, timedelta
from typing import Any

from django.db import transaction

from core import clock
from protocol.models import Protocol
from protocol.services import current_sections

from .models import Horizon, LegacyMilestone, MilestoneOrigin, QuarterlyReview

DUE_LABEL = {Horizon.TWO_YEAR: "Within two years", Horizon.FIVE_YEAR: "Within five years",
             Horizon.LIFE: "A lifetime"}


class LegacyError(Exception):
    """Conflicts with current state (maps to HTTP 409)."""


@transaction.atomic
def sync_milestones(protocol: Protocol) -> None:
    """Materialise protocol milestones and their evidence checkpoints. User state is preserved."""
    section = current_sections(protocol).get("legacy")
    if section is None:
        return
    now = clock.now()
    wanted: dict[str, dict[str, Any]] = {}
    for m in section.content["milestones"]:
        h = m["horizon"]
        wanted[f"{h}#statement"] = {
            "horizon": h, "title": m["statement"], "position": 0,
            "detail": "Leading indicators: " + "; ".join(m["leading_indicators"]),
        }
        for i, ev in enumerate(m["evidence_of_progress"], start=1):
            wanted[f"{h}#e{i}"] = {"horizon": h, "title": ev, "position": i, "detail": ""}
    for key, w in wanted.items():
        LegacyMilestone.objects.update_or_create(
            protocol=protocol, source_id=key, origin=MilestoneOrigin.PROTOCOL,
            defaults={
                "user": protocol.user, "horizon": w["horizon"], "title": w["title"],
                "detail": w["detail"], "position": w["position"],
                "due_label": DUE_LABEL[w["horizon"]], "archived_at": None,
            },
        )
    for ms in LegacyMilestone.objects.filter(
        protocol=protocol, origin=MilestoneOrigin.PROTOCOL, archived_at__isnull=True
    ):
        if ms.source_id in wanted:
            continue
        if ms.progress == 0 and ms.done_at is None:
            ms.delete()
        else:
            ms.archived_at = now
            ms.save(update_fields=["archived_at"])


def active(user):
    return LegacyMilestone.objects.filter(user=user, archived_at__isnull=True)


def add_milestone(user, protocol: Protocol | None, *, title: str, horizon: str,
                  detail: str = "", due_label: str = "") -> LegacyMilestone:
    if horizon not in Horizon.values:
        raise LegacyError("Unknown horizon.")
    position = active(user).filter(horizon=horizon).count()
    return LegacyMilestone.objects.create(
        user=user, protocol=protocol, origin=MilestoneOrigin.USER, horizon=horizon,
        title=title, detail=detail, due_label=due_label or DUE_LABEL[horizon], position=position,
    )


def update_milestone(ms: LegacyMilestone, *, done: bool | None, progress: int | None,
                     title: str | None, detail: str | None) -> LegacyMilestone:
    if progress is not None:
        ms.progress = max(0, min(100, progress))
    if done is True:
        ms.done_at = ms.done_at or clock.now()
        ms.progress = 100
    elif done is False:
        ms.done_at = None
        if ms.progress == 100:
            ms.progress = 0
    if title is not None:
        ms.title = title
    if detail is not None:
        ms.detail = detail
    ms.save()
    return ms


def summary(user) -> dict[str, int]:
    items = list(active(user))
    return {
        "total": len(items),
        "done": sum(1 for m in items if m.done_at),
        "average_progress": round(sum(m.progress for m in items) / len(items)) if items else 0,
    }


def next_quarter_end(today: date) -> date:
    q_end_month = ((today.month - 1) // 3 + 1) * 3
    first_next = date(today.year + (q_end_month // 12), (q_end_month % 12) + 1, 1)
    last = first_next - timedelta(days=1)
    return last if last > today else next_quarter_end(first_next)


def schedule_review(user, when: date | None) -> QuarterlyReview:
    today = clock.local_today(user)
    target = when or next_quarter_end(today)
    if target < today:
        raise LegacyError("Pick a date that is not in the past.")
    existing = QuarterlyReview.objects.filter(
        user=user, completed_at__isnull=True, scheduled_for=target
    ).first()
    return existing or QuarterlyReview.objects.create(user=user, scheduled_for=target)


def complete_review(review: QuarterlyReview, answers: dict[str, str]) -> QuarterlyReview:
    if review.completed_at is not None:
        raise LegacyError("This review is already complete.")
    review.answers = answers
    review.completed_at = clock.now()
    review.save(update_fields=["answers", "completed_at"])
    return review
