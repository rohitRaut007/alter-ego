"""Check a model-written plan against the rules code owns. Pure.

Errors are structured (`code`, `path`, `observed`, `allowed`) because a retry that is told where
the plan broke, what it saw and what is allowed repairs far more often than one given a bare
message. `normalise_plan` fixes the trivial things first so they never cost a retry.
"""

import math
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from typing import Any

from pydantic import ValidationError

from protocol.schema.v2 import FALLBACK_MAX_MINUTES, find_banned_phrases

from .schema import PlanV1

MAX_ERRORS = 12
MIN_MILESTONES = 3
MAX_MILESTONES = 6
WINDOW_DAYS = 14
BUDGET_SHARE = 0.85  # plans leave slack: weekly minutes stay at or under 85% of capacity
DAY1_MAX_MINUTES = 14  # the first planned day is a small, visible win
SNAP_TARGET_DAYS = 7  # a last milestone this close to the target day is moved onto it
DEFAULT_REVIEW_PROMPT = "What did you do this week that you would repeat, and what would you change?"


@dataclass(frozen=True)
class PlanError:
    code: str
    path: str
    observed: Any
    allowed: Any
    message: str

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PlanContext:
    """Where the plan sits in time and how much time the user has.

    Day numbers count from the sprint start (day 0 is the Seed day). Week `w` covers days
    `(w - 1) * 7 + 1` to `w * 7`.
    """

    start: date
    sprint_days: int
    target_day: int
    window_start_day: int
    weekday_minutes: int
    weekend_minutes: int
    carried_ids: frozenset[str] = frozenset()

    @property
    def window_end_day(self) -> int:
        return min(self.sprint_days, self.window_start_day + WINDOW_DAYS - 1)

    @property
    def week_count(self) -> int:
        return max(1, min(13, math.ceil(self.sprint_days / 7)))

    @property
    def is_initial(self) -> bool:
        return self.window_start_day == 1

    def date_of(self, day: int) -> date:
        return self.start + timedelta(days=day)

    def capacity(self, day: int) -> int:
        weekend = self.date_of(day).weekday() >= 5
        return self.weekend_minutes if weekend else self.weekday_minutes

    def in_window(self, day: int) -> bool:
        return self.window_start_day <= day <= self.window_end_day

    def week_budget(self, index: int) -> int:
        """Minutes the plan may use in this week: 85% of capacity on its window days."""
        first, last = week_days(index)
        days = [d for d in range(first, last + 1) if self.in_window(d)]
        return math.floor(sum(self.capacity(d) for d in days) * BUDGET_SHARE)


def week_days(index: int) -> tuple[int, int]:
    return (index - 1) * 7 + 1, index * 7


def week_of(day: int) -> int:
    return (day - 1) // 7 + 1


# --- normalising -------------------------------------------------------------------------


def normalise_plan(raw: dict[str, Any], ctx: PlanContext) -> dict[str, Any]:
    """Deterministic fixes that should never cost a model retry. Returns a new dict."""
    plan = {**raw}
    milestones = [dict(m) for m in plan.get("milestones") or [] if isinstance(m, dict)]
    if milestones:
        last = milestones[-1]
        due = last.get("due_day")
        if isinstance(due, int) and abs(due - ctx.target_day) <= SNAP_TARGET_DAYS:
            last["due_day"] = ctx.target_day
        plan["milestones"] = milestones
    weeks = []
    for w in plan.get("weeks") or []:
        if isinstance(w, dict):
            w = {**w}
            if not w.get("review_prompt"):
                w["review_prompt"] = DEFAULT_REVIEW_PROMPT
        weeks.append(w)
    plan["weeks"] = weeks
    return plan


# --- validating --------------------------------------------------------------------------


def _pointer(loc: tuple[Any, ...]) -> str:
    return "/" + "/".join(str(p) for p in loc)


def _schema_errors(exc: ValidationError) -> list[PlanError]:
    out = []
    for e in exc.errors():
        observed = e.get("input")
        if isinstance(observed, (dict, list)):
            observed = type(observed).__name__
        elif isinstance(observed, str) and len(observed) > 80:
            observed = observed[:77] + "..."
        out.append(PlanError("schema", _pointer(tuple(e["loc"])), observed, e["msg"],
                             f"{_pointer(tuple(e['loc']))}: {e['msg']}"))
    return out


def _banned_with_paths(value: Any, path: str = "") -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    if isinstance(value, str):
        found += [(path, phrase) for phrase in find_banned_phrases(value)]
    elif isinstance(value, dict):
        for k, v in value.items():
            found += _banned_with_paths(v, f"{path}/{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            found += _banned_with_paths(v, f"{path}/{i}")
    return found


def validate_plan(raw: dict[str, Any], ctx: PlanContext) -> tuple[PlanV1 | None, list[PlanError]]:
    """Return the parsed plan and every rule it breaks (at most 12, sorted by path)."""
    try:
        plan = PlanV1.model_validate(raw)
    except ValidationError as exc:
        return None, _sorted(_schema_errors(exc))

    errors: list[PlanError] = []
    add = errors.append

    # Milestones: 3 to 6, strictly ascending, the last one on the target day.
    ms = plan.milestones
    if not MIN_MILESTONES <= len(ms) <= MAX_MILESTONES:
        add(PlanError("milestone_count", "/milestones", len(ms),
                      f"{MIN_MILESTONES}-{MAX_MILESTONES}",
                      f"Write {MIN_MILESTONES} to {MAX_MILESTONES} milestones."))
    for i in range(1, len(ms)):
        if ms[i].due_day <= ms[i - 1].due_day:
            add(PlanError("milestone_order", f"/milestones/{i}/due_day", ms[i].due_day,
                          f">{ms[i - 1].due_day}", "Milestone days must strictly increase."))
    if ms and ms[-1].due_day != ctx.target_day:
        add(PlanError("milestone_target", f"/milestones/{len(ms) - 1}/due_day", ms[-1].due_day,
                      ctx.target_day, "The last milestone must fall on the target day."))
    milestone_ids = {m.id for m in ms}

    # Weeks: exactly the sprint's weeks, each once.
    indexes = [w.index for w in plan.weeks]
    wanted = list(range(1, ctx.week_count + 1))
    if sorted(indexes) != wanted:
        add(PlanError("week_coverage", "/weeks", indexes, wanted,
                      "Return every week of the sprint exactly once."))

    seen_ids: set[str] = set(ctx.carried_ids)
    per_day: dict[int, int] = {}
    for wi, week in enumerate(plan.weeks):
        first, last = week_days(week.index)
        window_week = any(ctx.in_window(d) for d in range(first, last + 1))
        if not window_week and not week.outcome:
            add(PlanError("week_outcome_missing", f"/weeks/{wi}/outcome", None, "text",
                          "Weeks after the window need an outcome."))
        total = 0
        for ti, t in enumerate(week.tasks):
            p = f"/weeks/{wi}/tasks/{ti}"
            if t.id in seen_ids:
                add(PlanError("duplicate_id", f"{p}/id", t.id, "unique id",
                              "Task ids must be unique, including carried-over tasks."))
            seen_ids.add(t.id)
            if not ctx.in_window(t.due_day):
                add(PlanError("task_outside_window", f"{p}/due_day", t.due_day,
                              [ctx.window_start_day, ctx.window_end_day],
                              "Only days inside the window get tasks."))
            elif not first <= t.due_day <= last:
                add(PlanError("task_in_wrong_week", f"{p}/due_day", t.due_day, [first, last],
                              f"Week {week.index} covers days {first} to {last}."))
            if t.milestone_id is None:
                add(PlanError("milestone_missing", f"{p}/milestone_id", None,
                              sorted(milestone_ids), "Every task names its milestone."))
            elif t.milestone_id not in milestone_ids:
                add(PlanError("unknown_milestone", f"{p}/milestone_id", t.milestone_id,
                              sorted(milestone_ids), "Use a milestone id from this plan."))
            if not t.fallback or t.fallback_minutes is None:
                add(PlanError("fallback_missing", f"{p}/fallback", t.fallback, "text + minutes",
                              "Every task needs a 15-minute fallback."))
            elif t.fallback_minutes > min(FALLBACK_MAX_MINUTES, t.minutes):
                add(PlanError("fallback_too_long", f"{p}/fallback_minutes", t.fallback_minutes,
                              f"<={min(FALLBACK_MAX_MINUTES, t.minutes)}",
                              "A fallback is at most 15 minutes and shorter than the task."))
            total += t.minutes
            per_day[t.due_day] = per_day.get(t.due_day, 0) + t.minutes
            if ctx.in_window(t.due_day) and per_day[t.due_day] > ctx.capacity(t.due_day):
                add(PlanError("day_over_capacity", f"{p}/minutes", per_day[t.due_day],
                              f"<={ctx.capacity(t.due_day)}",
                              f"Day {t.due_day} has {ctx.capacity(t.due_day)} minutes."))
        budget = ctx.week_budget(week.index)
        if window_week and total > budget:
            add(PlanError("week_over_budget", f"/weeks/{wi}/tasks", total, f"<={budget}",
                          f"Week {week.index} may use at most {budget} minutes."))

    if ctx.is_initial:
        day1 = per_day.get(1, 0)
        if day1 == 0:
            add(PlanError("day1_missing", "/weeks/0/tasks", 0, f"1-{DAY1_MAX_MINUTES}",
                          "Day 1 needs one small task that produces something visible."))
        elif day1 > DAY1_MAX_MINUTES:
            add(PlanError("day1_too_long", "/weeks/0/tasks", day1, f"<={DAY1_MAX_MINUTES}",
                          f"Day 1 tasks total at most {DAY1_MAX_MINUTES} minutes."))

    for path, phrase in _banned_with_paths(raw):
        add(PlanError("banned_phrase", path, phrase, "no outcome promises",
                      "Never promise or predict outcomes."))

    return (plan if not errors else None), _sorted(errors)


def _sorted(errors: list[PlanError]) -> list[PlanError]:
    return sorted(errors, key=lambda e: (e.path, e.code))[:MAX_ERRORS]
