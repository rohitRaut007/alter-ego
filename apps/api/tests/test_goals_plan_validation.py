"""Plan validation and projection. Pure: no database, no model."""

import copy
import json
from datetime import date

import pytest

from goals.plan_validation import (
    DAY1_MAX_MINUTES,
    MAX_ERRORS,
    PlanContext,
    normalise_plan,
    validate_plan,
    week_days,
)
from goals.projection import carried_ids, project_mission, project_sprint
from goals.schema import GoalModelV1, PlanV1
from protocol.schema.v2 import DISCLAIMER, ProtocolDocument

START = date(2026, 10, 22)  # a Thursday: day 1 is a Friday, days 2 and 3 are the weekend

CTX = PlanContext(start=START, sprint_days=90, target_day=266, window_start_day=1,
                  weekday_minutes=60, weekend_minutes=120)

GOAL = GoalModelV1.model_validate({
    "path": "architect", "statement": "Work as an ML engineer on a platform team",
    "horizon": "1y", "target_date": "2027-07-15", "weekday_minutes": 60, "weekend_minutes": 120,
    "first_task_when": "evening", "obstacle": "I lose interest after the start",
    "commitment": "One model deployed behind an API I wrote.",
})


def task(day: int, minutes: int, i: int = 1, **extra) -> dict:
    return {"id": f"d{day}_t{i}", "title": f"Day {day} step", "detail": "Do the step.",
            "layer": "mission", "due_day": day, "minutes": minutes, "milestone_id": "m1",
            "fallback": "The 10-minute version.", "fallback_minutes": min(10, minutes), **extra}


def make_plan(ctx: PlanContext = CTX, milestones: int = 3) -> dict:
    """A valid plan: a 10-minute day 1, then half the day's capacity every other day."""
    days = [ctx.target_day * (i + 1) // milestones for i in range(milestones)]
    ms = [{"id": f"m{i + 1}", "title": f"Milestone {i + 1}", "due_day": d,
           "evidence": "Something you can point to.", "lead_measures": ["Hours a week"]}
          for i, d in enumerate(days)]
    weeks = []
    for index in range(1, ctx.week_count + 1):
        first, last = week_days(index)
        tasks = []
        for day in range(first, last + 1):
            if not ctx.in_window(day):
                continue
            if ctx.is_initial and day == 1:
                tasks.append(task(1, 10))
            elif (day - ctx.window_start_day) % 2 == 1:
                tasks.append(task(day, ctx.capacity(day) // 2))
        weeks.append({"index": index, "theme": f"Week {index}", "outcome": "A visible result.",
                      "tasks": tasks})
    return {"milestones": ms, "weeks": weeks, "strategy": "Serve models first, then pipelines.",
            "risks": [{"risk": "Interest fades in week 3", "early_signal": "Two skipped days",
                       "response": "Do the fallback"}]}


def check(plan: dict, ctx: PlanContext = CTX):
    return validate_plan(normalise_plan(plan, ctx), ctx)


def codes(plan: dict, ctx: PlanContext = CTX) -> list[str]:
    return [e.code for e in check(plan, ctx)[1]]


def only_error(plan: dict, ctx: PlanContext = CTX):
    _, errors = check(plan, ctx)
    assert len(errors) == 1, errors
    return errors[0]


def week(plan: dict, index: int) -> dict:
    return next(w for w in plan["weeks"] if w["index"] == index)


# --- validation --------------------------------------------------------------------------


def test_a_valid_plan_passes():
    parsed, errors = check(make_plan())
    assert errors == [] and isinstance(parsed, PlanV1)


def test_context_arithmetic():
    assert (CTX.window_end_day, CTX.week_count) == (14, 13)
    assert [CTX.capacity(d) for d in (1, 2, 3, 4)] == [60, 120, 120, 60]
    assert CTX.week_budget(1) == int((60 + 120 + 120 + 60 * 4) * 0.85)
    assert CTX.week_budget(3) == 0  # outside the window


def test_week_over_budget():
    plan = make_plan()
    week(plan, 1)["tasks"] = [task(1, 10)] + [task(d, CTX.capacity(d)) for d in range(2, 8)]
    e = only_error(plan)
    assert (e.code, e.path, e.observed, e.allowed) == ("week_over_budget", "/weeks/0/tasks",
                                                       490, "<=459")


def test_day_over_capacity():
    plan = make_plan()
    week(plan, 1)["tasks"].append(task(5, 90, i=2))  # a weekday with nothing planned yet
    e = only_error(plan)
    assert (e.code, e.observed, e.allowed) == ("day_over_capacity", 90, "<=60")
    plan = make_plan()
    week(plan, 1)["tasks"].append(task(4, 40, i=2))  # day 4 already holds 30 minutes
    assert only_error(plan).observed == 70
    assert e.path.endswith("/minutes")


def test_day_one_needs_one_small_task():
    plan = make_plan()
    week(plan, 1)["tasks"] = week(plan, 1)["tasks"][1:]
    assert only_error(plan).code == "day1_missing"
    plan = make_plan()
    week(plan, 1)["tasks"][0]["minutes"] = DAY1_MAX_MINUTES + 1
    e = only_error(plan)
    assert (e.code, e.observed, e.allowed) == ("day1_too_long", 15, "<=14")


def test_tasks_stay_inside_the_window_and_their_week():
    plan = make_plan()
    week(plan, 3)["tasks"] = [task(15, 30)]
    e = only_error(plan)
    assert (e.code, e.observed, e.allowed) == ("task_outside_window", 15, [1, 14])
    plan = make_plan()
    week(plan, 1)["tasks"].append(task(9, 20, i=2))
    e = only_error(plan)
    assert (e.code, e.allowed) == ("task_in_wrong_week", [1, 7])


def test_later_weeks_need_an_outcome():
    plan = make_plan()
    del week(plan, 5)["outcome"]
    e = only_error(plan)
    assert (e.code, e.path) == ("week_outcome_missing", "/weeks/4/outcome")
    plan = make_plan()
    del week(plan, 1)["outcome"]  # window weeks may omit it
    assert codes(plan) == []


@pytest.mark.parametrize(
    ("change", "code", "allowed"),
    [
        ({"fallback": None}, "fallback_missing", "text + minutes"),
        ({"fallback_minutes": None}, "fallback_missing", "text + minutes"),
        ({"fallback_minutes": 20}, "fallback_too_long", "<=15"),
    ],
)
def test_every_task_has_a_short_fallback(change, code, allowed):
    plan = make_plan()
    t = week(plan, 1)["tasks"][1]
    t.update({k: v for k, v in change.items() if v is not None})
    for k, v in change.items():
        if v is None:
            t.pop(k)
    e = only_error(plan)
    assert (e.code, e.allowed) == (code, allowed)


def test_a_fallback_is_shorter_than_its_task():
    plan = make_plan()
    week(plan, 1)["tasks"][0]["fallback_minutes"] = 12  # the 10-minute day-1 task
    assert only_error(plan).allowed == "<=10"


def test_every_task_names_a_known_milestone():
    plan = make_plan()
    week(plan, 1)["tasks"][1]["milestone_id"] = "m9"
    e = only_error(plan)
    assert (e.code, e.observed, e.allowed) == ("unknown_milestone", "m9", ["m1", "m2", "m3"])
    plan = make_plan()
    del week(plan, 1)["tasks"][1]["milestone_id"]
    assert only_error(plan).code == "milestone_missing"


@pytest.mark.parametrize("n", [2, 7])
def test_three_to_six_milestones(n):
    e = only_error(make_plan(milestones=n))
    assert (e.code, e.observed) == ("milestone_count", n)


def test_milestones_ascend_and_end_on_the_target_day():
    plan = make_plan()
    plan["milestones"][1]["due_day"] = plan["milestones"][0]["due_day"]
    assert only_error(plan).code == "milestone_order"
    plan = make_plan()
    plan["milestones"][-1]["due_day"] = CTX.target_day - 30
    e = only_error(plan)
    assert (e.code, e.allowed) == ("milestone_target", 266)


def test_a_last_milestone_a_few_days_off_is_snapped_without_a_retry():
    plan = make_plan()
    plan["milestones"][-1]["due_day"] = CTX.target_day - 3
    parsed, errors = check(plan)
    assert errors == [] and parsed.milestones[-1].due_day == CTX.target_day


def test_shape_errors_carry_a_json_pointer():
    plan = make_plan()
    plan["milestones"][0]["lead_measures"] = []
    plan["weeks"][0]["tasks"][0]["surprise"] = "x"
    parsed, errors = check(plan)
    assert parsed is None
    assert {(e.code, e.path) for e in errors} == {
        ("schema", "/milestones/0/lead_measures"), ("schema", "/weeks/0/tasks/0/surprise")}


def test_outcome_promises_are_reported_where_they_are():
    plan = make_plan()
    week(plan, 1)["tasks"][1]["detail"] = "This will make you an engineer."
    e = only_error(plan)
    assert (e.code, e.path, e.observed) == ("banned_phrase", "/weeks/0/tasks/1/detail",
                                            "will make you")


def test_ids_are_unique_including_carried_tasks():
    plan = make_plan()
    week(plan, 2)["tasks"][0]["id"] = week(plan, 1)["tasks"][0]["id"]
    assert only_error(plan).code == "duplicate_id"
    ctx = PlanContext(**{**CTX.__dict__, "carried_ids": frozenset({"d2_t1"})})
    assert only_error(make_plan(), ctx).code == "duplicate_id"


def test_every_sprint_week_appears_once():
    plan = make_plan()
    plan["weeks"] = plan["weeks"][:-1]
    e = only_error(plan)
    assert (e.code, e.allowed) == ("week_coverage", list(range(1, 14)))


def test_errors_are_capped_sorted_and_serialisable():
    plan = make_plan()
    for t in week(plan, 1)["tasks"] + week(plan, 2)["tasks"]:
        t.pop("fallback")
        t["milestone_id"] = "nope"
    _, errors = check(plan)
    assert len(errors) == MAX_ERRORS
    assert [e.path for e in errors] == sorted(e.path for e in errors)
    json.dumps([e.as_dict() for e in errors])


def test_a_window_rebuild_starts_mid_sprint():
    ctx = PlanContext(**{**CTX.__dict__, "window_start_day": 13})
    assert (ctx.window_end_day, ctx.is_initial) == (26, False)
    plan = make_plan(ctx)
    assert codes(plan, ctx) == []  # no day-1 rule after the first window
    week(plan, 2)["tasks"].append(task(10, 10, i=3))
    assert codes(plan, ctx) == ["task_outside_window"]
    assert ctx.week_budget(2) == int((ctx.capacity(13) + ctx.capacity(14)) * 0.85)


def test_short_goals_have_short_sprints():
    ctx = PlanContext(start=START, sprint_days=30, target_day=30, window_start_day=1,
                      weekday_minutes=30, weekend_minutes=60)
    assert ctx.week_count == 5
    assert codes(make_plan(ctx), ctx) == []


# --- projection --------------------------------------------------------------------------


def valid(plan: dict, ctx: PlanContext = CTX) -> PlanV1:
    parsed, errors = check(plan, ctx)
    assert errors == []
    return parsed


def test_the_plan_becomes_a_rolling_sprint_section():
    sprint = project_sprint(valid(make_plan()), CTX, GOAL)
    assert sprint["goal"] == GOAL.commitment
    assert len(sprint["weeks"]) == 13 and len(sprint["milestones"]) == 3
    assert all(w["tasks"] for w in sprint["weeks"][:2])
    assert all(not w["tasks"] and w["outcome"] for w in sprint["weeks"][2:])
    first = sprint["weeks"][0]["tasks"][0]
    assert first["due_day"] == 1 and first["fallback_minutes"] <= 10


def test_the_plan_becomes_the_mission_section():
    mission = project_mission(valid(make_plan()), GOAL)
    assert mission["statement"] == GOAL.statement
    assert [p["name"] for p in mission["roadmap"]] == ["Milestone 1", "Milestone 2",
                                                       "Milestone 3"]
    assert mission["risks"] == ["Interest fades in week 3"]
    six = make_plan(milestones=6)
    six["risks"] = []
    mission = project_mission(valid(six), GOAL)
    assert len(mission["roadmap"]) == 5 and len(mission["roadmap"][-1]["outcomes"]) == 2
    assert mission["risks"] == [GOAL.obstacle]


def test_a_plan_stage_document_is_valid():
    plan = valid(make_plan())
    ProtocolDocument.model_validate({
        "schema_version": "2.0.0", "generated_at": "2026-10-22T05:30:00Z",
        "mission": project_mission(plan, GOAL), "sprint_90": project_sprint(plan, CTX, GOAL),
        "disclaimer": DISCLAIMER,
    })


def test_a_window_rebuild_keeps_past_tasks_and_weeks():
    first = project_sprint(valid(make_plan()), CTX, GOAL)
    first["weeks"][0]["theme"] = "The week as it was"
    ctx = PlanContext(**{**CTX.__dict__, "window_start_day": 13,
                         "carried_ids": carried_ids(first, 13)})
    plan = make_plan(ctx)
    for w in plan["weeks"]:
        for t in w["tasks"]:
            t["id"] = "r" + t["id"]
    plan["milestones"][0]["id"] = "n1"
    for w in plan["weeks"]:
        for t in w["tasks"]:
            t["milestone_id"] = "n1"
    second = project_sprint(valid(plan, ctx), ctx, GOAL, previous=first)

    before = {t["id"] for w in first["weeks"] for t in w["tasks"] if t["due_day"] < 13}
    after = {t["id"]: t for w in second["weeks"] for t in w["tasks"]}
    assert before <= set(after)
    assert second["weeks"][0]["theme"] == "The week as it was"  # fully past week kept
    # Week 2 mixes carried days 8-12 with the new window's days 13-14.
    assert {t["due_day"] for t in second["weeks"][1]["tasks"]} >= {8, 14}
    # Carried tasks lose a milestone link the rebuilt plan no longer has.
    assert all("milestone_id" not in after[i] for i in before)
    assert carried_ids(first, 13) == frozenset(before)


def test_projection_does_not_mutate_its_inputs():
    first = project_sprint(valid(make_plan()), CTX, GOAL)
    snapshot = copy.deepcopy(first)
    ctx = PlanContext(**{**CTX.__dict__, "window_start_day": 13,
                         "carried_ids": carried_ids(first, 13)})
    plan = make_plan(ctx)
    for w in plan["weeks"]:
        for t in w["tasks"]:
            t["id"] = "r" + t["id"]
    project_sprint(valid(plan, ctx), ctx, GOAL, previous=first)
    assert first == snapshot
