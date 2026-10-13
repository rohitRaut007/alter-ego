"""Calendar integration.

Real Google Calendar sync needs OAuth client credentials and is Phase 7. Until then the link is
in demo mode: events are stored inside Alter Ego OS and shown in the app. The mode is returned
to clients so the UI never claims a sync that did not happen.
"""

from datetime import date, datetime, time, timedelta

from django.db import transaction

from core import clock
from daily_os.services import active_tasks, get_sprint
from protocol.services import current_sections

from .models import CalendarEvent, CalendarLink, CalendarMode


@transaction.atomic
def connect(user, email: str) -> CalendarLink:
    link, _ = CalendarLink.objects.update_or_create(
        user=user,
        defaults={"account_email": email, "mode": CalendarMode.DEMO,
                  "provider": "google", "connected_at": clock.now()},
    )
    return link


def disconnect(user) -> None:
    CalendarLink.objects.filter(user=user).delete()
    CalendarEvent.objects.filter(user=user).delete()


def _at(user, day: date, hhmm: str) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime.combine(day, time(h, m), tzinfo=clock.user_tz(user))


def sync_week(user, days: int = 7) -> int:
    """Create events for deep work blocks and due tasks over the next `days`. Idempotent."""
    sprint = get_sprint(user)
    sections = current_sections(sprint.protocol)
    blocks = [b for b in sections["daily_os"].content["schedule"] if b["kind"] == "deep_work"]
    today = clock.local_today(user)
    created = 0
    for offset in range(days):
        day = today + timedelta(days=offset)
        for b in blocks:
            _, new = CalendarEvent.objects.update_or_create(
                user=user, source_key=f"block:{day.isoformat()}:{b['start']}",
                defaults={"title": b["label"], "category": "deep_work",
                          "start": _at(user, day, b["start"]), "end": _at(user, day, b["end"])},
            )
            created += int(new)
    window_end = today + timedelta(days=days - 1)
    tasks = active_tasks(user).filter(due_date__gte=today, due_date__lte=window_end,
                                      done_at__isnull=True)
    for t in tasks:
        start = _at(user, t.due_date, "09:00")
        _, new = CalendarEvent.objects.update_or_create(
            user=user, source_key=f"task:{t.id}",
            defaults={"title": t.title, "category": "task", "start": start,
                      "end": start + timedelta(minutes=t.minutes)},
        )
        created += int(new)
    return created


def events_between(user, start: date, end: date):
    tz = clock.user_tz(user)
    lo = datetime.combine(start, time.min, tzinfo=tz)
    hi = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz)
    return CalendarEvent.objects.filter(user=user, start__gte=lo, start__lt=hi)

