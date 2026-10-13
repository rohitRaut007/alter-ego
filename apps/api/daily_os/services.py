"""Daily OS logic: materialising the protocol, tasks, the morning brief, ritual, deep work."""

from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any

from django.db import IntegrityError, transaction
from rest_framework.exceptions import APIException

from analytics.models import EventName, EventOutbox
from analytics.services import track
from character.models import Practice, PracticeLog, Trait
from core import clock
from protocol.models import Protocol, ProtocolStatus
from protocol.services import current_sections

from .models import (
    DailyReflection,
    DeepWorkSession,
    Sprint,
    Task,
    TaskSource,
    WeeklyRitual,
)

SPRINT_DAYS = 90
RITUAL_PROMPTS = [
    ("shipped", "What did you ship or finish this week?"),
    ("slipped", "What slipped, and what was really behind it?"),
    ("next_outcome", "What is next week's single most important outcome?"),
]
REFLECTION_PROMPTS = [
    ("compounded", "What compounded today?"),
    ("leaked", "What leaked?"),
    ("tomorrow", "What is tomorrow's first action?"),
]


class NoProtocol(APIException):
    status_code = 404
    default_code = "no_protocol"
    default_detail = "Complete the interview to generate your protocol first."


class DailyOSError(Exception):
    """A request that conflicts with current state (maps to HTTP 409)."""


# --- protocol -> trackable data -----------------------------------------------------------


@transaction.atomic
def sync_protocol(protocol: Protocol) -> Sprint:
    """Create or update traits, practices, the sprint and tasks from the current sections.

    Idempotent. Completion state is never touched. Items that disappear from the protocol are
    deleted when untouched and archived when they carry history.
    """
    user = protocol.user
    sections = current_sections(protocol)
    now = clock.now()
    starts_on = clock.local_date(user, protocol.completed_at or now)

    sprint_content = sections["sprint_90"].content
    # The sprint window is fixed by the first sync; later syncs only refresh the goal.
    sprint = Sprint.objects.filter(protocol=protocol).first()
    if sprint is None:
        sprint = Sprint.objects.create(
            protocol=protocol,
            user=user,
            starts_on=starts_on,
            ends_on=starts_on + timedelta(days=SPRINT_DAYS),
            goal=sprint_content["goal"],
        )
    else:
        sprint.goal = sprint_content["goal"]
        sprint.save(update_fields=["goal"])

    # Traits and practices
    seen_traits: set[str] = set()
    trait_by_source: dict[str, Trait] = {}
    for pos, t in enumerate(sections["character"].content["traits"]):
        trait, _ = Trait.objects.update_or_create(
            protocol=protocol,
            source_id=t["id"],
            defaults={
                "user": user,
                "position": pos,
                "name": t["name"],
                "statement": t["statement"],
                "rationale": t["rationale"],
                "failure_mode": t["failure_mode"],
                "monthly_reflection_prompt": t["monthly_reflection_prompt"],
                "archived_at": None,
            },
        )
        seen_traits.add(t["id"])
        trait_by_source[t["id"]] = trait
        seen_practices: set[str] = set()
        for p in t["practices"]:
            Practice.objects.update_or_create(
                trait=trait,
                source_id=p["id"],
                defaults={
                    "description": p["description"],
                    "cadence": p["cadence"],
                    "minutes": p["minutes"],
                    "archived_at": None,
                },
            )
            seen_practices.add(p["id"])
        trait.practices.exclude(source_id__in=seen_practices).update(archived_at=now)
    Trait.objects.filter(protocol=protocol).exclude(source_id__in=seen_traits).update(
        archived_at=now
    )

    # Tasks
    wanted: dict[tuple[str, str], dict[str, Any]] = {}
    for t in sections["checklist_30"].content["tasks"]:
        wanted[(TaskSource.CHECKLIST_30, t["id"])] = {**t, "week_index": None}
    for w in sprint_content["weeks"]:
        for t in w["tasks"]:
            wanted[(TaskSource.SPRINT_90, t["id"])] = {**t, "week_index": w["index"]}

    for (source, source_id), t in wanted.items():
        trait = trait_by_source.get(t.get("trait_id") or "")
        Task.objects.update_or_create(
            protocol=protocol,
            source=source,
            source_id=source_id,
            defaults={
                "user": user,
                "sprint": sprint,
                "layer": t["layer"],
                "title": t["title"],
                "detail": t["detail"],
                "minutes": t["minutes"],
                "priority": t["priority"],
                "due_day": t["due_day"],
                "due_date": sprint.starts_on + timedelta(days=t["due_day"]),
                "week_index": t["week_index"],
                "trait": trait,
                "archived_at": None,
            },
        )
    for task in Task.objects.filter(protocol=protocol, archived_at__isnull=True):
        if (task.source, task.source_id) not in wanted:
            if task.done_at is None:
                task.delete()
            else:
                task.archived_at = now
                task.save(update_fields=["archived_at"])
    return sprint


def latest_ready_protocol(user) -> Protocol | None:
    return (
        Protocol.objects.filter(user=user, status=ProtocolStatus.READY)
        .order_by("-created_at")
        .first()
    )


def get_sprint(user) -> Sprint:
    """The user's active sprint, materialising it on first use."""
    protocol = latest_ready_protocol(user)
    if protocol is None:
        raise NoProtocol()
    try:
        return protocol.sprint
    except Sprint.DoesNotExist:
        return sync_protocol(protocol)


# --- tasks --------------------------------------------------------------------------------


def active_tasks(user):
    return Task.objects.filter(user=user, archived_at__isnull=True)


def set_task_done(task: Task, done: bool) -> Task:
    if done and task.done_at is None:
        task.done_at = clock.now()
        task.save(update_fields=["done_at"])
        track(task.user, EventName.TASK_COMPLETED, {"layer": task.layer, "source": task.source})
    elif not done and task.done_at is not None:
        task.done_at = None
        task.save(update_fields=["done_at"])
    return task


# --- brief --------------------------------------------------------------------------------


def day_number(sprint: Sprint, on: date) -> int:
    return max(1, (on - sprint.starts_on).days + 1)


def week_index(sprint: Sprint, on: date) -> int:
    return min(13, (day_number(sprint, on) - 1) // 7 + 1)


def week_progress(user, sprint: Sprint, on: date) -> dict[str, Any]:
    """Progress on this sprint week's tasks, and what is overdue by layer."""
    wk = week_index(sprint, on)
    tasks = list(active_tasks(user).filter(sprint=sprint, week_index=wk))
    overdue = [t for t in tasks if t.done_at is None and t.due_date <= on]
    by_layer = Counter(t.layer for t in overdue)
    return {
        "week": wk,
        "total": len(tasks),
        "done": sum(1 for t in tasks if t.done_at is not None),
        "overdue": len(overdue),
        "overdue_by_layer": dict(by_layer),
    }


LAYER_NAMES = {
    "identity": "Identity", "character": "Character", "knowledge": "Knowledge",
    "mission": "Mission", "daily_os": "Daily OS", "presence": "Presence", "legacy": "Legacy",
}


def week_insight(wp: dict[str, Any]) -> str | None:
    """Specific, factual progress line (PRD 7.2). Deterministic; no model call."""
    if wp["total"] == 0:
        return None
    head = f"You have completed {wp['done']} of {wp['total']} Week {wp['week']} tasks."
    if wp["overdue"] == 0:
        return f"{head} Nothing is overdue."
    layers = sorted(wp["overdue_by_layer"].items(), key=lambda kv: (-kv[1], kv[0]))
    if len(layers) == 1:
        where = f"all in {LAYER_NAMES.get(layers[0][0], layers[0][0])}"
    else:
        where = ", ".join(f"{n} in {LAYER_NAMES.get(k, k)}" for k, n in layers)
    return f"{head} The {wp['overdue']} overdue {'is' if wp['overdue'] == 1 else 'are'} {where}."


def choose_tone(wp: dict[str, Any], streak: int, has_history: bool) -> str:
    """start | push | balanced | steady, from completion and the practice streak."""
    due = wp["done"] + wp["overdue"]
    if due == 0 and not has_history:
        return "start"
    rate = wp["done"] / due if due else 1.0
    if rate >= 0.75 and streak >= 3:
        return "push"
    if rate < 0.4 or (has_history and streak == 0 and wp["overdue"] > 0):
        return "steady"
    return "balanced"


def _tone_copy(tone: str, n: int, streak: int, wp: dict[str, Any]) -> tuple[str, str]:
    if tone == "start":
        return (f"Day {n}: begin with the first priority.",
                "The system is already designed. Do the first priority task, then one practice.")
    if tone == "push":
        return ("You are building momentum. Raise the bar today.",
                f"{streak}-day practice streak and most of this week's due work is done. "
                "Take the hardest priority first.")
    if tone == "steady":
        return ("Reset, do not try to catch up on everything.",
                "Pick one overdue priority and finish it today. A smaller plan done is worth "
                "more than a larger plan avoided.")
    return (f"Day {n}: keep the cadence.",
            "Work the priorities in order, log your practice, and close the day with the "
            "reflection.")


def build_brief(user, sprint: Sprint, on: date) -> dict[str, Any]:
    from character.services import practices_overview, overall_practice_streak

    sections = current_sections(sprint.protocol)
    wp = week_progress(user, sprint, on)
    n = day_number(sprint, on)
    practices = practices_overview(user, sprint.protocol, on)
    streak, best = overall_practice_streak(user, on)
    has_history = PracticeLog.objects.filter(user=user, done=True).exists() or wp["done"] > 0
    tone = choose_tone(wp, streak, has_history)
    headline, body = _tone_copy(tone, n, streak, wp)

    tasks = active_tasks(user).filter(sprint=sprint)
    due = [t for t in tasks if t.done_at is None and t.due_date <= on]
    due.sort(key=lambda t: (not t.priority, t.due_date, t.source_id))
    today_done = [t for t in tasks if t.done_at is not None
                  and clock.local_date(user, t.done_at) == on]
    checklist = [t for t in tasks if t.source == TaskSource.CHECKLIST_30]

    sessions = DeepWorkSession.objects.filter(user=user, abandoned=False, ended_at__isnull=False)
    deep_minutes = sum(s.actual_minutes for s in sessions
                       if clock.local_date(user, s.started_at) == on)

    return {
        "date": on,
        "day_number": n,
        "total_days": SPRINT_DAYS,
        "sprint_over": on > sprint.ends_on,
        "sprint_goal": sprint.goal,
        "tone": tone,
        "headline": headline,
        "body": body,
        "insight": week_insight(wp),
        "week": wp,
        "focus": due[:3],
        "due_tasks": due[:12],
        "completed_today": today_done,
        "checklist": {
            "total": len(checklist),
            "done": sum(1 for t in checklist if t.done_at is not None),
            "overdue": sum(1 for t in checklist if t.done_at is None and t.due_date < on),
        },
        "practices": [p for p in practices if p["due_today"]],
        "practice_streak": streak,
        "best_practice_streak": best,
        "schedule": sections["daily_os"].content["schedule"],
        "deep_work_target_minutes": sections["daily_os"].content["deep_work_minutes_per_day"],
        "deep_work_minutes_today": deep_minutes,
        "reflection_done": DailyReflection.objects.filter(user=user, date=on).exists(),
        "ritual": ritual_state(user),
        "alter_ego_name": sections["identity"].content["alter_ego_name"],
        "identity_statement": sections["identity"].content["identity_statement"],
    }


def record_active_day(user) -> None:
    """Emit `session_active` at most once per local day (D7/D30 retention)."""
    today = clock.local_today(user)
    start = datetime.combine(today, datetime.min.time(), tzinfo=clock.user_tz(user))
    exists = EventOutbox.objects.filter(
        user=user, name=EventName.SESSION_ACTIVE, created_at__gte=start
    ).exists()
    if not exists:
        track(user, EventName.SESSION_ACTIVE)


# --- reflection ---------------------------------------------------------------------------


def save_reflection(user, on: date, answers: dict[str, str], rating: int | None) -> DailyReflection:
    reflection, created = DailyReflection.objects.update_or_create(
        user=user, date=on, defaults={"answers": answers, "rating": rating}
    )
    if created:
        track(user, EventName.REFLECTION_COMPLETED)
    return reflection


# --- deep work ----------------------------------------------------------------------------


def active_session(user) -> DeepWorkSession | None:
    return DeepWorkSession.objects.filter(user=user, ended_at__isnull=True).first()


def start_session(user, planned_minutes: int, task: Task | None) -> DeepWorkSession:
    try:
        with transaction.atomic():
            return DeepWorkSession.objects.create(
                user=user, planned_minutes=planned_minutes, task=task, started_at=clock.now()
            )
    except IntegrityError:
        raise DailyOSError("A deep work session is already running.") from None


def end_session(session: DeepWorkSession, abandoned: bool = False) -> DeepWorkSession:
    if session.ended_at is not None:
        return session
    session.ended_at = clock.now()
    session.abandoned = abandoned
    session.save(update_fields=["ended_at", "abandoned"])
    if not abandoned:
        track(session.user, EventName.DEEP_WORK_SESSION_COMPLETED,
              {"minutes": session.actual_minutes, "planned": session.planned_minutes})
    return session


# --- weekly ritual ------------------------------------------------------------------------


def ritual_state(user) -> dict[str, Any]:
    """The weekly ritual opens Sunday 17:00 local and stays open through Wednesday."""
    local = clock.local_now(user)
    today = local.date()
    wd = local.weekday()  # Monday=0 .. Sunday=6
    if wd == 6 and local.hour >= 17:
        week_start: date | None = today - timedelta(days=6)
    elif wd in (0, 1, 2):
        week_start = today - timedelta(days=wd + 7)
    else:
        week_start = None
    # A week that ended before the sprint began has nothing to close.
    first = Sprint.objects.filter(user=user).order_by("starts_on").first()
    if week_start is not None and (first is None or week_start + timedelta(days=6) < first.starts_on):
        week_start = None
    completed = bool(
        week_start and WeeklyRitual.objects.filter(user=user, week_start=week_start).exists()
    )
    return {
        "available": week_start is not None,
        "week_start": week_start,
        "completed": completed,
        "due": week_start is not None and not completed,
    }


def ritual_stats(user, week_start: date) -> dict[str, Any]:
    week_end = week_start + timedelta(days=6)
    tasks = list(active_tasks(user).filter(due_date__gte=week_start, due_date__lte=week_end))
    done = [t for t in tasks if t.done_at is not None]
    missed = Counter(t.layer for t in tasks if t.done_at is None)
    practice_days = (
        PracticeLog.objects.filter(user=user, done=True, date__gte=week_start, date__lte=week_end)
        .values("date").distinct().count()
    )
    sessions = DeepWorkSession.objects.filter(user=user, abandoned=False, ended_at__isnull=False)
    minutes = sum(
        s.actual_minutes for s in sessions
        if week_start <= clock.local_date(user, s.started_at) <= week_end
    )
    return {
        "week_start": week_start,
        "tasks_due": len(tasks),
        "tasks_done": len(done),
        "missed_by_layer": dict(missed),
        "practice_days": practice_days,
        "deep_work_minutes": minutes,
    }


def complete_ritual(user, answers: dict[str, str]) -> WeeklyRitual:
    state = ritual_state(user)
    if not state["available"]:
        raise DailyOSError("The weekly ritual opens on Sunday evening.")
    ritual, created = WeeklyRitual.objects.update_or_create(
        user=user, week_start=state["week_start"],
        defaults={"answers": answers, "completed_at": clock.now()},
    )
    if created:
        track(user, EventName.WEEKLY_RITUAL_COMPLETED)
    return ritual
