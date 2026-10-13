import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils.timezone import now


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email: str, password: str | None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email: str, password: str | None = None, **extra):
        extra["is_staff"] = True
        extra["is_superuser"] = True
        return self._create(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=120, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
    locale = models.CharField(max_length=8, default="en")
    # Data is never used for model training unless the user explicitly changes this.
    ai_training_opt_out = models.BooleanField(default=True)
    mentor_nudges = models.BooleanField(default=True)
    weekly_digest = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=now, editable=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    def __str__(self) -> str:
        return str(self.id)


class ConsentPurpose(models.TextChoices):
    TERMS = "terms"
    PRIVACY = "privacy"
    AI_PROCESSING = "ai_processing"
    ANALYTICS = "analytics"
    MARKETING = "marketing"


class AppendOnlyQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise PermissionError("Consent ledger is append-only")

    def delete(self):
        raise PermissionError("Consent ledger is append-only")


class ConsentLedger(models.Model):
    """Append-only record of consent decisions. Latest row per purpose wins."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="consents")
    purpose = models.CharField(max_length=32, choices=ConsentPurpose.choices)
    version = models.CharField(max_length=32)
    granted = models.BooleanField()
    created_at = models.DateTimeField(default=now, editable=False)

    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        indexes = [models.Index(fields=["user", "purpose", "-created_at"])]
        ordering = ["created_at", "id"]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise PermissionError("Consent ledger is append-only")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Consent ledger is append-only")


def has_consent(user: User, purpose: str) -> bool:
    latest = (
        ConsentLedger.objects.filter(user=user, purpose=purpose)
        .order_by("-created_at", "-id")
        .first()
    )
    return bool(latest and latest.granted)
