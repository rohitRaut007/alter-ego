"""Character Builder logic: practice logging, streaks, trait ratings and monthly reflections."""

from datetime import date, timedelta
from typing import Any

from django.db import transaction

from analytics.models import EventName
from analytics.services import track
from core import clock

from .models import Cadence, Practice, PracticeLog, Trait, TraitRating, TraitReflection
from .streaks import streak_stats

RATING_OFFSETS = (0, 14, 30)
HISTORY_DAYS = 14


class CharacterError(Exception):
    """Request conflicts with current state (maps to HTTP 409)."""


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def active_traits(user, protocol=None):
    qs = Trait.objects.filter(user=user, archived_at__isnull=True)
    return qs.filter(protocol=protocol) if protocol is not None else qs


def _done_dates(practice_ids: list, user) -> dict[Any, set[date]]:
    out: dict[Any, set[date]] = {pid: set() for pid in practice_ids}
    rows = PracticeLog.objects.filter(user=user, practice_id__in=practice_ids, done=True)
    for pid, d in rows.values_list("practice_id", "date"):
        out[pid].add(d)
    return out


def practices_overview(user, protocol, on: date) -> list[dict[str, Any]]:
    """Every active practice with its streak, today's state and a 14-day history."""
    practices = list(
        Practice.objects.filter(
            trait__user=user, trait__protocol=protocol, trait__archived_at__isnull=True,
            archived_at__isnull=True,
        ).select_related("trait")
    )
    dates = _done_dates([p.id for p in practices], user)
    week_start = _monday(on)
    out = []
    for p in practices:
        ds = dates[p.id]
        current, best = streak_stats(ds, on, p.cadence)
        done_today = on in ds
        done_week = any(week_start <= d <= on for d in ds)
        out.append({
            "id": p.id,
            "trait_id": p.trait_id,
            "trait_name": p.trait.name,
            "description": p.description,
            "cadence": p.cadence,
            "minutes": p.minutes,
            "streak": current,
            "best_streak": best,
            "done_today": done_today,
            "done_this_week": done_week,
            "due_today": (not done_week) if p.cadence == Cadence.WEEKLY else True,
            "history": [(on - timedelta(days=HISTORY_DAYS - 1 - i)) in ds
                        for i in range(HISTORY_DAYS)],
        })
    return out


def overall_practice_streak(user, on: date) -> tuple[int, int]:
    dates = set(
        PracticeLog.objects.filter(user=user, done=True).values_list("date", flat=True)
    )
    return streak_stats(dates, on, "daily")


def log_practice(user, practice: Practice, on: date, done: bool) -> PracticeLog:
    today = clock.local_today(user)
    if not (today - timedelta(days=1) <= on <= today):
        raise CharacterError("Practice can only be logged for today or yesterday.")
    log, created = PracticeLog.objects.update_or_create(
        practice=practice, date=on, defaults={"user": user, "done": done}
    )
    if done and created:
        # Re-marking the same day after an undo does not count twice.
        track(user, EventName.PRACTICE_COMPLETED,
              {"trait_id": str(practice.trait_id), "cadence": practice.cadence})
    return log


def trait_overview(user, protocol, on: date, sprint_start: date) -> list[dict[str, Any]]:
    traits = list(active_traits(user, protocol).prefetch_related("ratings"))
    practices = practices_overview(user, protocol, on)
    by_trait: dict[Any, list[dict[str, Any]]] = {}
    for p in practices:
        by_trait.setdefault(p["trait_id"], []).append(p)
    days_in = (on - sprint_start).days
    month = f"{on.year}-{on.month:02d}"
    reflected = set(
        TraitReflection.objects.filter(user=user, month=month).values_list("trait_id", flat=True)
    )
    out = []
    for t in traits:
        ps = by_trait.get(t.id, [])
        rated = {r.day_offset: r.score for r in t.ratings.all()}
        due = [o for o in RATING_OFFSETS if o <= days_in and o not in rated]
        out.append({
            "id": t.id,
            "name": t.name,
            "statement": t.statement,
            "rationale": t.rationale,
            "failure_mode": t.failure_mode,
            "reflection_prompt": t.monthly_reflection_prompt,
            "practices": ps,
            "streak": max((p["streak"] for p in ps), default=0),
            "ratings": [{"day_offset": o, "score": s} for o, s in sorted(rated.items())],
            "rating_due_offset": due[0] if due else None,
            "reflection_done_this_month": t.id in reflected,
        })
    return out


@transaction.atomic
def submit_rating(user, trait: Trait, day_offset: int, score: int, note: str | None) -> TraitRating:
    if day_offset not in RATING_OFFSETS:
        raise CharacterError(f"Ratings are taken at day {', '.join(map(str, RATING_OFFSETS))}.")
    if TraitRating.objects.filter(trait=trait, day_offset=day_offset).exists():
        raise CharacterError("This check-in has already been recorded.")
    rating = TraitRating.objects.create(
        trait=trait, user=user, day_offset=day_offset, score=score, note=note or None
    )
    track(user, EventName.TRAIT_RATING_SUBMITTED, {"day": day_offset, "score": score})
    return rating


def submit_reflection(user, trait: Trait, text: str) -> TraitReflection:
    today = clock.local_today(user)
    month = f"{today.year}-{today.month:02d}"
    reflection, _ = TraitReflection.objects.update_or_create(
        trait=trait, month=month, defaults={"user": user, "text": text}
    )
    return reflection
