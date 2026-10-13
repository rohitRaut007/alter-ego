"""Stable names for enum choice sets in the OpenAPI schema (see ENUM_NAME_OVERRIDES).

drf-spectacular can only resolve module-level lists by import path, not `Class.values`.
"""

from knowledge.models import NoteKind, ReadingStatus
from legacy.models import Horizon
from mentor.models import ChallengeStatus, FactKind, NudgeKind, ThreadKind, ThreadStatus
from protocol.models import ProtocolStatus

PROTOCOL_STATUS = list(ProtocolStatus.choices)
THREAD_STATUS = list(ThreadStatus.choices)
CHALLENGE_STATUS = list(ChallengeStatus.choices)
READING_STATUS = list(ReadingStatus.choices)
NUDGE_KIND = list(NudgeKind.choices)
THREAD_KIND = list(ThreadKind.choices)
FACT_KIND = list(FactKind.choices)
NOTE_KIND = list(NoteKind.choices)
HORIZON = list(Horizon.choices)
