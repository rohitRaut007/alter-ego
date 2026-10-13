import uuid

from django.conf import settings
from django.db import models
from django.utils.timezone import now

from core.crypto import EncryptedJSONField, EncryptedTextField

USER = settings.AUTH_USER_MODEL


class InterviewStatus(models.TextChoices):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Interview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="interviews")
    status = models.CharField(
        max_length=16, choices=InterviewStatus.choices, default=InterviewStatus.IN_PROGRESS
    )
    prompt_version = models.CharField(max_length=16, blank=True)
    # Set when the interviewer reports it has enough to build a protocol.
    ready_to_complete = models.BooleanField(default=False)
    started_at = models.DateTimeField(default=now, editable=False)
    completed_at = models.DateTimeField(null=True, blank=True)


class InterviewTurn(models.Model):
    """One question and, once given, the user's answer. Answers are encrypted at rest."""

    interview = models.ForeignKey(Interview, on_delete=models.CASCADE, related_name="turns")
    idx = models.PositiveIntegerField()
    stage = models.CharField(max_length=64)
    question = models.TextField()
    suggestions = models.JSONField(default=list)
    multi_select = models.BooleanField(default=False)
    placeholder = models.CharField(max_length=200, blank=True)
    acknowledgement = models.CharField(max_length=300, blank=True)
    progress = models.FloatField(default=0)
    answer = EncryptedTextField(null=True, blank=True)
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["interview", "idx"], name="uniq_turn_idx")]
        ordering = ["idx"]


class ProtocolStatus(models.TextChoices):
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"


class Protocol(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="protocols")
    interview = models.OneToOneField(
        Interview, null=True, on_delete=models.SET_NULL, related_name="protocol"
    )
    schema_version = models.CharField(max_length=16)
    status = models.CharField(
        max_length=16, choices=ProtocolStatus.choices, default=ProtocolStatus.GENERATING
    )
    prompt_version = models.CharField(max_length=16, blank=True)
    model = models.CharField(max_length=64, blank=True)
    failure_code = models.CharField(max_length=32, blank=True)
    accuracy_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    rating_comment = EncryptedTextField(null=True, blank=True)
    # The first 500 protocols are reviewed by a human (PRD section 11).
    review_required = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=now, editable=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]


class ProtocolSection(models.Model):
    """Append-only revisions. The highest revision per (protocol, key) is current."""

    protocol = models.ForeignKey(Protocol, on_delete=models.CASCADE, related_name="sections")
    key = models.CharField(max_length=32)
    revision = models.PositiveIntegerField(default=1)
    content = EncryptedJSONField()
    instruction = EncryptedTextField(null=True, blank=True)
    prompt_version = models.CharField(max_length=16)
    model = models.CharField(max_length=64)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["protocol", "key", "revision"], name="uniq_section_rev")
        ]
        ordering = ["key", "revision"]


class ProtocolEvent(models.Model):
    """Ordered progress log that the SSE endpoint replays. Never holds section content."""

    protocol = models.ForeignKey(Protocol, on_delete=models.CASCADE, related_name="events")
    type = models.CharField(max_length=32)
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["protocol", "id"])]


class ProtocolReview(models.Model):
    """Internal quality review of generated protocols (first 500)."""

    protocol = models.ForeignKey(Protocol, on_delete=models.CASCADE, related_name="reviews")
    reviewer = models.ForeignKey(USER, null=True, on_delete=models.SET_NULL, related_name="+")
    accuracy = models.PositiveSmallIntegerField()
    flags = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=now, editable=False)
