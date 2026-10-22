"""Goal horizons: the Seed's date chips, bounds on a picked date, and the sprint window.

Pure functions. Dates are the user's local dates; callers pass `clock.local_today(user)`.
"""

from datetime import date, timedelta
from typing import Literal

Horizon = Literal["3m", "6m", "1y", "2y"]

# Fixed day counts keep the maths obvious and avoid a calendar-arithmetic dependency.
HORIZON_DAYS: dict[str, int] = {"3m": 91, "6m": 182, "1y": 365, "2y": 730}

MIN_TARGET_DAYS = 14
MAX_TARGET_DAYS = 730

# Explorers get a goal to test, not a calling: a short horizon with a recheck halfway.
EXPLORER_TARGET_DAYS = 90
EXPLORER_RECHECK_DAYS = 45

# The sprint is the first wave of the goal. Plans are rolled forward after it (Phase 2).
SPRINT_MAX_DAYS = 90


class HorizonError(ValueError):
    pass


def target_from_horizon(today: date, horizon: str) -> date:
    try:
        return today + timedelta(days=HORIZON_DAYS[horizon])
    except KeyError:
        raise HorizonError(f"Unknown horizon {horizon!r}") from None


def validate_target(today: date, target: date) -> date:
    """A picked target date must leave room for a plan and stay within two years."""
    days = (target - today).days
    if days < MIN_TARGET_DAYS:
        raise HorizonError(f"The target date must be at least {MIN_TARGET_DAYS} days away.")
    if days > MAX_TARGET_DAYS:
        raise HorizonError(f"The target date must be within {MAX_TARGET_DAYS} days.")
    return target


def days_between(start: date, end: date) -> int:
    return (end - start).days


def weeks_between(start: date, end: date) -> float:
    return (end - start).days / 7


def sprint_end(start: date, target: date) -> date:
    """The sprint covers the first 90 days of the goal, or less when the goal is shorter."""
    return start + timedelta(days=max(1, min(SPRINT_MAX_DAYS, (target - start).days)))
