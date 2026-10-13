from django.conf import settings
from django.db import models
from django.utils import timezone


class Tier(models.TextChoices):
    CORE = "core"
    FULL = "full"


class SubscriptionStatus(models.TextChoices):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"


class SubscriptionSource(models.TextChoices):
    GRANT = "grant"
    WEB = "web"
    APPLE = "apple"
    GOOGLE_PLAY = "google_play"


class Subscription(models.Model):
    """Entitlement source of truth. No payment code exists yet (ADR 0007)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscription"
    )
    tier = models.CharField(max_length=16, choices=Tier.choices, default=Tier.CORE)
    status = models.CharField(
        max_length=16, choices=SubscriptionStatus.choices, default=SubscriptionStatus.ACTIVE
    )
    source = models.CharField(
        max_length=16, choices=SubscriptionSource.choices, default=SubscriptionSource.GRANT
    )
    current_period_end = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_entitled(self) -> bool:
        if self.status != SubscriptionStatus.ACTIVE:
            return False
        return self.current_period_end is None or self.current_period_end > timezone.now()
