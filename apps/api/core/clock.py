"""Time helpers. Always go through `clock.now()` so tests can pin the current time."""

from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone


def now() -> datetime:
    return timezone.now()


def user_tz(user) -> ZoneInfo:
    try:
        return ZoneInfo(user.timezone or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def local_now(user) -> datetime:
    return now().astimezone(user_tz(user))


def local_today(user) -> date:
    return local_now(user).date()


def local_date(user, moment: datetime) -> date:
    return moment.astimezone(user_tz(user)).date()
