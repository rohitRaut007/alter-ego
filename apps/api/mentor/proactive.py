"""Proactive mentor: rules decide *when* to speak, the model only writes the words.

Evaluated lazily when the user opens the app and in bulk by `manage.py run_proactive`
(cron-able), so no broker or scheduler is required locally. Nudges are idempotent per rule
instance via a unique dedupe key, and respect the user's `mentor_nudges` preference.
"""

import logging
from django.db import IntegrityError, transaction

from character.models import PracticeLog
from core import clock
from daily_os.models import DailyReflection
from daily_os.services import SPRINT_DAYS, get_sprint, progress_snapshot, ritual_state

from .llm.service import LLMService, get_llm_service
from .models import MentorNudge, NudgeKind

log = logging.getLogger(__name__)

QUIET_DAYS = 3
STREAK_MILESTONES = (7, 14, 30)
CHECKIN_DAYS = (30, 60, 90)


def _last_activity_date(user):
    """Most recent local date with a completed task, practice or reflection."""
    dates = []
    from daily_os.models import Task

    last_task = Task.objects.filter(user=user, done_at__isnull=False).order_by("-done_at").first()
    if last_task:
        dates.append(clock.local_date(user, last_task.done_at))
    last_log = PracticeLog.objects.filter(user=user, done=True).order_by("-date").first()
    if last_log:
        dates.append(last_log.date)
    last_refl = DailyReflection.objects.filter(user=user).order_by("-date").first()
    if last_refl:
        dates.append(last_refl.date)
    return max(dates) if dates else None


def _due_rules(user, snap: dict, sprint, today) -> list[tuple[str, str, dict]]:
    """Return (kind, dedupe_key, stats) for every rule that currently applies."""
    out: list[tuple[str, str, dict]] = []
    n = snap["day_number"]
    iso_year, iso_week, _ = today.isocalendar()

    last = _last_activity_date(user)
    started = (today - sprint.starts_on).days
    quiet = (today - last).days if last else started
    if n >= QUIET_DAYS + 1 and quiet >= QUIET_DAYS:
        out.append((NudgeKind.REENGAGEMENT, f"reengage:{iso_year}-{iso_week}", {"days_quiet": quiet}))

    ritual = ritual_state(user)
    if ritual["due"]:
        out.append((NudgeKind.RITUAL, f"ritual:{ritual['week_start']}", {}))

    for milestone in CHECKIN_DAYS:
        if milestone <= n <= SPRINT_DAYS + 7 and n - milestone < 7:
            wk = snap["week"]
            total = sum(r["due"] for r in snap["layers"])
            done = sum(r["done"] for r in snap["layers"])
            out.append((NudgeKind.CHECKIN, f"checkin:{milestone}",
                        {"day": n, "done": done, "total": total, "week": wk["week"]}))

    streak = snap["practice_streak"]
    for m in STREAK_MILESTONES:
        if streak == m:
            out.append((NudgeKind.STREAK, f"streak:{m}", {"streak": m}))
    return out


def evaluate(user, llm: LLMService | None = None) -> list[MentorNudge]:
    """Create any nudges that are due and not yet created. Returns the new ones."""
    if not user.mentor_nudges:
        return []
    try:
        sprint = get_sprint(user)
    except Exception:  # noqa: BLE001 - no protocol yet
        return []
    llm = llm or get_llm_service()
    today = clock.local_today(user)
    snap = progress_snapshot(user, sprint, today)
    created: list[MentorNudge] = []
    for kind, key, stats in _due_rules(user, snap, sprint, today):
        if MentorNudge.objects.filter(user=user, dedupe_key=key).exists():
            continue
        res = llm.run_json(user=user, task="proactive_nudge", payload={
            "kind": kind, "tone": snap["tone"], "stats": stats,
            "display_name": user.display_name.split(" ")[0] if user.display_name else "",
        })
        try:
            with transaction.atomic():
                created.append(MentorNudge.objects.create(
                    user=user, kind=kind, dedupe_key=key, body=str(res.data.get("body", ""))))
        except IntegrityError:  # concurrent evaluation; the other one won
            continue
    return created


def run_for_all_users(llm: LLMService | None = None) -> int:
    from accounts.models import User

    total = 0
    for user in User.objects.filter(is_active=True, mentor_nudges=True).iterator():
        try:
            total += len(evaluate(user, llm))
        except Exception:  # noqa: BLE001 - one user must not block the rest
            log.warning("proactive evaluation failed", extra={"event": "mentor.proactive_failed",
                                                              "user_id": str(user.id)})
    return total

