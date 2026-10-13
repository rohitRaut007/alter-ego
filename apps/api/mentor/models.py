from django.conf import settings
from django.db import models
from django.utils.timezone import now


class LLMUsage(models.Model):
    """Per-user token and cost log. Contains no prompt or response content."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    task = models.CharField(max_length=64)
    model = models.CharField(max_length=64)
    prompt_version = models.CharField(max_length=16)
    input_tokens = models.PositiveIntegerField()
    output_tokens = models.PositiveIntegerField()
    cached_tokens = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=now, editable=False)

    class Meta:
        indexes = [models.Index(fields=["user", "created_at"])]
