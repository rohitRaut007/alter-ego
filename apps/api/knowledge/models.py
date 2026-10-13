import uuid

from django.conf import settings
from django.db import models
from django.utils.timezone import now

from core.crypto import EncryptedTextField

USER = settings.AUTH_USER_MODEL


class ReadingStatus(models.TextChoices):
    WANT = "want"
    READING = "reading"
    FINISHED = "finished"


class ReadingItem(models.Model):
    """A title in the user's sequenced reading list, materialised from the protocol."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="reading_items")
    protocol = models.ForeignKey("protocol.Protocol", on_delete=models.CASCADE, related_name="+")
    source_id = models.CharField(max_length=32)
    sequence = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=200)
    why_now = EncryptedTextField()
    estimated_hours = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=10, choices=ReadingStatus.choices, default=ReadingStatus.WANT)
    progress = models.PositiveSmallIntegerField(default=0)  # 0..100
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["sequence"]
        constraints = [
            models.UniqueConstraint(fields=["protocol", "source_id"], name="uniq_reading_source")
        ]


class NoteKind(models.TextChoices):
    NOTE = "note"
    COLLISION = "collision"
    DESTRUCTION_TEST = "destruction_test"


class KnowledgeNote(models.Model):
    """Notes, collision-notebook entries and destruction tests. Content is encrypted."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="knowledge_notes")
    item = models.ForeignKey(
        ReadingItem, null=True, blank=True, on_delete=models.SET_NULL, related_name="notes"
    )
    kind = models.CharField(max_length=20, choices=NoteKind.choices, default=NoteKind.NOTE)
    title = EncryptedTextField()
    source = EncryptedTextField(blank=True, default="")
    body = EncryptedTextField()
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]
