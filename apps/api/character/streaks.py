"""Streak maths. Pure functions so the rules are easy to test."""

from datetime import date, timedelta


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _runs(keys: set[date], step: timedelta) -> int:
    """Length of the longest run of consecutive keys."""
    best = run = 0
    prev: date | None = None
    for k in sorted(keys):
        run = run + 1 if prev is not None and k - prev == step else 1
        best = max(best, run)
        prev = k
    return best


def streak_stats(dates: set[date], today: date, cadence: str = "daily") -> tuple[int, int]:
    """Return (current, best) streak.

    A streak stays alive until the period after the last completion ends: a daily streak that
    was last logged yesterday is still current today; a weekly one carries through this week.
    """
    if not dates:
        return 0, 0
    if cadence == "weekly":
        keys = {_monday(d) for d in dates}
        step = timedelta(days=7)
        anchor = _monday(today)
    else:
        keys = set(dates)
        step = timedelta(days=1)
        anchor = today
    best = _runs(keys, step)
    if anchor not in keys:
        anchor -= step
    current = 0
    while anchor in keys:
        current += 1
        anchor -= step
    return current, best
