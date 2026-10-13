from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Subscription, Tier


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_subscription(sender, instance, created, **kwargs):
    if created:
        tier = Tier.FULL if settings.ALPHA_GRANT_FULL else Tier.CORE
        Subscription.objects.get_or_create(user=instance, defaults={"tier": tier})
