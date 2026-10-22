"""Turn a validated plan into the protocol's `sprint_90` and `mission` sections. Pure, no model.

The protocol stays the user-facing document; the plan is the engine's record. Past tasks from the
previous sprint section are carried over unchanged, so completion history and task ids survive a
window rebuild (`sync_protocol` keys tasks by id).
"""

import math
from typing import Any

from protocol.schema.v2 import SECTION_MODELS

from .plan_validation import DEFAULT_REVIEW_PROMPT, PlanContext, week_days, week_of
from .schema import GoalModelV1, PlanV1

MAX_PHASES = 5
EXECUTION_SYSTEM = (
    "Two-week task windows rebuilt from what actually got done, a 15-minute fallback for every "
    "task, and a weekly review."
)
DEFAULT_RISK = "Losing momentum after the first two weeks."


def sprint_goal(goal: GoalModelV1) -> str:
    if goal.commitment:
        return goal.commitment
    return f"Make visible progress toward: {goal.statement or 'your goal'}"


def _task(t: Any) -> dict[str, Any]:
    out = t.model_dump(mode="json", exclude_none=True)
    out.setdefault("priority", False)
    return out


def project_sprint(
    plan: PlanV1, ctx: PlanContext, goal: GoalModelV1, previous: dict[str, Any] | None = None
) -> dict[str, Any]:
    """The sprint section: the plan's weeks, with past tasks and fully past weeks kept."""
    prev_weeks = {w["index"]: w for w in (previous or {}).get("weeks", [])}
    milestone_ids = {m.id for m in plan.milestones}
    carried: dict[int, list[dict[str, Any]]] = {}
    for w in prev_weeks.values():
        for t in w.get("tasks", []):
            if t["due_day"] < ctx.window_start_day:
                t = dict(t)
                if t.get("milestone_id") not in milestone_ids:
                    t.pop("milestone_id", None)  # the rebuilt plan renamed its milestones
                carried.setdefault(week_of(t["due_day"]), []).append(t)

    plan_weeks = {w.index: w for w in plan.weeks}
    weeks = []
    for index in range(1, ctx.week_count + 1):
        first, last = week_days(index)
        fully_past = last < ctx.window_start_day
        source = prev_weeks.get(index) if fully_past else None
        pw = plan_weeks.get(index)
        if source is not None:
            week = {"index": index, "theme": source["theme"],
                    "review_prompt": source["review_prompt"]}
            if source.get("outcome"):
                week["outcome"] = source["outcome"]
            tasks = list(carried.get(index, []))
        else:
            week = {"index": index, "theme": pw.theme if pw else "Keep going",
                    "review_prompt": (pw.review_prompt if pw else None) or DEFAULT_REVIEW_PROMPT}
            if pw and pw.outcome:
                week["outcome"] = pw.outcome
            tasks = list(carried.get(index, [])) + [_task(t) for t in (pw.tasks if pw else [])]
        week["tasks"] = sorted(tasks, key=lambda t: (t["due_day"], not t.get("priority"), t["id"]))
        weeks.append(week)

    section = {
        "goal": sprint_goal(goal),
        "milestones": [m.model_dump(mode="json", exclude_none=True) for m in plan.milestones],
        "weeks": weeks,
    }
    return SECTION_MODELS["sprint_90"].model_validate(section).model_dump(
        mode="json", exclude_none=True
    )


def _phases(plan: PlanV1) -> list[dict[str, Any]]:
    """Milestones become roadmap phases; past five, the last ones share a phase."""
    ms = plan.milestones
    phases = []
    for i, m in enumerate(ms[: MAX_PHASES - 1] if len(ms) > MAX_PHASES else ms):
        phases.append({"name": m.title, "horizon_weeks": _weeks(m.due_day),
                       "outcomes": [m.evidence]})
    if len(ms) > MAX_PHASES:
        rest = ms[MAX_PHASES - 1:]
        phases.append({"name": rest[-1].title, "horizon_weeks": _weeks(rest[-1].due_day),
                       "outcomes": [m.evidence for m in rest][:6]})
    return phases


def _weeks(day: int) -> int:
    return max(1, min(104, math.ceil(day / 7)))


def project_mission(plan: PlanV1, goal: GoalModelV1) -> dict[str, Any]:
    risks = [r.risk for r in plan.risks] or ([goal.obstacle] if goal.obstacle else [DEFAULT_RISK])
    section = {
        "statement": goal.statement or sprint_goal(goal),
        "strategy": plan.strategy,
        "roadmap": _phases(plan),
        "risks": risks[:8],
        "execution_system": EXECUTION_SYSTEM,
    }
    return SECTION_MODELS["mission"].model_validate(section).model_dump(
        mode="json", exclude_none=True
    )


def carried_ids(previous: dict[str, Any] | None, window_start_day: int) -> frozenset[str]:
    """Ids of past tasks that the next projection keeps, so a new plan cannot reuse them."""
    return frozenset(
        t["id"]
        for w in (previous or {}).get("weeks", [])
        for t in w.get("tasks", [])
        if t["due_day"] < window_start_day
    )
