"""The only interface the rest of the codebase uses to talk to a model provider."""

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any, Protocol


class BudgetExceeded(Exception):
    """The assembled request is larger than the task's token budget."""


class LLMOutputError(Exception):
    """The provider returned something that is not usable JSON."""


@dataclass(frozen=True)
class LLMResult:
    data: dict[str, Any]
    model: str
    input_tokens: int
    output_tokens: int
    cached_tokens: int = 0


class LLMClient(Protocol):
    """A provider implementation. Anthropic, a fake, or any future backend."""

    model_name: str

    def complete_json(
        self,
        *,
        task: str,
        prompt_version: str,
        system: str,
        payload: dict[str, Any],
        max_output_tokens: int,
    ) -> LLMResult: ...

    def stream_text(
        self,
        *,
        task: str,
        prompt_version: str,
        system: str,
        payload: dict[str, Any],
        max_output_tokens: int,
    ) -> "Iterator[str]": ...
