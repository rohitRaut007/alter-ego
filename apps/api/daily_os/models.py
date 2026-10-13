import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.timezone import now

from core.crypto import EncryptedJSONField, EncryptedTextField

USER = settings.AUTH_USER_MODEL


class Sprint(models.Model):
    """The 90-day sprint. Day 0 is the date the protocol became ready (user's local date)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="sprints")
    protocol = models.OneToOneField(
        "protocol.Protocol", on_delete=models.CASCADE, related_name="sprint"
    )
    starts_on = models.DateField()
    ends_on = models.DateField()
    goal = EncryptedTextField()


class TaskSource(models.TextChoices):
    CHECKLIST_30 = "checklist30"
    SPRINT_90 = "sprint90"
    MENTOR = "mentor"


class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="tasks")
    protocol = models.ForeignKey("protocol.Protocol", on_delete=models.CASCADE, related_name="+")
    sprint = models.ForeignKey(Sprint, on_delete=models.CASCADE, related_name="tasks")
    source = models.CharField(max_length=16, choices=TaskSource.choices)
    source_id = models.CharField(max_length=32)  # id inside the protocol document
    layer = models.CharField(max_length=16)
    title = EncryptedTextField()
    detail = EncryptedTextField()
    minutes = models.PositiveSmallIntegerField()
    priority = models.BooleanField(default=False)
    due_day = models.PositiveSmallIntegerField()
    due_date = models.DateField()
    week_index = models.PositiveSmallIntegerField(null=True, blank=True)
    trait = models.ForeignKey(
        "character.Trait", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    done_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["due_date", "-priority", "source_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["protocol", "source", "source_id"], name="uniq_task_source"
            )
        ]
        indexes = [models.Index(fields=["user", "due_date"])]

    @property
    def done(self) -> bool:
        return self.done_at is not None


class DailyReflection(models.Model):
    """The three evening questions (PRD 6.2). One per local day, editable the same day."""

    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="reflections")
    date = models.DateField()
    answers = EncryptedJSONField()  # {"compounded", "leaked", "tomorrow"}
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(default=now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "date"], name="uniq_reflection_day")]


class DeepWorkSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="deep_work_sessions")
    task = models.ForeignKey(Task, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="+")
    planned_minutes = models.PositiveSmallIntegerField()
    started_at = models.DateTimeField(default=now)
    ended_at = models.DateTimeField(null=True, blank=True)
    abandoned = models.BooleanField(default=False)

    class Meta:
        constraints = [
            # At most one running session per user.
            models.UniqueConstraint(
                fields=["user"], condition=Q(ended_at__isnull=True), name="uniq_active_session"
            )
        ]
        indexes = [models.Index(fields=["user", "started_at"])]

    @property
    def actual_minutes(self) -> int:
        end = self.ended_at or now()
        return max(0, int((end - self.started_at).total_seconds() // 60))


class WeeklyRitual(models.Model):
    """The Sunday evening output ritual. `week_start` is the Monday of the week being closed."""

    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="weekly_rituals")
    week_start = models.DateField()
    answers = EncryptedJSONField()  # {"shipped", "slipped", "next_outcome"}
    completed_at = models.DateTimeField(default=now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "week_start"], name="uniq_ritual")]
