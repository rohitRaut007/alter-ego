import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils.timezone import now

from core.crypto import EncryptedTextField

USER = settings.AUTH_USER_MODEL


class LLMUsage(models.Model):
    """Per-user token and cost log. Contains no prompt or response content."""

    user = models.ForeignKey(USER, null=True, on_delete=models.SET_NULL, related_name="+")
    task = models.CharField(max_length=64)
    model = models.CharField(max_length=64)
    prompt_version = models.CharField(max_length=16)
    input_tokens = models.PositiveIntegerField()
    output_tokens = models.PositiveIntegerField()
    cached_tokens = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        indexes = [models.Index(fields=["user", "created_at"])]


class ThreadKind(models.TextChoices):
    CHAT = "chat"
    WEEKLY = "weekly"
    SPRINT = "sprint"


class ThreadStatus(models.TextChoices):
    OPEN = "open"
    PAUSED_SAFETY = "paused_safety"


class MentorThread(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="mentor_threads")
    title = EncryptedTextField(blank=True, default="")
    kind = models.CharField(max_length=8, choices=ThreadKind.choices, default=ThreadKind.CHAT)
    status = models.CharField(max_length=16, choices=ThreadStatus.choices, default=ThreadStatus.OPEN)
    created_at = models.DateTimeField(default=now, editable=False)
    updated_at = models.DateTimeField(default=now)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "-updated_at"])]


class MessageRole(models.TextChoices):
    USER = "user"
    MENTOR = "mentor"


class MentorMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(MentorThread, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=8, choices=MessageRole.choices)
    body = EncryptedTextField()
    prompt_version = models.CharField(max_length=16, blank=True)
    model = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        ordering = ["created_at", "id"]

    def save(self, *args, **kwargs):
        # Keep timestamps strictly increasing within a thread so ordering is deterministic even
        # when the clock resolution is coarse.
        if self._state.adding:
            last = (MentorMessage.objects.filter(thread_id=self.thread_id)
                    .order_by("-created_at").values_list("created_at", flat=True).first())
            if last is not None and self.created_at <= last:
                self.created_at = last + timedelta(microseconds=1)
        super().save(*args, **kwargs)


class ThreadSummary(models.Model):
    """Rolling summary so later turns need not resend the whole transcript."""

    thread = models.ForeignKey(MentorThread, on_delete=models.CASCADE, related_name="summaries")
    text = EncryptedTextField()
    covers_messages = models.PositiveIntegerField()  # number of messages summarised so far
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        ordering = ["-created_at"]


class FactKind(models.TextChoices):
    GOAL = "goal"
    FEAR = "fear"
    CONSTRAINT = "constraint"
    PREFERENCE = "preference"
    PROGRESS = "progress"
    COMMITMENT = "commitment"
    INSIGHT = "insight"


class MemoryFact(models.Model):
    """Structured memory the user can see and delete."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="memory_facts")
    kind = models.CharField(max_length=16, choices=FactKind.choices)
    text = EncryptedTextField()
    confidence = models.FloatField(default=0.7)
    source_thread = models.ForeignKey(
        MentorThread, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(default=now, editable=False)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]


class NudgeKind(models.TextChoices):
    REENGAGEMENT = "reengagement"
    RITUAL = "ritual"
    CHECKIN = "checkin"
    STREAK = "streak"


class MentorNudge(models.Model):
    """A proactive message produced by a rule (momentum, ritual, 30/60/90 check-in, streak)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="nudges")
    kind = models.CharField(max_length=16, choices=NudgeKind.choices)
    dedupe_key = models.CharField(max_length=64)
    body = EncryptedTextField()
    created_at = models.DateTimeField(default=now, editable=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "dedupe_key"], name="uniq_nudge_per_key")
        ]


class ChallengeDifficulty(models.TextChoices):
    LIGHT = "Light"
    MEDIUM = "Medium"
    HARD = "Hard"


class ChallengeStatus(models.TextChoices):
    OFFERED = "offered"
    ACCEPTED = "accepted"
    DISMISSED = "dismissed"


class MentorChallenge(models.Model):
    """An accountability challenge. Accepting one creates a Daily OS task."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="mentor_challenges")
    week_index = models.PositiveSmallIntegerField()
    layer = models.CharField(max_length=16)
    difficulty = models.CharField(max_length=8, choices=ChallengeDifficulty.choices)
    title = EncryptedTextField()
    detail = EncryptedTextField()
    status = models.CharField(
        max_length=10, choices=ChallengeStatus.choices, default=ChallengeStatus.OFFERED
    )
    task = models.OneToOneField(
        "daily_os.Task", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["user", "week_index"])]
