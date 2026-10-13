from django.conf import settings
from django.db import models
from django.utils.timezone import now


class SafetyEvent(models.Model):
    """Record that the boundary triggered. Never stores the text that triggered it."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    surface = models.CharField(max_length=32)
    category = models.CharField(max_length=16)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        indexes = [models.Index(fields=["user", "created_at"])]
