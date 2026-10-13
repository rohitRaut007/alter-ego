"""Weekly accountability challenges aimed at the layer that is slipping."""

from datetime import timedelta

from django.db import transaction

from core import clock
from daily_os.models import Task, TaskSource
from daily_os.services import get_sprint, layer_stats, progress_snapshot, week_index
from protocol.services import current_sections

from .llm.service import LLMService, get_llm_service
from .models import ChallengeStatus, MentorChallenge

LAYERS = {"identity", "character", "knowledge", "mission", "daily_os", "presence", "legacy"}
DIFFICULTIES = {"Light", "Medium", "Hard"}


class ChallengeError(Exception):
    """Conflicts with current state (maps to HTTP 409)."""


def ensure_weekly(user, llm: LLMService | None = None) -> list[MentorChallenge]:
    """Offer this sprint week's challenges once; return everything for the week."""
    sprint = get_sprint(user)
    today = clock.local_today(user)
    wk = week_index(sprint, today)
    existing = list(MentorChallenge.objects.filter(user=user, week_index=wk))
    if existing:
        return existing

    llm = llm or get_llm_service()
    sections = current_sections(sprint.protocol)
    snap = progress_snapshot(user, sprint, today)
    weak = [{"layer": r["layer"], "overdue": r["overdue"]} for r in layer_stats(user, sprint, today)
            if r["overdue"] > 0][:3]
    res = llm.run_json(user=user, task="weekly_challenges", payload={
        "week": wk,
        "weak_layers": weak,
        "traits": [{"name": t["name"], "failure_mode": t["failure_mode"]}
                   for t in sections["character"].content["traits"]],
        "tone": snap["tone"],
        "capacity_minutes": sections["daily_os"].content["deep_work_minutes_per_day"],
    })
    out: list[MentorChallenge] = []
    hard = 0
    for c in res.data.get("challenges", [])[:3]:
        layer = c.get("layer") if c.get("layer") in LAYERS else "mission"
        diff = c.get("difficulty") if c.get("difficulty") in DIFFICULTIES else "Medium"
        if diff == "Hard":
            hard += 1
            if hard > 1:
                diff = "Medium"
        out.append(MentorChallenge.objects.create(
            user=user, week_index=wk, layer=layer, difficulty=diff,
            title=str(c.get("title", "")).strip()[:160] or "Challenge",
            detail=str(c.get("detail", "")).strip()[:600],
        ))
    return out


@transaction.atomic
def accept(user, challenge: MentorChallenge) -> MentorChallenge:
    """Accepting turns the challenge into a priority task due by the end of this week."""
    if challenge.status != ChallengeStatus.OFFERED:
        raise ChallengeError("This challenge has already been handled.")
    sprint = get_sprint(user)
    today = clock.local_today(user)
    days_left = max(1, 6 - today.weekday())  # through Sunday
    due = today + timedelta(days=days_left)
    task = Task.objects.create(
        user=user, protocol=sprint.protocol, sprint=sprint, source=TaskSource.MENTOR,
        source_id=f"mentor_{challenge.id.hex[:16]}", layer=challenge.layer,
        title=challenge.title, detail=challenge.detail, minutes=60, priority=True,
        block="deep_work",
        due_day=max(1, (due - sprint.starts_on).days), due_date=due,
        week_index=week_index(sprint, today),
    )
    challenge.status = ChallengeStatus.ACCEPTED
    challenge.task = task
    challenge.save(update_fields=["status", "task"])
    return challenge


def dismiss(challenge: MentorChallenge) -> MentorChallenge:
    if challenge.status != ChallengeStatus.OFFERED:
        raise ChallengeError("This challenge has already been handled.")
    challenge.status = ChallengeStatus.DISMISSED
    challenge.save(update_fields=["status"])
    return challenge
