"""Card engine: next question, answer parsing, slot rules and card states. Pure, no database."""

import pytest

from goals.engine import (
    Answer,
    AnswerError,
    CardStatus,
    Fill,
    GoalFacts,
    apply_fills,
    card_states,
    deterministic_fills,
    is_complete,
    next_question,
    next_state,
    parse_if_then,
    progress,
    quote_in,
    skip,
    values,
)
from goals.schema import GoalModelV1, merge
from goals.slots import (
    CARD_KEYS,
    CARDS,
    SLOTS,
    SLOTS_BY_KEY,
    Choice,
    question_count,
    slots_for,
)


def user(value, confidence=1.0, **extra):
    return {"value": value, "confidence": confidence, "quote": None, "source": "user",
            "followups": 0, **extra}


GOAL_DONE = {
    "outcome_image": user("I ship models at work on a normal Tuesday."),
    "success_metric": user({"kind": "role", "target": "An offer for an MLOps role"}),
    "why": user(["enjoy", "fits_me"]),
    "anonymity": user("yes"),
    "obstacle": user("I lose interest after the start"),
    "if_then": user({"if_cue": "I skip two days", "then_action": "I do 15 minutes"}),
    "commitment": user("One model deployed behind an API I wrote."),
}


def ask(card, path, slots):
    q = next_question(card, path, slots)
    return (q.slot.key, q.is_followup) if q else None


# --- registry ----------------------------------------------------------------------------


def test_registry_is_consistent():
    assert set(CARDS) == set(CARD_KEYS)
    for spec in SLOTS:
        assert spec.card in CARDS and CARDS[spec.card].kind == "questions"
        for dep in spec.depends_on:
            assert dep in SLOTS_BY_KEY and SLOTS_BY_KEY[dep].card == spec.card
        if spec.input in ("chips", "multi_chips") and spec.llm == "none":
            assert spec.choices, spec.key
    # Slot keys are Goal Model fields, so filled slots merge straight in.
    assert set(SLOTS_BY_KEY) <= set(GoalModelV1.model_fields)


def test_question_counts_differ_by_path():
    assert question_count("goal", "architect") == 7
    assert question_count("goal", "navigator") == 8
    assert question_count("reality", "architect") == 3
    assert question_count("tradeoffs", "architect") == 3


# --- next question -----------------------------------------------------------------------


def test_architect_starts_with_the_picture_of_the_day():
    assert ask("goal", "architect", {}) == ("outcome_image", False)


@pytest.mark.parametrize("path", ["navigator", "explorer"])
def test_navigators_and_explorers_start_by_choosing_a_concrete_goal(path):
    q = next_question("goal", path, {})
    assert q.slot.key == "statement" and q.slot.input == "options"
    assert ("worth testing" in q.slot.prompt_for(path)) == (path == "explorer")


def test_one_answer_can_fill_two_questions():
    slots = {"outcome_image": user("x" * 10, 0.9), "success_metric": user({"kind": "role",
                                                                          "target": "t"}, 0.8)}
    assert ask("goal", "architect", slots) == ("why", False)


def test_low_confidence_gets_exactly_one_follow_up():
    slots = {"outcome_image": user("better", 0.4)}
    assert ask("goal", "architect", slots) == ("outcome_image", True)
    slots["outcome_image"]["followups"] = 1  # follow-up answered, still vague
    assert ask("goal", "architect", slots) == ("success_metric", False)


def test_the_if_then_plan_waits_for_the_obstacle():
    slots = {k: v for k, v in GOAL_DONE.items() if k not in ("obstacle", "if_then", "commitment")}
    assert ask("goal", "architect", slots) == ("obstacle", False)


def test_a_navigator_pick_that_names_a_metric_skips_the_metric_question():
    slots = {"statement": user("Ship a portfolio of 3 design case studies"),
             "success_metric": user({"kind": "shipped", "target": "3 case studies online"})}
    assert ask("goal", "navigator", slots) == ("outcome_image", False)
    slots["outcome_image"] = user("I open my portfolio and it is real.")
    assert ask("goal", "navigator", slots) == ("why", False)


def test_a_card_is_complete_when_every_question_is_settled():
    assert is_complete("goal", "architect", GOAL_DONE)
    assert not is_complete("goal", "navigator", GOAL_DONE)  # navigators also pick a statement
    assert progress("goal", "architect", GOAL_DONE) == 1.0


def test_optional_questions_can_be_skipped_and_are_not_asked_again():
    slots = {"stage": user("starting"), "skills_have": user(["python"]),
             "adherence_bucket": user("~1m")}
    assert ask("reality", "architect", slots) == ("fixed_commitments", False)
    for key in ("fixed_commitments", "resources", "people"):
        slots = skip("reality", "architect", slots, key)
    assert is_complete("reality", "architect", slots)
    assert "people" not in values(slots)
    with pytest.raises(AnswerError):
        skip("reality", "architect", {}, "stage")


def test_progress_only_moves_forward():
    seen = []
    slots: dict = {}
    for key in ("outcome_image", "success_metric", "why", "anonymity", "obstacle", "if_then",
                "commitment"):
        seen.append(progress("goal", "architect", slots))
        slots[key] = GOAL_DONE[key]
    seen.append(progress("goal", "architect", slots))
    assert seen == sorted(seen) and seen[-1] == 1.0


# --- applying fills ----------------------------------------------------------------------


def apply(slots, fills, target, text, followup=False, card="goal", path="architect"):
    return apply_fills(card, path, slots, fills, target=target, answer_text=text,
                       is_followup=followup)


def test_fills_for_another_cards_slots_are_dropped():
    out, accepted = apply({}, [Fill("stage", "starting", 0.9, "just starting", "llm"),
                               Fill("outcome_image", "I deploy models", 0.9,
                                    "I deploy models", "llm")],
                          "outcome_image", "I deploy models, just starting")
    assert accepted == ["outcome_image"] and "stage" not in out


def test_values_that_do_not_fit_the_slot_are_dropped():
    out, accepted = apply({}, [Fill("success_metric", {"kind": "vibes", "target": "x"}, 0.9,
                                    "x", "llm")], "success_metric", "x")
    # The bad extraction is dropped and the user's words are kept for one follow-up.
    assert out["success_metric"]["value"] == {"kind": "custom", "target": "x"}
    assert out["success_metric"]["confidence"] <= 0.5


def test_a_quote_that_is_not_in_the_answer_caps_confidence():
    text = "I want to work as an ML engineer on a platform team"
    grounded, _ = apply({}, [Fill("outcome_image", "ML engineer", 0.9,
                                  "work as an ML engineer", "llm")], "outcome_image", text)
    invented, _ = apply({}, [Fill("outcome_image", "ML engineer", 0.9,
                                  "lead a research lab", "llm")], "outcome_image", text)
    missing, _ = apply({}, [Fill("outcome_image", "ML engineer", 0.9, None, "llm")],
                       "outcome_image", text)
    assert grounded["outcome_image"]["confidence"] == 0.9
    assert invented["outcome_image"]["confidence"] == 0.5
    assert missing["outcome_image"]["confidence"] == 0.5


def test_quote_matching_ignores_case_spacing_and_curly_quotes():
    assert quote_in("ML  Engineer", "I want to be an ml engineer.")
    assert quote_in("“ship it”", 'I said "ship it" twice')
    assert not quote_in("", "anything")


def test_a_users_own_choice_is_never_overwritten_by_the_model():
    slots = {"success_metric": user({"kind": "role", "target": "Offer for an MLOps role"})}
    out, accepted = apply(slots, [Fill("success_metric", {"kind": "income", "target": "x"},
                                       0.95, "x", "llm")], "outcome_image", "x marks it")
    assert out["success_metric"]["value"]["kind"] == "role"
    assert "success_metric" not in accepted


def test_another_slot_is_only_replaced_by_a_more_confident_fill():
    slots = {"success_metric": {**user({"kind": "role", "target": "A role"}, 0.7),
                                "source": "llm"}}
    text = "an offer and a number I can check"
    weaker, _ = apply(slots, [Fill("success_metric", {"kind": "income", "target": "a number"},
                                   0.6, "a number I can check", "llm")], "outcome_image", text)
    stronger, _ = apply(slots, [Fill("success_metric", {"kind": "income", "target": "a number"},
                                     0.9, "a number I can check", "llm")], "outcome_image", text)
    assert weaker["success_metric"]["confidence"] == 0.7
    assert stronger["success_metric"]["value"]["kind"] == "income"


def test_the_target_always_gets_a_value_so_the_card_cannot_loop():
    out, accepted = apply({}, [], "outcome_image", "better")
    assert accepted == ["outcome_image"]
    assert out["outcome_image"]["value"] == "better"
    assert ask("goal", "architect", out) == ("outcome_image", True)
    out, _ = apply(out, [], "outcome_image", "still vague", followup=True)
    assert ask("goal", "architect", out) == ("success_metric", False)


# --- reading answers ---------------------------------------------------------------------


def spec(key):
    return SLOTS_BY_KEY[key]


def test_single_chips_must_be_one_of_the_options_unless_custom_is_allowed():
    s = spec("stage")
    assert deterministic_fills(s, Answer(choices=("momentum",)), list(s.choices), {})[0].value \
        == "momentum"
    with pytest.raises(AnswerError):
        deterministic_fills(s, Answer(choices=("teleported",)), list(s.choices), {})
    with pytest.raises(AnswerError):
        deterministic_fills(s, Answer(choices=("starting", "close")), list(s.choices), {})
    obstacle = spec("obstacle")
    fills = deterministic_fills(obstacle, Answer(text="Meetings eat my evenings"),
                                list(obstacle.choices), {})
    assert fills[0].value == "Meetings eat my evenings"


def test_multi_chips_dedupe_accept_custom_and_respect_empty_rules():
    s = spec("non_negotiables")
    fills = deterministic_fills(s, Answer(choices=("Family time", "Family time", "Choir")),
                                list(s.choices), {})
    assert fills[0].value == ["Family time", "Choir"]
    assert deterministic_fills(s, Answer(), list(s.choices), {})[0].value == []
    why = spec("why")
    with pytest.raises(AnswerError):
        deterministic_fills(why, Answer(), list(why.choices), {})
    with pytest.raises(AnswerError):
        deterministic_fills(why, Answer(choices=("because",)), list(why.choices), {})


def test_unticked_skills_become_the_skills_to_learn():
    offered = [Choice(v, v) for v in ("python", "sql", "model serving", "statistics")]
    fills = deterministic_fills(spec("skills_have"), Answer(choices=("python", "sql")),
                                offered, {})
    assert {f.slot: f.value for f in fills} == {
        "skills_have": ["python", "sql"], "skills_missing": ["model serving", "statistics"]}


def test_text_read_by_code_needs_a_few_words_to_be_confident():
    s = spec("commitment")
    assert deterministic_fills(s, Answer(text="Ship it"), [], {})[0].confidence < 0.6
    assert deterministic_fills(s, Answer(text="One model deployed behind my API"), [], {})[0] \
        .confidence >= 0.6
    assert deterministic_fills(spec("outcome_image"), Answer(text="anything"), [], {}) == []
    with pytest.raises(AnswerError):
        deterministic_fills(s, Answer(text="  "), [], {})


def test_goal_options_fill_the_statement_and_metric():
    offered = [Choice("o1", "Ship 3 case studies", data={
        "statement": "Ship 3 design case studies",
        "success_metric": {"kind": "shipped", "target": "3 case studies online"}})]
    fills = deterministic_fills(spec("statement"), Answer(choices=("o1",)), offered, {})
    assert [f.slot for f in fills] == ["statement", "success_metric"]
    custom = deterministic_fills(spec("statement"), Answer(text="Teach a design workshop"),
                                 offered, {})
    assert custom[0].value == "Teach a design workshop"


def test_if_then_plans_from_options_and_free_text():
    offered = [Choice("p1", "If I skip, then I do 15 minutes",
                      data={"if_then": {"if_cue": "I skip", "then_action": "I do 15 minutes"}})]
    picked = deterministic_fills(spec("if_then"), Answer(choices=("p1",)), offered, {})
    assert picked[0].value["then_action"] == "I do 15 minutes"
    slots = {"obstacle": user("My phone")}
    free = deterministic_fills(spec("if_then"), Answer(text="Put it in the other room"),
                               offered, slots)
    assert free[0].value == {"if_cue": "My phone", "then_action": "Put it in the other room"}


def test_parse_if_then():
    assert parse_if_then("If it's 9 pm and I haven't started, then I do the short version.",
                         None) == {"if_cue": "it's 9 pm and I haven't started",
                                   "then_action": "I do the short version"}
    assert parse_if_then("walk first", "I'm drained")["if_cue"] == "I'm drained"


def test_a_disabled_tradeoff_option_cannot_be_chosen():
    offered = [Choice("move_date", "Move the date", data={"disabled": False}),
               Choice("add_time", "Add time", data={"disabled": True})]
    s = spec("tradeoff_choice")
    assert deterministic_fills(s, Answer(choices=("move_date",)), offered, {})[0].value \
        == "move_date"
    with pytest.raises(AnswerError):
        deterministic_fills(s, Answer(choices=("add_time",)), offered, {})
    with pytest.raises(AnswerError):
        deterministic_fills(s, Answer(text="something else"), offered, {})


def test_filled_slots_merge_into_a_valid_goal_model():
    seed = {"path": "architect", "statement": "works as an ML engineer", "horizon": "1y",
            "target_date": "2027-10-22", "weekday_minutes": 90, "weekend_minutes": 240,
            "first_task_when": "evening"}
    model = merge(seed, values(GOAL_DONE))
    assert model.obstacle == "I lose interest after the start"
    assert model.self_concordance == 1.0


# --- card states -------------------------------------------------------------------------


def states(**kw):
    return {k: (v.state, v.reason) for k, v in card_states(GoalFacts(**kw)).items()}


def test_right_after_the_seed():
    s = card_states(GoalFacts(days_since_start=0))
    assert (s["goal"].state, s["reality"].reason) == ("needs_input", "after_goal")
    assert s["tradeoffs"].reason == "after_reality" and s["plan"].reason == "after_reality"
    assert (s["character"].reason, s["character"].unlocks_in_days) == ("day:3", 3)
    assert s["identity"].reason == "day:14"
    assert s["legacy"].reason == "tier" and s["presence"].reason == "tier"
    assert s["daily_os"].reason == "after_plan"


def test_the_goal_card_opens_reality_and_reality_starts_calibration():
    assert states(days_since_start=0, completed=frozenset({"goal"}))["reality"] \
        == ("needs_input", "")
    s = states(days_since_start=0, completed=frozenset({"goal", "reality"}))
    assert s["plan"] == ("calibrating", "") and s["tradeoffs"] == ("locked", "after_reality")


def test_tradeoffs_open_only_when_the_goal_does_not_fit():
    done = frozenset({"goal", "reality"})
    feasible = states(days_since_start=0, completed=done, feasibility="feasible", plan="building")
    assert feasible["tradeoffs"] == ("locked", "not_needed")
    assert feasible["plan"] == ("calibrating", "")
    for status in ("stretch", "tradeoff"):
        s = states(days_since_start=0, completed=done, feasibility=status)
        assert s["tradeoffs"] == ("needs_input", "") and s["plan"] == ("locked", "tradeoffs")
    chosen = states(days_since_start=0, completed=done | {"tradeoffs"}, feasibility="feasible",
                    plan="building")
    assert chosen["tradeoffs"] == ("active", "") and chosen["plan"] == ("calibrating", "")


def test_plan_states():
    done = frozenset({"goal", "reality"})
    base = {"days_since_start": 1, "completed": done, "feasibility": "feasible"}
    assert states(**base, plan="ready", window_days_left=9)["plan"] == ("active", "")
    assert states(**base, plan="ready", window_days_left=2)["plan"] \
        == ("needs_review", "window_ending")
    assert states(**base, plan="failed")["plan"] == ("needs_review", "plan_failed")


def test_drafts_unlock_with_the_plan_and_by_day():
    ready = {"completed": frozenset({"goal", "reality"}), "feasibility": "feasible",
             "plan": "ready", "window_days_left": 10}
    day1 = states(days_since_start=1, **ready)
    assert day1["daily_os"] == ("calibrating", "") and day1["knowledge"] == ("calibrating", "")
    assert day1["character"] == ("locked", "day:3")
    assert states(days_since_start=3, **ready)["character"] == ("calibrating", "")
    assert states(days_since_start=3, drafted=frozenset({"character"}), **ready)["character"] \
        == ("active", "")
    assert states(days_since_start=13, **ready)["identity"] == ("locked", "day:14")
    assert states(days_since_start=14, **ready)["identity"] == ("calibrating", "")
    assert states(days_since_start=3, draft_failed=frozenset({"character"}), **ready)[
        "character"] == ("needs_review", "draft_failed")


def test_full_tier_layers():
    ready = {"completed": frozenset({"goal", "reality"}), "feasibility": "feasible",
             "plan": "ready", "window_days_left": 10}
    full = frozenset({"legacy", "presence"})
    assert states(days_since_start=40, **ready)["legacy"] == ("locked", "tier")
    assert states(days_since_start=29, entitled=full, **ready)["legacy"] == ("locked", "day:30")
    assert states(days_since_start=30, entitled=full, **ready)["legacy"] == ("calibrating", "")
    assert states(days_since_start=5, entitled=full, **ready)["presence"] == ("locked", "opt_in")
    assert states(days_since_start=5, entitled=full, presence_opt_in=True, **ready)[
        "presence"] == ("calibrating", "")


def test_cards_never_go_back_to_locked():
    assert next_state("active", CardStatus("locked", "tier")).state == "active"
    assert next_state("needs_review", CardStatus("locked", "x")).state == "needs_review"
    assert next_state("locked", CardStatus("calibrating")).state == "calibrating"
    assert next_state(None, CardStatus("locked", "day:3")).reason == "day:3"
    assert next_state("active", CardStatus("needs_review", "window_ending")).state \
        == "needs_review"


def test_every_question_card_lists_its_slots_in_order():
    for card in ("goal", "reality", "tradeoffs"):
        keys = [s.key for s in slots_for(card, "navigator")]
        assert keys and len(keys) == len(set(keys))
