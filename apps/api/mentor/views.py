import json
from collections.abc import AsyncIterator

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db.models import Count
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from billing.permissions import HasFeature
from core import clock
from daily_os.services import get_sprint, layer_stats

from . import challenges as challenge_service
from . import chat, proactive
from .models import MemoryFact, MentorChallenge, MentorNudge, MentorThread
from .serializers import (
    ChallengeSerializer,
    FactSerializer,
    MessageRequestSerializer,
    MessageResultSerializer,
    NudgeSerializer,
    PromptsSerializer,
    ThreadCreateSerializer,
    ThreadDetailSerializer,
    ThreadSerializer,
)

PERMISSIONS = [IsAuthenticated, HasFeature("mentor")]

BASE_PROMPTS = [
    "What should I do first today?",
    "Where am I drifting from my identity statement?",
    "Recalibrate my 90-day sprint",
    "Give me a hard challenge for this week",
    "What should I read next and why?",
]
LAYER_NAMES = {"identity": "Identity", "character": "Character", "knowledge": "Knowledge",
               "mission": "Mission", "daily_os": "Daily OS", "presence": "Presence",
               "legacy": "Legacy"}


def _conflict(message: str, code: str | None = None) -> Response:
    body = {"detail": message}
    if code:
        body["code"] = code
    return Response(body, status=status.HTTP_409_CONFLICT)


def _thread(request, pk) -> MentorThread:
    return get_object_or_404(MentorThread, pk=pk, user=request.user)


def _with_count(qs):
    return qs.annotate(message_count=Count("messages"))


class ThreadListView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: ThreadSerializer(many=True)})
    def get(self, request):
        qs = _with_count(MentorThread.objects.filter(user=request.user))[:50]
        return Response(ThreadSerializer(list(qs), many=True).data)

    @extend_schema(request=ThreadCreateSerializer, responses={201: ThreadSerializer})
    def post(self, request):
        ser = ThreadCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        thread = chat.create_thread(request.user, ser.validated_data["kind"])
        thread.message_count = 0
        return Response(ThreadSerializer(thread).data, status=status.HTTP_201_CREATED)


class ThreadDetailView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: ThreadDetailSerializer})
    def get(self, request, pk):
        thread = get_object_or_404(_with_count(MentorThread.objects.filter(user=request.user)), pk=pk)
        data = {"thread": thread, "messages": list(thread.messages.all())}
        return Response(ThreadDetailSerializer(data).data)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        _thread(request, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ThreadResumeView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=None, responses={200: ThreadSerializer})
    def post(self, request, pk):
        thread = chat.resume(_thread(request, pk))
        thread.message_count = thread.messages.count()
        return Response(ThreadSerializer(thread).data)


async def _event_stream(turn: chat.Turn, thread: MentorThread) -> AsyncIterator[str]:
    """Server-sent events: start, token*, done | error."""
    it = turn.chunks
    assert it is not None and turn.user_message is not None
    yield f"event: start\ndata: {json.dumps({'user_message_id': str(turn.user_message.id)})}\n\n"
    sentinel = object()
    try:
        while True:
            chunk = await sync_to_async(next)(it, sentinel)
            if chunk is sentinel:
                break
            yield f"event: token\ndata: {json.dumps({'text': chunk})}\n\n"
        reply = await sync_to_async(turn.finalize)()  # type: ignore[misc]
        yield ("event: done\ndata: "
               + json.dumps({"message_id": str(reply.id), "title": thread.title}) + "\n\n")
    except Exception:  # noqa: BLE001
        yield 'event: error\ndata: {"code": "mentor_unavailable"}\n\n'


class MessageView(APIView):
    permission_classes = PERMISSIONS
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mentor"

    @extend_schema(
        request=MessageRequestSerializer,
        responses={
            200: MessageResultSerializer,
            (200, "text/event-stream"): OpenApiTypes.STR,
        },
    )
    def post(self, request, pk):
        """Send a message. Streams tokens as SSE, or returns JSON with `stream: false`.

        If the message trips the safety boundary the response is always JSON with `safety` set,
        the thread is paused, and nothing is stored or sent to a model.
        """
        thread = _thread(request, pk)
        ser = MessageRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            turn = chat.begin_turn(request.user, thread, ser.validated_data["content"])
        except chat.ChatError as exc:
            paused = thread.status == "paused_safety"
            return _conflict(str(exc), "thread_paused" if paused else None)

        thread.message_count = thread.messages.count()
        if turn.safety is not None:
            return Response(MessageResultSerializer({
                "user_message": None, "reply": None, "thread": thread, "safety": turn.safety,
            }).data)

        if not ser.validated_data["stream"]:
            for _ in turn.chunks:  # type: ignore[union-attr]
                pass
            reply = turn.finalize()  # type: ignore[misc]
            thread.refresh_from_db()
            thread.message_count = thread.messages.count()
            return Response(MessageResultSerializer({
                "user_message": turn.user_message, "reply": reply, "thread": thread, "safety": None,
            }).data)

        response = StreamingHttpResponse(_event_stream(turn, thread),
                                         content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class MemoryListView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: FactSerializer(many=True)})
    def get(self, request):
        facts = MemoryFact.objects.filter(user=request.user)[:100]
        return Response(FactSerializer(list(facts), many=True).data)


class MemoryDetailView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        get_object_or_404(MemoryFact, pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NudgeListView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: NudgeSerializer(many=True)})
    def get(self, request):
        """Evaluates the proactive rules (idempotent) and returns recent nudges."""
        proactive.evaluate(request.user)
        qs = MentorNudge.objects.filter(user=request.user)[:20]
        return Response(NudgeSerializer(list(qs), many=True).data)


class NudgeReadView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=None, responses={200: NudgeSerializer})
    def post(self, request, pk):
        nudge = get_object_or_404(MentorNudge, pk=pk, user=request.user)
        if nudge.read_at is None:
            nudge.read_at = now()
            nudge.save(update_fields=["read_at"])
        return Response(NudgeSerializer(nudge).data)


class ChallengeListView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: ChallengeSerializer(many=True)})
    def get(self, request):
        items = challenge_service.ensure_weekly(request.user)
        return Response(ChallengeSerializer(items, many=True).data)


class ChallengeActionView(APIView):
    permission_classes = PERMISSIONS
    action = "accept"

    @extend_schema(request=None, responses={200: ChallengeSerializer})
    def post(self, request, pk):
        ch = get_object_or_404(MentorChallenge, pk=pk, user=request.user)
        try:
            if self.action == "accept":
                ch = challenge_service.accept(request.user, ch)
            else:
                ch = challenge_service.dismiss(ch)
        except challenge_service.ChallengeError as exc:
            return _conflict(str(exc))
        return Response(ChallengeSerializer(ch).data)


class PromptsView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: PromptsSerializer})
    def get(self, request):
        prompts = list(BASE_PROMPTS)
        try:
            sprint = get_sprint(request.user)
            weak = [r for r in layer_stats(request.user, sprint, clock.local_today(request.user))
                    if r["overdue"] > 0]
            if weak:
                prompts.insert(0, f"Why are my {LAYER_NAMES.get(weak[0]['layer'], weak[0]['layer'])} "
                                  "tasks slipping?")
        except Exception:  # noqa: BLE001 - prompts are optional
            pass
        return Response(PromptsSerializer(
            {"prompts": prompts[:6], "persona_name": settings.MENTOR_PERSONA_NAME}).data)

