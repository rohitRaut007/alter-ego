"""The three ways to make a goal fit: move the date, add time, or narrow the scope.

Numbers come from here; the model only writes the words around them. The user chooses.
"""

import math
from collections.abc import Collection, Mapping
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from typing import Any, Literal

from .feasibility import Status, feasibility, weekly_hours
from .horizon import MAX_TARGET_DAYS, MIN_TARGET_DAYS

OptionKey = Literal["move_date", "add_time", "narrow_scope"]
OPTION_KEYS: tuple[OptionKey, ...] = ("move_date", "add_time", "narrow_scope")

# Burnout guard: no plan asks for more than this, whatever the user offers to cut.
MAX_WEEKLY_H = 36.0


@dataclass(frozen=True)
class TradeoffOption:
    key: OptionKey
    available: bool
    # Token explaining why an option is unavailable: beyond_max_horizon, no_time, cuts_insufficient,
    # over_ceiling, date_passed, no_estimate.
    reason: str | None = None
    target_date: date | None = None
    weekly_h: float | None = None
    extra_weekly_h: float | None = None
    cuts: tuple[str, ...] = field(default_factory=tuple)
    effort_h: float | None = None
    coverage: float | None = None
    status: Status | None = None

    def as_dict(self) -> dict[str, Any]:
        out = asdict(self)
        out["cuts"] = list(self.cuts)
        out["target_date"] = self.target_date.isoformat() if self.target_date else None
        for key, digits in (("weekly_h", 1), ("extra_weekly_h", 1), ("effort_h", 0),
                            ("coverage", 2)):
            if out[key] is not None:
                out[key] = round(out[key], digits)
        return out


def move_date(today: date, effort_h: float, weekly_h: float, a: float) -> TradeoffOption:
    """Same goal, same weekly time, a later date."""
    weeks_needed = feasibility(effort_h, weekly_h, 1, a).weeks_needed
    if weeks_needed is None:
        return TradeoffOption("move_date", False, reason="no_time")
    days = max(MIN_TARGET_DAYS, math.ceil(weeks_needed * 7))
    if days > MAX_TARGET_DAYS:
        return TradeoffOption("move_date", False, reason="beyond_max_horizon")
    f = feasibility(effort_h, weekly_h, days / 7, a)
    return TradeoffOption("move_date", True, target_date=today + timedelta(days=days),
                          weekly_h=weekly_h, effort_h=effort_h, coverage=f.coverage,
                          status=f.status)


def add_time(
    effort_h: float,
    weekly_h: float,
    weeks_left: float,
    a: float,
    cuts: Mapping[str, float],
    non_negotiables: Collection[str] = (),
) -> TradeoffOption:
    """Same goal and date, more hours a week, paid for by named cuts. Never a non-negotiable."""
    f = feasibility(effort_h, weekly_h, weeks_left, a)
    if f.weekly_h_needed is None:
        return TradeoffOption("add_time", False, reason="date_passed")
    needed = math.ceil(f.weekly_h_needed * 2) / 2  # half-hour steps
    if needed > MAX_WEEKLY_H:
        return TradeoffOption("add_time", False, reason="over_ceiling", weekly_h=needed,
                              extra_weekly_h=needed - weekly_h)
    gap = max(0.0, needed - weekly_h)
    blocked = set(non_negotiables)
    chosen: list[str] = []
    freed = 0.0
    for key, hours in sorted(cuts.items(), key=lambda kv: (-kv[1], kv[0])):
        if freed + 1e-9 >= gap:
            break
        if key in blocked or hours <= 0:
            continue
        chosen.append(key)
        freed += hours
    if freed + 1e-9 < gap:
        return TradeoffOption("add_time", False, reason="cuts_insufficient", weekly_h=needed,
                              extra_weekly_h=gap, cuts=tuple(chosen))
    after = feasibility(effort_h, needed, weeks_left, a)
    return TradeoffOption("add_time", True, weekly_h=needed, extra_weekly_h=gap,
                          cuts=tuple(chosen), effort_h=effort_h, coverage=after.coverage,
                          status=after.status)


def narrow_scope(
    narrowed_effort_h: float | None, weekly_h: float, weeks_left: float, a: float
) -> TradeoffOption:
    """A smaller first goal on the same date. The narrowed effort is a model estimate."""
    if not narrowed_effort_h or narrowed_effort_h <= 0:
        return TradeoffOption("narrow_scope", False, reason="no_estimate")
    f = feasibility(narrowed_effort_h, weekly_h, weeks_left, a)
    return TradeoffOption("narrow_scope", True, weekly_h=weekly_h, effort_h=narrowed_effort_h,
                          coverage=f.coverage, status=f.status)


def options(
    *,
    today: date,
    effort_h: float,
    weekly_h: float,
    weeks_left: float,
    a: float,
    cuts: Mapping[str, float],
    non_negotiables: Collection[str] = (),
    narrowed_effort_h: float | None = None,
) -> list[TradeoffOption]:
    return [
        move_date(today, effort_h, weekly_h, a),
        add_time(effort_h, weekly_h, weeks_left, a, cuts, non_negotiables),
        narrow_scope(narrowed_effort_h, weekly_h, weeks_left, a),
    ]


def scaled_capacity(weekday_minutes: int, weekend_minutes: int, new_weekly_h: float
                    ) -> tuple[int, int]:
    """Spread extra weekly hours over the same days in the same proportion, in 5-minute steps."""
    current = weekly_hours(weekday_minutes, weekend_minutes)
    if current <= 0:
        per_day = new_weekly_h * 60 / 7
        return (_round5(per_day), _round5(per_day))
    factor = new_weekly_h / current
    return (_round5(weekday_minutes * factor), _round5(weekend_minutes * factor))


def _round5(minutes: float) -> int:
    return max(5, int(math.ceil(minutes / 5) * 5))
