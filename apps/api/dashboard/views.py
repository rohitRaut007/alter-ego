from datetime import timedelta
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.permissions import HasFeature
from character.models import PracticeLog
from character.services import overall_practice_streak, practices_overview
from core import clock
from daily_os.models import DeepWorkSession
from daily_os.serializers import TaskSerializer
from daily_os.services import (
    active_tasks,
    build_brief,
    get_sprint,
    record_active_day,
    SPRINT_DAYS,
)
from knowledge.models import ReadingStatus
from knowledge.services import active_items
from legacy.models import LegacyMilestone
from mentor.models import MentorNudge

PERMISSIONS = [IsAuthenticated, HasFeature("daily_os")]

LAYER_ORDER = ["identity", "character", "knowledge", "mission", "daily_os", "presence", "legacy"]
LAYER_NAMES = {"identity": "Identity Architecture", "character": "Character Stack",
               "knowledge": "Knowledge System", "mission": "Product / Mission Strategy",
               "daily_os": "Daily Operating System", "presence": "Presence Architecture",
               "legacy": "Legacy Timeline"}


class KeyResultSerializer(serializers.Serializer):
    id = serializers.CharField()
    label = serializers.CharField()
    value = serializers.IntegerField()
    target = serializers.IntegerField()
    suffix = serializers.CharField(allow_blank=True)


class MomentumSerializer(serializers.Serializer):
    day = serializers.CharField()
    date = serializers.DateField()
    deep_work_hours = serializers.FloatField()
    practices = serializers.IntegerField()


class LayerSerializer(serializers.Serializer):
    id = serializers.ChoiceField(choices=LAYER_ORDER)
    index = serializers.IntegerField()
    name = serializers.CharField()
    status = serializers.ChoiceField(choices=["calibrating", "active", "locked_in"])
    progress = serializers.IntegerField()


class DashboardStatsSerializer(serializers.Serializer):
    tasks_done_today = serializers.IntegerField()
    tasks_due_today = serializers.IntegerField()
    practices_done = serializers.IntegerField()
    practices_total = serializers.IntegerField()
    longest_streak = serializers.IntegerField()
    reading_progress = serializers.IntegerField()


class DashboardSerializer(serializers.Serializer):
    day_number = serializers.IntegerField()
    total_days = serializers.IntegerField()
    sprint_percent = serializers.IntegerField()
    sprint_goal = serializers.CharField()
    alter_ego_name = serializers.CharField()
    identity_statement = serializers.CharField()
    tone = serializers.ChoiceField(choices=["start", "push", "balanced", "steady"])
    headline = serializers.CharField()
    body = serializers.CharField()
    insight = serializers.CharField(allow_null=True)
    priority_task = TaskSerializer(allow_null=True)
    key_results = KeyResultSerializer(many=True)
    weekly_momentum = MomentumSerializer(many=True)
    stats = DashboardStatsSerializer()
    layers = LayerSerializer(many=True)
    personality_completed = serializers.BooleanField()
    unread_nudges = serializers.IntegerField()
    ritual_due = serializers.BooleanField()


def _layer_progress(user, sprint, milestones) -> list[dict[str, Any]]:
    totals: dict[str, list[int]] = {}
    for t in active_tasks(user).filter(sprint=sprint):
        row = totals.setdefault(t.layer, [0, 0])
        row[0] += 1
        row[1] += 1 if t.done_at is not None else 0
    out = []
    for i, lid in enumerate(LAYER_ORDER, start=1):
        if lid == "identity":
            pct = 100  # defined by the protocol itself
        elif lid == "legacy" and milestones:
            pct = round(sum(m.progress for m in milestones) / len(milestones))
        else:
            total, done = totals.get(lid, [0, 0])
            pct = round(done / total * 100) if total else 0
        status = "locked_in" if pct >= 80 else "active" if pct > 0 else "calibrating"
        out.append({"id": lid, "index": i, "name": LAYER_NAMES[lid], "status": status,
                    "progress": pct})
    return out


class DashboardView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: DashboardSerializer})
    def get(self, request):
        user = request.user
        sprint = get_sprint(user)
        today = clock.local_today(user)
        record_active_day(user)
        brief = build_brief(user, sprint, today)

        practices = practices_overview(user, sprint.protocol, today)
        streak, best = overall_practice_streak(user, today)
        items = list(active_items(user, sprint.protocol))
        reading = round(sum(i.progress for i in items) / len(items)) if items else 0
        all_tasks = list(active_tasks(user).filter(sprint=sprint))
        done_tasks = sum(1 for t in all_tasks if t.done_at is not None)

        # Seven-day momentum ending today
        days = [today - timedelta(days=i) for i in range(6, -1, -1)]
        sessions = DeepWorkSession.objects.filter(user=user, abandoned=False,
                                                  ended_at__isnull=False)
        minutes: dict = {d: 0 for d in days}
        for s in sessions:
            d = clock.local_date(user, s.started_at)
            if d in minutes:
                minutes[d] += s.actual_minutes
        logs = PracticeLog.objects.filter(user=user, done=True, date__gte=days[0], date__lte=today)
        per_day: dict = {d: 0 for d in days}
        for lg in logs:
            per_day[lg.date] = per_day.get(lg.date, 0) + 1
        momentum = [{"day": d.strftime("%a"), "date": d,
                     "deep_work_hours": round(minutes[d] / 60, 1), "practices": per_day.get(d, 0)}
                    for d in days]

        milestones = list(LegacyMilestone.objects.filter(user=user, archived_at__isnull=True))
        due_today = [t for t in all_tasks if t.due_date <= today and t.done_at is None]
        done_today = brief["completed_today"]
        priority = brief["focus"][0] if brief["focus"] else None
        if priority is None:
            upcoming = [t for t in all_tasks if t.done_at is None]
            upcoming.sort(key=lambda t: (t.due_date, not t.priority))
            priority = upcoming[0] if upcoming else None

        pct = min(100, round(brief["day_number"] / SPRINT_DAYS * 100))
        data = {
            "day_number": brief["day_number"],
            "total_days": SPRINT_DAYS,
            "sprint_percent": pct,
            "sprint_goal": brief["sprint_goal"],
            "alter_ego_name": brief["alter_ego_name"],
            "identity_statement": brief["identity_statement"],
            "tone": brief["tone"],
            "headline": brief["headline"],
            "body": brief["body"],
            "insight": brief["insight"],
            "priority_task": priority,
            "key_results": [
                {"id": "tasks", "label": "Tasks completed", "value": done_tasks,
                 "target": max(len(all_tasks), 1), "suffix": ""},
                {"id": "practices", "label": "Practices done today",
                 "value": sum(1 for p in practices if p["done_today"]),
                 "target": max(len(practices), 1), "suffix": ""},
                {"id": "reading", "label": "Reading progress", "value": reading, "target": 100,
                 "suffix": "%"},
            ],
            "weekly_momentum": momentum,
            "stats": {
                "tasks_done_today": len(done_today),
                "tasks_due_today": len(due_today) + len(done_today),
                "practices_done": sum(1 for p in practices if p["done_today"]),
                "practices_total": len(practices),
                "longest_streak": max(best, streak),
                "reading_progress": reading,
            },
            "layers": _layer_progress(user, sprint, milestones),
            "personality_completed": hasattr(user, "personality"),
            "unread_nudges": MentorNudge.objects.filter(user=user, read_at__isnull=True).count(),
            "ritual_due": brief["ritual"]["due"],
        }
        return Response(DashboardSerializer(data).data)


__all__ = ["DashboardView", "ReadingStatus"]
