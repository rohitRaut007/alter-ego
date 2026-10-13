from django.conf import settings
from django.db import models
from django.utils import timezone


class EventName(models.TextChoices):
    """Event taxonomy. Maps to PRD section 10 (see docs/ARCHITECTURE.md)."""

    ACCOUNT_CREATED = "account_created"
    ONBOARDING_STARTED = "onboarding_started"
    INTERVIEW_COMPLETED = "interview_completed"
    PROTOCOL_GENERATED = "protocol_generated"
    PROTOCOL_RATED = "protocol_rated"
    SESSION_ACTIVE = "session_active"
    PRACTICE_COMPLETED = "practice_completed"
    TASK_COMPLETED = "task_completed"
    NPS_SUBMITTED = "nps_submitted"
    TRAIT_RATING_SUBMITTED = "trait_rating_submitted"
    MENTOR_MESSAGE_SENT = "mentor_message_sent"
    WEEKLY_RITUAL_COMPLETED = "weekly_ritual_completed"
    DEEP_WORK_SESSION_COMPLETED = "deep_work_session_completed"
    REFLECTION_COMPLETED = "reflection_completed"
    SAFETY_BOUNDARY_TRIGGERED = "safety.boundary_triggered"


class EventOutbox(models.Model):
    """Events waiting for delivery to the analytics tool. Props never hold free text."""

    name = models.CharField(max_length=64, choices=EventName.choices)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    props = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["sent_at", "created_at"])]
