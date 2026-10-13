import uuid

from django.conf import settings
from django.db import models
from django.utils.timezone import now

from core.crypto import EncryptedTextField

USER = settings.AUTH_USER_MODEL


class Trait(models.Model):
    """A character trait materialised from the protocol's character section."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="traits")
    protocol = models.ForeignKey("protocol.Protocol", on_delete=models.CASCADE, related_name="+")
    source_id = models.CharField(max_length=32)  # id inside the protocol document
    position = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=200)
    statement = EncryptedTextField()
    rationale = EncryptedTextField()
    failure_mode = EncryptedTextField()
    monthly_reflection_prompt = EncryptedTextField()
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["position", "name"]
        constraints = [
            models.UniqueConstraint(fields=["protocol", "source_id"], name="uniq_trait_source")
        ]


class Cadence(models.TextChoices):
    DAILY = "daily"
    WEEKLY = "weekly"


class Practice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trait = models.ForeignKey(Trait, on_delete=models.CASCADE, related_name="practices")
    source_id = models.CharField(max_length=40)
    description = EncryptedTextField()
    cadence = models.CharField(max_length=8, choices=Cadence.choices)
    minutes = models.PositiveSmallIntegerField()
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["trait_id", "source_id"]
        constraints = [
            models.UniqueConstraint(fields=["trait", "source_id"], name="uniq_practice_source")
        ]


class PracticeLog(models.Model):
    practice = models.ForeignKey(Practice, on_delete=models.CASCADE, related_name="logs")
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="+")
    date = models.DateField()  # the user's local date
    done = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["practice", "date"], name="uniq_practice_log_day")
        ]
        indexes = [models.Index(fields=["user", "date"])]


class TraitRating(models.Model):
    """Self-rating of a trait at day 0, 14 and 30: the north-star measurement (PRD 10.1)."""

    trait = models.ForeignKey(Trait, on_delete=models.CASCADE, related_name="ratings")
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="+")
    day_offset = models.PositiveSmallIntegerField()
    score = models.PositiveSmallIntegerField()
    note = EncryptedTextField(null=True, blank=True)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["trait", "day_offset"], name="uniq_trait_rating")
        ]


class TraitReflection(models.Model):
    """Monthly check-in on one trait."""

    trait = models.ForeignKey(Trait, on_delete=models.CASCADE, related_name="reflections")
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="+")
    month = models.CharField(max_length=7)  # YYYY-MM, user's local month
    text = EncryptedTextField()
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["trait", "month"], name="uniq_trait_reflection_month")
        ]
