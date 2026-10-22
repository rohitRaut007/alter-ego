import copy

import pytest
from pydantic import ValidationError

from accounts.models import User
from core import crypto
from mentor.llm.base import BudgetExceeded, LLMResult
from mentor.llm.fake import FakeLLM
from mentor.llm.service import LLMService, estimate_tokens
from protocol.models import (
    Interview,
    InterviewStatus,
    InterviewTurn,
    Protocol,
    ProtocolEvent,
    ProtocolSection,
    ProtocolStatus,
)
from protocol.schema.v2 import (
    DISCLAIMER,
    SECTION_KEYS,
    SECTION_MODELS,
    ProtocolDocument,
    find_banned_phrases,
    upgrade_v1_document,
)
from protocol.services import MAX_ATTEMPTS, run_generation

pytestmark = pytest.mark.django_db


class FlakyLLM:
    """Wraps FakeLLM and corrupts chosen calls to exercise validation and retry."""

    model_name = "flaky"

    def __init__(self, bad_calls: set[int] | None = None, always_bad: bool = False):
        self.inner = FakeLLM()
        self.calls = 0
        self.bad_calls = bad_calls or set()
        self.always_bad = always_bad
        self.seen_errors: list[str | None] = []

    def complete_json(self, **kw):
        self.calls += 1
        self.seen_errors.append(kw["payload"].get("validation_error"))
        result = self.inner.complete_json(**kw)
        if self.always_bad or self.calls in self.bad_calls:
            return LLMResult(data={"unexpected": True}, model=result.model,
                             input_tokens=1, output_tokens=1)
        return result


@pytest.fixture
def protocol() -> Protocol:
    user = User.objects.create_user(email="gen@example.com", password="x" * 12, display_name="Gen")
    interview = Interview.objects.create(
        user=user, status=InterviewStatus.COMPLETED, ready_to_complete=True
    )
    for i, text in enumerate(["Become a builder.", "Dev tools.", "Skills.", "Mornings.",
                              "Abandon projects.", "Wasted potential.", "50 customers.", "2h a day."]):
        InterviewTurn.objects.create(interview=interview, idx=i, stage="s", question="q", answer=text)
    return Protocol.objects.create(user=user, interview=interview, schema_version="2.0.0")


# --- generation -------------------------------------------------------------


def test_invalid_output_is_retried_with_error_fed_back(protocol):
    llm_client = FlakyLLM(bad_calls={1, 2})
    run_generation(str(protocol.id), llm=LLMService(llm_client))
    protocol.refresh_from_db()
    assert protocol.status == ProtocolStatus.READY
    assert llm_client.seen_errors[0] is None
    assert llm_client.seen_errors[1] and "identity" in llm_client.seen_errors[1]
    assert llm_client.calls == len(SECTION_KEYS) + 2


def test_persistent_invalid_output_fails_protocol_with_error_event(protocol):
    llm_client = FlakyLLM(always_bad=True)
    run_generation(str(protocol.id), llm=LLMService(llm_client))
    protocol.refresh_from_db()
    assert protocol.status == ProtocolStatus.FAILED
    assert protocol.failure_code == "validation"
    assert llm_client.calls == MAX_ATTEMPTS
    last = ProtocolEvent.objects.filter(protocol=protocol).last()
    assert last.type == "error" and last.data == {"code": "validation"}
    assert ProtocolSection.objects.filter(protocol=protocol).count() == 0


def test_generation_resumes_without_regenerating_finished_sections(protocol):
    first = FlakyLLM()
    run_generation(str(protocol.id), llm=LLMService(first))
    # Simulate a worker restart: protocol back to generating with one section removed.
    ProtocolSection.objects.filter(protocol=protocol, key="legacy").delete()
    Protocol.objects.filter(pk=protocol.pk).update(status=ProtocolStatus.GENERATING)
    second = FlakyLLM()
    run_generation(str(protocol.id), llm=LLMService(second))
    protocol.refresh_from_db()
    assert protocol.status == ProtocolStatus.READY
    assert second.calls == 1


def test_run_generation_ignores_non_generating_protocols(protocol):
    Protocol.objects.filter(pk=protocol.pk).update(status=ProtocolStatus.READY)
    llm_client = FlakyLLM()
    run_generation(str(protocol.id), llm=LLMService(llm_client))
    assert llm_client.calls == 0


def test_token_budget_is_enforced(protocol):
    service = LLMService(FakeLLM())
    huge = {"display_name": "x", "answers": [{"stage": "s", "question": "q", "answer": "w" * 200_000}]}
    with pytest.raises(BudgetExceeded):
        service.run_json(user=protocol.user, task="interview_turn", payload=huge)
    assert estimate_tokens("abcd" * 10) == 10


# --- schema -----------------------------------------------------------------


def fake_document() -> dict:
    data = {"answers": [{"stage": "s", "question": "q", "answer": "Become a builder."}] * 8,
            "display_name": "Gen"}
    from mentor.llm.fake import SECTION_BUILDERS

    parts = {k: SECTION_BUILDERS[k](data["answers"], "Gen") for k in SECTION_KEYS}
    return {
        "schema_version": "2.0.0",
        "generated_at": "2026-10-14T05:30:00Z",
        **{k: parts[k] for k in ("identity", "character", "knowledge", "mission", "daily_os",
                                 "presence", "legacy")},
        "checklist_30": parts["checklist_30"]["tasks"],
        "sprint_90": parts["sprint_90"],
        "disclaimer": DISCLAIMER,
    }


def test_fake_output_validates_against_every_section_model():
    from mentor.llm.fake import SECTION_BUILDERS

    for key, builder in SECTION_BUILDERS.items():
        SECTION_MODELS[key].model_validate(builder([{"answer": "x"}] * 8, ""))


def test_document_validates():
    ProtocolDocument.model_validate(fake_document())


def test_duplicate_ids_are_rejected():
    doc = fake_document()
    doc["checklist_30"][1]["id"] = doc["checklist_30"][0]["id"]
    with pytest.raises(ValidationError, match="Duplicate ids"):
        ProtocolDocument.model_validate(doc)


def test_unknown_trait_reference_is_rejected():
    doc = fake_document()
    doc["checklist_30"][0]["trait_id"] = "nope"
    with pytest.raises(ValidationError, match="unknown traits"):
        ProtocolDocument.model_validate(doc)


def test_checklist_needs_day_one_task_within_30_days():
    doc = fake_document()
    for t in doc["checklist_30"]:
        t["due_day"] = max(2, t["due_day"])
    with pytest.raises(ValidationError, match="Day 1"):
        ProtocolDocument.model_validate(doc)

    doc = fake_document()
    doc["checklist_30"][-1]["due_day"] = 45
    with pytest.raises(ValidationError, match="30 days"):
        ProtocolDocument.model_validate(doc)


def test_extra_fields_and_bad_shapes_are_rejected():
    doc = fake_document()
    doc["identity"]["surprise"] = "x"
    with pytest.raises(ValidationError):
        ProtocolDocument.model_validate(doc)

    doc = fake_document()
    doc["daily_os"]["reflection_questions"] = ["only one"]
    with pytest.raises(ValidationError):
        ProtocolDocument.model_validate(doc)

    doc = fake_document()
    doc["daily_os"]["schedule"][0]["start"] = "6am"
    with pytest.raises(ValidationError):
        ProtocolDocument.model_validate(doc)


def test_legacy_requires_one_milestone_per_horizon():
    doc = fake_document()
    doc["legacy"]["milestones"][1]["horizon"] = "2y"
    with pytest.raises(ValidationError, match="each for 2y, 5y and life"):
        ProtocolDocument.model_validate(doc)


def test_banned_outcome_language_detection():
    assert find_banned_phrases({"a": ["This will guarantee success"]})
    assert find_banned_phrases("It will make you rich")
    assert find_banned_phrases("You will become a millionaire")
    assert not find_banned_phrases({"a": "A system you can review weekly."})
    assert not find_banned_phrases(copy.deepcopy(fake_document()))


# --- encryption -------------------------------------------------------------


def test_encryption_roundtrip_and_tamper_detection():
    token = crypto.encrypt("private reflection")
    assert token.startswith("v1:test:") and "private" not in token
    assert crypto.decrypt(token) == "private reflection"
    assert crypto.encrypt("same") != crypto.encrypt("same")  # random nonce

    version, key_id, nonce, ct = token.split(":")
    flipped = ct[:-2] + ("AA" if not ct.endswith("AA") else "BB")
    with pytest.raises(crypto.DecryptionError):
        crypto.decrypt(":".join([version, key_id, nonce, flipped]))
    with pytest.raises(crypto.DecryptionError):
        crypto.decrypt(":".join([version, "other", nonce, ct]))
    with pytest.raises(crypto.DecryptionError):
        crypto.decrypt("not-a-token")


def test_key_rotation_decrypts_old_data(settings):
    old = settings.FIELD_ENCRYPTION_KEYS
    token = crypto.encrypt("legacy value")
    settings.FIELD_ENCRYPTION_KEYS = [("k2", b"B" * 32), *old]
    assert crypto.encrypt("new").startswith("v1:k2:")
    assert crypto.decrypt(token) == "legacy value"


# --- schema 2.0.0 ------------------------------------------------------------


def envelope() -> dict:
    return {"schema_version": "2.0.0", "generated_at": "2026-10-22T05:30:00Z",
            "disclaimer": DISCLAIMER}


def test_sections_are_optional_because_they_arrive_as_cards_unlock():
    assert ProtocolDocument.model_validate(envelope()).identity is None
    doc = fake_document()
    partial = {**envelope(), "mission": doc["mission"], "sprint_90": doc["sprint_90"]}
    ProtocolDocument.model_validate(partial)


def test_a_1_0_0_document_upgrades_by_changing_only_its_version():
    old = {**fake_document(), "schema_version": "1.0.0"}
    with pytest.raises(ValidationError):
        ProtocolDocument.model_validate(old)
    upgraded = upgrade_v1_document(old)
    assert upgraded["schema_version"] == "2.0.0"
    assert upgraded["identity"] == old["identity"]
    assert upgraded["checklist_30"] == old["checklist_30"]
    assert upgrade_v1_document(upgraded) is upgraded
    with pytest.raises(ValueError):
        upgrade_v1_document({**old, "schema_version": "0.9.0"})


def plan_sprint() -> dict:
    task = {"id": "w1_t1", "title": "First step", "detail": "Ten minutes.", "layer": "mission",
            "due_day": 1, "minutes": 10, "milestone_id": "m1", "fallback": "Five minutes.",
            "fallback_minutes": 5, "if_then": {"if_cue": "I am tired",
                                               "then_action": "I do the fallback"}}
    return {
        "goal": "Ship the first model.",
        "milestones": [{"id": "m1", "title": "Deploy one model", "due_day": 200,
                        "evidence": "An endpoint answers.", "lead_measures": ["Hours a week"]}],
        "weeks": [
            {"index": 1, "theme": "Start", "tasks": [task], "review_prompt": "What worked?"},
            {"index": 2, "theme": "Later", "outcome": "A second model.",
             "review_prompt": "What changed?"},
        ],
    }


def test_plan_sprints_carry_milestones_and_an_empty_later_window():
    sprint = SECTION_MODELS["sprint_90"].model_validate(plan_sprint())
    assert sprint.weeks[1].tasks == [] and sprint.weeks[1].outcome == "A second model."
    assert sprint.milestones[0].due_day == 200  # milestones may fall after the sprint ends


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda s: s["weeks"][0]["tasks"][0].update(milestone_id="nope"), "unknown milestones"),
        (lambda s: s["weeks"][0]["tasks"][0].update(fallback_minutes=20), "less than or equal"),
        (lambda s: s["weeks"][1].update(index=1), "unique"),
        (lambda s: s["weeks"][0]["tasks"][0]["if_then"].pop("then_action"), "then_action"),
        (lambda s: s.update(weeks=[]), "at least 1"),
    ],
)
def test_plan_sprint_rules(mutate, message):
    sprint = plan_sprint()
    mutate(sprint)
    with pytest.raises(ValidationError, match=message):
        SECTION_MODELS["sprint_90"].model_validate(sprint)


def test_tasks_cannot_name_a_trait_before_character_exists():
    sprint = plan_sprint()
    sprint["weeks"][0]["tasks"][0]["trait_id"] = "follow_through"
    with pytest.raises(ValidationError, match="unknown traits"):
        ProtocolDocument.model_validate({**envelope(), "sprint_90": sprint})
