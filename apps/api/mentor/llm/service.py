import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .base import BudgetExceeded, LLMClient, LLMResult

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"

# (max input tokens, max output tokens). Estimated, not billed, so keep generous.
TASK_BUDGETS: dict[str, tuple[int, int]] = {
    "interview_turn": (12_000, 700),
    "protocol_section": (16_000, 4_000),
    "protocol_section_revise": (16_000, 4_000),
}

# Current prompt version per task. Stored with every protocol and mentor message.
PROMPT_VERSIONS: dict[str, str] = {
    "interview_turn": "v1",
    "protocol_section": "v1",
    "protocol_section_revise": "v1",
}


@lru_cache(maxsize=None)
def load_prompt(task: str, version: str) -> str:
    path = PROMPTS_DIR / task / f"{version}.md"
    return path.read_text(encoding="utf-8")


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


@dataclass(frozen=True)
class RunResult:
    data: dict[str, Any]
    model: str
    prompt_version: str


class LLMService:
    """Versioned prompts, token budgets and per-user cost logging around a provider client."""

    def __init__(self, client: LLMClient) -> None:
        self.client = client

    def run_json(self, *, user, task: str, payload: dict[str, Any]) -> RunResult:
        from mentor.models import LLMUsage

        version = PROMPT_VERSIONS[task]
        system = load_prompt(task, version)
        max_in, max_out = TASK_BUDGETS[task]
        estimated = estimate_tokens(system) + estimate_tokens(json.dumps(payload))
        if estimated > max_in:
            raise BudgetExceeded(f"{task}: ~{estimated} input tokens exceeds budget {max_in}")

        result: LLMResult = self.client.complete_json(
            task=task,
            prompt_version=version,
            system=system,
            payload=payload,
            max_output_tokens=max_out,
        )
        LLMUsage.objects.create(
            user=user,
            task=task,
            model=result.model,
            prompt_version=version,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cached_tokens=result.cached_tokens,
        )
        return RunResult(data=result.data, model=result.model, prompt_version=version)


def get_llm_service() -> LLMService:
    provider = settings.LLM_PROVIDER
    if provider == "fake":
        from .fake import FakeLLM

        return LLMService(FakeLLM(delay_ms=settings.FAKE_LLM_DELAY_MS))
    raise ImproperlyConfigured(
        f"LLM_PROVIDER={provider!r} is not available yet. Only 'fake' is implemented in Phase 2."
    )
