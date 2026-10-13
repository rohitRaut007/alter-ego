from datetime import date, timedelta

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.permissions import HasFeature
from core import clock
from safety.services import screen_all

from . import services
from .models import DailyReflection, DeepWorkSession, Task, WeeklyRitual
from .serializers import (
    BriefSerializer,
    DeepWorkSessionSerializer,
    DeepWorkStartSerializer,
    DeepWorkUpdateSerializer,
    ReflectionRequestSerializer,
    ReflectionResultSerializer,
    RitualAnswersSerializer,
    RitualSerializer,
    SprintSerializer,
    TaskSerializer,
    TaskUpdateSerializer,
)

PERMISSIONS = [IsAuthenticated, HasFeature("daily_os")]


def _conflict(message: str) -> Response:
    return Response({"detail": message}, status=status.HTTP_409_CONFLICT)


def _parse_date(raw: str | None, default: date) -> date:
    if not raw:
        return default
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ValidationError({"date": "Use YYYY-MM-DD."}) from None


class BriefView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(
        parameters=[OpenApiParameter("date", str, description="YYYY-MM-DD, defaults to today")],
        responses={200: BriefSerializer},
    )
    def get(self, request):
        """Morning brief: what today demands, from the sprint and this week's progress."""
        user = request.user
        on = _parse_date(request.query_params.get("date"), clock.local_today(user))
        sprint = services.get_sprint(user)
        services.record_active_day(user)
        return Response(BriefSerializer(services.build_brief(user, sprint, on)).data)


class SprintView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: SprintSerializer})
    def get(self, request):
        user = request.user
        sprint = services.get_sprint(user)
        today = clock.local_today(user)
        tasks = list(services.active_tasks(user).filter(sprint=sprint))
        current = services.week_index(sprint, today)
        weeks = []
        for idx in sorted({t.week_index for t in tasks if t.week_index}):
            wt = [t for t in tasks if t.week_index == idx]
            weeks.append({
                "index": idx,
                "total": len(wt),
                "done": sum(1 for t in wt if t.done_at),
                "is_current": idx == current,
                "tasks": wt,
            })
        checklist = [t for t in tasks if t.source == "checklist30"]
        data = {
            "id": sprint.id, "starts_on": sprint.starts_on, "ends_on": sprint.ends_on,
            "goal": sprint.goal, "day_number": services.day_number(sprint, today),
            "total_days": services.SPRINT_DAYS, "weeks": weeks, "checklist": checklist,
        }
        return Response(SprintSerializer(data).data)


class TaskListView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(
        parameters=[
            OpenApiParameter("from", str), OpenApiParameter("to", str),
            OpenApiParameter("layer", str), OpenApiParameter("done", bool),
        ],
        responses={200: TaskSerializer(many=True)},
    )
    def get(self, request):
        user = request.user
        services.get_sprint(user)
        qs = services.active_tasks(user)
        q = request.query_params
        if q.get("from"):
            qs = qs.filter(due_date__gte=_parse_date(q["from"], date.min))
        if q.get("to"):
            qs = qs.filter(due_date__lte=_parse_date(q["to"], date.max))
        if q.get("layer"):
            qs = qs.filter(layer=q["layer"])
        if q.get("done") in ("true", "false"):
            qs = qs.filter(done_at__isnull=(q["done"] == "false"))
        return Response(TaskSerializer(list(qs[:300]), many=True).data)


class TaskDetailView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=TaskUpdateSerializer, responses={200: TaskSerializer})
    def patch(self, request, pk):
        task = get_object_or_404(services.active_tasks(request.user), pk=pk)
        ser = TaskUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        task = services.set_task_done(task, ser.validated_data["done"])
        return Response(TaskSerializer(task).data)


class ReflectionView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(
        parameters=[OpenApiParameter("date", str)],
        responses={200: ReflectionResultSerializer},
    )
    def get(self, request):
        user = request.user
        on = _parse_date(request.query_params.get("date"), clock.local_today(user))
        row = DailyReflection.objects.filter(user=user, date=on).first()
        return Response(ReflectionResultSerializer(ReflectionResultSerializer.build(row)).data)

    @extend_schema(request=ReflectionRequestSerializer, responses={200: ReflectionResultSerializer})
    def post(self, request):
        """Save the evening reflection. Crisis or distress language pauses coaching instead."""
        user = request.user
        ser = ReflectionRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        today = clock.local_today(user)
        on = data.get("date", today)
        if not (today - timedelta(days=1) <= on <= today):
            return _conflict("Reflections can be saved for today or yesterday.")
        answers = dict(data["answers"])
        notice = screen_all(user, list(answers.values()), "reflection")
        if notice is not None:
            # Not saved: nothing flagged is kept, scored, or used for coaching.
            return Response(ReflectionResultSerializer(
                ReflectionResultSerializer.build(None, notice)).data)
        row = services.save_reflection(user, on, answers, data.get("rating"))
        return Response(ReflectionResultSerializer(ReflectionResultSerializer.build(row)).data)


class DeepWorkStartView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=DeepWorkStartSerializer, responses={201: DeepWorkSessionSerializer})
    def post(self, request):
        ser = DeepWorkStartSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        task = None
        task_id = ser.validated_data.get("task_id")
        if task_id:
            task = get_object_or_404(services.active_tasks(request.user), pk=task_id)
        try:
            session = services.start_session(
                request.user, ser.validated_data["planned_minutes"], task
            )
        except services.DailyOSError as exc:
            return _conflict(str(exc))
        return Response(DeepWorkSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class DeepWorkActiveView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: DeepWorkSessionSerializer})
    def get(self, request):
        session = services.active_session(request.user)
        if session is None:
            raise NotFound()
        return Response(DeepWorkSessionSerializer(session).data)


class DeepWorkDetailView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=DeepWorkUpdateSerializer, responses={200: DeepWorkSessionSerializer})
    def patch(self, request, pk):
        session = get_object_or_404(DeepWorkSession, pk=pk, user=request.user)
        ser = DeepWorkUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        session = services.end_session(session, abandoned=ser.validated_data["action"] == "abandon")
        return Response(DeepWorkSessionSerializer(session).data)


class WeeklyRitualView(APIView):
    permission_classes = PERMISSIONS

    def _payload(self, user, safety=None):
        state = services.ritual_state(user)
        stats = services.ritual_stats(user, state["week_start"]) if state["week_start"] else None
        answers = None
        if state["completed"]:
            row = WeeklyRitual.objects.filter(user=user, week_start=state["week_start"]).first()
            answers = row.answers if row else None
        return RitualSerializer(RitualSerializer.build(state, stats, answers, safety)).data

    @extend_schema(responses={200: RitualSerializer})
    def get(self, request):
        services.get_sprint(request.user)
        return Response(self._payload(request.user))

    @extend_schema(request=RitualAnswersSerializer, responses={200: RitualSerializer})
    def post(self, request):
        user = request.user
        services.get_sprint(user)
        ser = RitualAnswersSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        answers = dict(ser.validated_data)
        notice = screen_all(user, list(answers.values()), "ritual")
        if notice is not None:
            return Response(self._payload(user, notice))
        try:
            services.complete_ritual(user, answers)
        except services.DailyOSError as exc:
            return _conflict(str(exc))
        return Response(self._payload(user))
