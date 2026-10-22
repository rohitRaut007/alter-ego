"""Does the goal fit the time the user can honestly give it? Pure arithmetic, no model.

The model estimates effort; this module decides. Thresholds and priors are starting assumptions
to tune against real completion data (ADR 0010).
"""

from dataclasses import asdict, dataclass
from typing import Any, Literal

Status = Literal["feasible", "stretch", "tradeoff"]

# Outside view against the planning fallacy: "last time you committed to something big on your
# own, how long did it hold?" The answer is the starting adherence until real data replaces it.
ADHERENCE_PRIOR: dict[str, float] = {"<2w": 0.5, "~1m": 0.6, "~3m": 0.7, "finished": 0.8}
DEFAULT_ADHERENCE_BUCKET = "~1m"

# Days of measured completion that count as much as the self-reported prior.
PRIOR_WEIGHT_DAYS = 14
ADHERENCE_MIN = 0.05
ADHERENCE_MAX = 1.0

FEASIBLE_AT = 1.0
STRETCH_AT = 0.8
_EPS = 1e-9

WEEKDAYS_PER_WEEK = 5
WEEKEND_DAYS_PER_WEEK = 2


def adherence_prior(bucket: str) -> float:
    try:
        return ADHERENCE_PRIOR[bucket]
    except KeyError:
        raise ValueError(f"Unknown adherence bucket {bucket!r}") from None


def _clamp(value: float) -> float:
    return min(ADHERENCE_MAX, max(ADHERENCE_MIN, value))


def adherence(
    prior: float, measured: float | None, days_observed: int, k: int = PRIOR_WEIGHT_DAYS
) -> float:
    """Blend the self-report prior with measured completion. Data wins as days accumulate."""
    if measured is None or days_observed <= 0:
        return _clamp(prior)
    return _clamp((prior * k + _clamp(measured) * days_observed) / (k + days_observed))


def weekly_hours(weekday_minutes: int, weekend_minutes: int) -> float:
    total = weekday_minutes * WEEKDAYS_PER_WEEK + weekend_minutes * WEEKEND_DAYS_PER_WEEK
    return max(0, total) / 60


def status_for(coverage: float) -> Status:
    if coverage + _EPS >= FEASIBLE_AT:
        return "feasible"
    if coverage + _EPS >= STRETCH_AT:
        return "stretch"
    return "tradeoff"


@dataclass(frozen=True)
class Feasibility:
    effort_h: float
    weekly_h: float
    weeks_left: float
    adherence: float
    effective_h: float
    coverage: float
    status: Status
    # Weeks the goal takes at the current weekly hours; None when no time is available.
    weeks_needed: float | None
    # Weekly hours needed to finish by the target date; None when the date has passed.
    weekly_h_needed: float | None

    def as_dict(self) -> dict[str, Any]:
        """Rounded for storage and display. Status is decided on the unrounded coverage."""
        out = asdict(self)
        for key, digits in (("effort_h", 1), ("weekly_h", 2), ("weeks_left", 1),
                            ("adherence", 2), ("effective_h", 1), ("coverage", 2),
                            ("weeks_needed", 1), ("weekly_h_needed", 1)):
            if out[key] is not None:
                out[key] = round(out[key], digits)
        return out


def feasibility(effort_h: float, weekly_h: float, weeks_left: float, a: float) -> Feasibility:
    if effort_h <= 0:
        raise ValueError("Effort must be positive.")
    weekly_h = max(0.0, weekly_h)
    a = _clamp(a)
    effective = weekly_h * max(0.0, weeks_left) * a
    coverage = effective / effort_h
    pace = weekly_h * a
    return Feasibility(
        effort_h=effort_h,
        weekly_h=weekly_h,
        weeks_left=weeks_left,
        adherence=a,
        effective_h=effective,
        coverage=coverage,
        status=status_for(coverage),
        weeks_needed=effort_h / pace if pace > 0 else None,
        weekly_h_needed=effort_h / (weeks_left * a) if weeks_left > 0 else None,
    )
