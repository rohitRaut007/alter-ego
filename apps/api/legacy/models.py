import uuid

from django.conf import settings
from django.db import models
from django.utils.timezone import now

from core.crypto import EncryptedJSONField, EncryptedTextField

USER = settings.AUTH_USER_MODEL


class Horizon(models.TextChoices):
    TWO_YEAR = "2y"
    FIVE_YEAR = "5y"
    LIFE = "life"


class MilestoneOrigin(models.TextChoices):
    PROTOCOL = "protocol"
    USER = "user"


class LegacyMilestone(models.Model):
    """What must be true at a horizon. Protocol-derived or added by the user."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="milestones")
    protocol = models.ForeignKey(
        "protocol.Protocol", null=True, blank=True, on_delete=models.CASCADE, related_name="+"
    )
    origin = models.CharField(max_length=10, choices=MilestoneOrigin.choices)
    source_id = models.CharField(max_length=40, blank=True)  # "2y#0" for protocol evidence rows
    horizon = models.CharField(max_length=4, choices=Horizon.choices)
    title = EncryptedTextField()
    detail = EncryptedTextField(blank=True, default="")
    due_label = models.CharField(max_length=40, blank=True)
    progress = models.PositiveSmallIntegerField(default=0)
    done_at = models.DateTimeField(null=True, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        ordering = ["horizon", "position", "created_at"]
        indexes = [models.Index(fields=["user", "horizon"])]

    @property
    def done(self) -> bool:
        return self.done_at is not None


class QuarterlyReview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="quarterly_reviews")
    scheduled_for = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)
    answers = EncryptedJSONField(null=True, blank=True)  # {"on_track", "change"}
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        ordering = ["-scheduled_for"]
