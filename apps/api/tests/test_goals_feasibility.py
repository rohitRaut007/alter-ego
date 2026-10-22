"""Feasibility, horizon and tradeoff maths. Pure functions: no database, no model."""

import json
from datetime import date, timedelta

import pytest

from goals.feasibility import (
    ADHERENCE_PRIOR,
    adherence,
    adherence_prior,
    feasibility,
    status_for,
    weekly_hours,
)
from goals.horizon import (
    HORIZON_DAYS,
    HorizonError,
    sprint_end,
    target_from_horizon,
    validate_target,
)
from goals.tradeoffs import (
    MAX_WEEKLY_H,
    add_time,
    move_date,
    narrow_scope,
    options,
    scaled_capacity,
)

TODAY = date(2026, 10, 22)


# --- adherence ----------------------------------------------------------------------------


def test_adherence_is_the_prior_until_there_is_data():
    assert adherence(0.6, None, 10) == 0.6
    assert adherence(0.6, 0.9, 0) == 0.6


def test_adherence_weighs_the_prior_like_fourteen_days_of_data():
    assert adherence(0.6, 0.9, 14) == pytest.approx(0.75)
    assert adherence(0.6, 0.9, 140) > 0.85  # data wins as days accumulate


def test_adherence_is_clamped():
    assert adherence(0.6, 1.5, 1000) <= 1.0
    assert adherence(0.0, None, 0) == pytest.approx(0.05)


def test_adherence_priors_match_the_reality_question():
    assert [adherence_prior(b) for b in ("<2w", "~1m", "~3m", "finished")] == [0.5, 0.6, 0.7, 0.8]
    assert set(ADHERENCE_PRIOR) == {"<2w", "~1m", "~3m", "finished"}
    with pytest.raises(ValueError):
        adherence_prior("forever")


# --- capacity -----------------------------------------------------------------------------


def test_weekly_hours_counts_five_weekdays_and_two_weekend_days():
    assert weekly_hours(30, 60) == pytest.approx(4.5)
    assert weekly_hours(90, 240) == pytest.approx(15.5)
    assert weekly_hours(0, 0) == 0


# --- feasibility --------------------------------------------------------------------------


@pytest.mark.parametrize(("a", "status"), [(1.0, "feasible"), (0.8, "stretch"), (0.79, "tradeoff")])
def test_status_boundaries(a, status):
    result = feasibility(100, 10, 10, a)
    assert result.status == status
    assert result.coverage == pytest.approx(a)


def test_status_for_tolerates_float_noise():
    assert status_for(0.9999999999999) == "feasible"
    assert status_for(0.7999999999999) == "stretch"


def test_the_blueprint_worked_example():
    """650 h of effort, 15.5 h a week, 39 weeks to July, adherence 0.65."""
    result = feasibility(650, 15.5, 39, 0.65)
    assert result.effective_h == pytest.approx(392.9, abs=0.1)
    assert round(result.coverage, 2) == 0.60
    assert result.status == "tradeoff"
    assert result.weeks_needed == pytest.approx(64.5, abs=0.1)
    assert result.weekly_h_needed == pytest.approx(25.6, abs=0.1)


def test_no_time_means_no_coverage():
    result = feasibility(100, 0, 20, 0.6)
    assert result.coverage == 0 and result.status == "tradeoff"
    assert result.weeks_needed is None
    assert result.weekly_h_needed is not None


def test_a_passed_date_cannot_be_met():
    result = feasibility(100, 10, 0, 0.6)
    assert result.status == "tradeoff"
    assert result.weekly_h_needed is None
    assert feasibility(100, 10, -3, 0.6).coverage == 0


@pytest.mark.parametrize("effort", [0, -5])
def test_effort_must_be_positive(effort):
    with pytest.raises(ValueError):
        feasibility(effort, 10, 10, 0.6)


@pytest.mark.parametrize(
    ("base", "more"),
    [
        ((100, 5, 10, 0.6), (100, 6, 10, 0.6)),   # more hours
        ((100, 5, 10, 0.6), (100, 5, 12, 0.6)),   # more weeks
        ((100, 5, 10, 0.6), (100, 5, 10, 0.7)),   # better adherence
        ((120, 5, 10, 0.6), (100, 5, 10, 0.6)),   # less effort
    ],
)
def test_coverage_is_monotonic(base, more):
    assert feasibility(*more).coverage > feasibility(*base).coverage


def test_rounded_dict_is_json_ready():
    out = feasibility(650, 15.5, 39, 0.65).as_dict()
    assert out["coverage"] == 0.6 and out["status"] == "tradeoff"
    json.dumps(out)


# --- horizon ------------------------------------------------------------------------------


def test_horizon_chips_are_fixed_day_counts():
    assert {k: (target_from_horizon(TODAY, k) - TODAY).days for k in HORIZON_DAYS} == {
        "3m": 91, "6m": 182, "1y": 365, "2y": 730,
    }
    with pytest.raises(HorizonError):
        target_from_horizon(TODAY, "10y")


@pytest.mark.parametrize(("days", "ok"), [(13, False), (14, True), (730, True), (731, False)])
def test_picked_dates_must_be_two_weeks_to_two_years_away(days, ok):
    target = TODAY + timedelta(days=days)
    if ok:
        assert validate_target(TODAY, target) == target
    else:
        with pytest.raises(HorizonError):
            validate_target(TODAY, target)


def test_the_sprint_is_the_first_ninety_days_of_the_goal():
    assert sprint_end(TODAY, TODAY + timedelta(days=365)) == TODAY + timedelta(days=90)
    assert sprint_end(TODAY, TODAY + timedelta(days=30)) == TODAY + timedelta(days=30)


# --- tradeoffs ----------------------------------------------------------------------------


def test_move_date_finds_the_date_the_current_pace_reaches():
    option = move_date(TODAY, 650, 15.5, 0.65)
    assert option.available
    assert option.target_date == TODAY + timedelta(days=452)  # ceil(64.52 weeks * 7)
    assert option.status == "feasible" and option.coverage >= 1


def test_move_date_is_unavailable_beyond_two_years_or_without_time():
    assert move_date(TODAY, 2000, 2, 0.5).reason == "beyond_max_horizon"
    assert move_date(TODAY, 100, 0, 0.6).reason == "no_time"


def test_add_time_names_what_gets_cut_largest_first():
    option = add_time(650, 15.5, 39, 0.65, {"gaming": 6, "youtube": 5, "lie_ins": 2})
    assert option.available
    assert option.weekly_h == 26.0  # 25.64 rounded up to the half hour
    assert option.extra_weekly_h == pytest.approx(10.5)
    assert option.cuts == ("gaming", "youtube")
    assert option.status == "feasible"


def test_add_time_stops_once_the_gap_is_covered():
    option = add_time(100, 5, 10, 0.5, {"small": 2, "big": 30, "medium": 5})
    assert option.available and option.cuts == ("big",)


def test_add_time_never_cuts_a_non_negotiable():
    option = add_time(650, 15.5, 39, 0.65, {"family": 20, "gaming": 6}, {"family"})
    assert not option.available and option.reason == "cuts_insufficient"
    assert "family" not in option.cuts


def test_add_time_refuses_burnout_loads():
    option = add_time(2000, 10, 20, 0.6, {"everything": 100})
    assert not option.available and option.reason == "over_ceiling"
    assert option.weekly_h > MAX_WEEKLY_H


def test_add_time_cannot_rescue_a_passed_date():
    assert add_time(100, 5, 0, 0.6, {"gaming": 50}).reason == "date_passed"


def test_narrow_scope_recomputes_coverage_with_the_smaller_goal():
    option = narrow_scope(380, 15.5, 39, 0.65)
    assert option.available and option.status == "feasible"
    assert option.coverage == pytest.approx(1.03, abs=0.01)
    assert narrow_scope(None, 15.5, 39, 0.65).reason == "no_estimate"


def test_options_are_always_the_same_three_in_order():
    out = options(today=TODAY, effort_h=650, weekly_h=15.5, weeks_left=39, a=0.65,
                  cuts={"gaming": 6, "youtube": 5}, narrowed_effort_h=380)
    assert [o.key for o in out] == ["move_date", "add_time", "narrow_scope"]
    payload = [o.as_dict() for o in out]
    json.dumps(payload)
    assert payload[0]["target_date"] == (TODAY + timedelta(days=452)).isoformat()


def test_extra_hours_are_spread_over_the_same_days():
    weekday, weekend = scaled_capacity(90, 240, 26)
    assert (weekday, weekend) == (155, 405)
    assert weekly_hours(weekday, weekend) >= 26
