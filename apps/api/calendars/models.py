import uuid

from django.conf import settings
from django.db import models
from django.utils.timezone import now

from core.crypto import EncryptedTextField

USER = settings.AUTH_USER_MODEL


class CalendarMode(models.TextChoices):
    # Events stay inside Alter Ego OS. Real Google sync needs OAuth credentials (ROADMAP Phase 7).
    DEMO = "demo"
    GOOGLE = "google"


class CalendarLink(models.Model):
    user = models.OneToOneField(USER, on_delete=models.CASCADE, related_name="calendar_link")
    provider = models.CharField(max_length=16, default="google")
    account_email = models.CharField(max_length=254)
    mode = models.CharField(max_length=8, choices=CalendarMode.choices, default=CalendarMode.DEMO)
    connected_at = models.DateTimeField(default=now)


class CalendarEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="calendar_events")
    source_key = models.CharField(max_length=80)  # makes sync idempotent
    title = EncryptedTextField()
    category = models.CharField(max_length=16)  # deep_work | task | review
    start = models.DateTimeField()
    end = models.DateTimeField()

    class Meta:
        ordering = ["start"]
        constraints = [
            models.UniqueConstraint(fields=["user", "source_key"], name="uniq_calendar_source")
        ]
        indexes = [models.Index(fields=["user", "start"])]
