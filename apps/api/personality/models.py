from django.conf import settings
from django.db import models
from django.utils.timezone import now

from core.crypto import EncryptedJSONField


class PersonalityResult(models.Model):
    """Big Five self-assessment. Raw answers are encrypted; derived scores are 0..100."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="personality"
    )
    answers = EncryptedJSONField()
    scores = models.JSONField()  # openness, conscientiousness, extraversion, agreeableness, stability
    version = models.CharField(max_length=24, default="bigfive-20-v1")
    completed_at = models.DateTimeField(default=now)
