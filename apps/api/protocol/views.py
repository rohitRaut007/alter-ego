import asyncio
import json
import time
from collections.abc import AsyncIterator

from asgiref.sync import sync_to_async
from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.models import EventName
from analytics.services import track
from billing.permissions import HasFeature
from safety.services import screen

from .models import Interview, Protocol, ProtocolEvent, ProtocolStatus
from .pdf import render_protocol_pdf
from .serializers import (
    AnswerRequestSerializer,
    CompleteResponseSerializer,
    InterviewStepSerializer,
    ProtocolSectionSerializer,
    ProtocolSerializer,
    RatingRequestSerializer,
    RatingResultSerializer,
    ReviseRequestSerializer,
    ReviseResultSerializer,
)
from .services import (
    InterviewError,
    SectionGenerationError,
    assemble_document,
    create_protocol,
    revise_section,
    start_interview,
    step_for,
    submit_answer,
)
from .tasks import generate_protocol_task

PERMISSIONS = [IsAuthenticated, HasFeature("protocol")]
SSE_MAX_SECONDS = 600
SSE_HEARTBEAT_SECONDS = 15


def _interview_or_404(request, pk) -> Interview:
    try:
        return Interview.objects.select_related("user").get(pk=pk, user=request.user)
    except Interview.DoesNotExist:
        raise NotFound() from None


def _protocol_or_404(request, pk) -> Protocol:
    try:
        return Protocol.objects.select_related("user", "interview").get(pk=pk, user=request.user)
    except Protocol.DoesNotExist:
        raise NotFound() from None


def _conflict(message: str) -> Response:
    return Response({"detail": message}, status=status.HTTP_409_CONFLICT)


class InterviewStartView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=None, responses={201: InterviewStepSerializer})
    def post(self, request):
        """Begin the interview, or resume the one in progress."""
        interview, step = start_interview(request.user)
        body = InterviewStepSerializer(InterviewStepSerializer.build(interview, step)).data
        return Response(body, status=status.HTTP_201_CREATED)


class InterviewCurrentView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: InterviewStepSerializer})
    def get(self, request):
        interview = (
            Interview.objects.filter(user=request.user, status="in_progress")
            .order_by("-started_at")
            .first()
        )
        if interview is None:
            raise NotFound()
        return Response(InterviewStepSerializer(
            InterviewStepSerializer.build(interview, step_for(interview))).data)


class InterviewTurnView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=AnswerRequestSerializer, responses={200: InterviewStepSerializer})
    def post(self, request, pk):
        interview = _interview_or_404(request, pk)
        ser = AnswerRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        notice = screen(request.user, ser.validated_data["answer"], "interview")
        if notice is not None:
            # Not stored, not sent to the model. The same question stays open.
            return Response(InterviewStepSerializer(
                InterviewStepSerializer.build(interview, step_for(interview), notice)).data)
        try:
            step = submit_answer(interview, ser.validated_data["answer"])
        except InterviewError as exc:
            return _conflict(str(exc))
        interview.refresh_from_db()
        return Response(InterviewStepSerializer(
            InterviewStepSerializer.build(interview, step)).data)


class InterviewCompleteView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=None, responses={202: CompleteResponseSerializer})
    def post(self, request, pk):
        """Finish the interview and start protocol generation (async when a broker is set)."""
        interview = _interview_or_404(request, pk)
        try:
            protocol, created = create_protocol(interview)
        except InterviewError as exc:
            return _conflict(str(exc))
        if created:
            generate_protocol_task.delay(str(protocol.id))
        return Response({"protocol_id": protocol.id}, status=status.HTTP_202_ACCEPTED)


class ProtocolDetailView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: ProtocolSerializer})
    def get(self, request, pk):
        return Response(ProtocolSerializer(_protocol_or_404(request, pk)).data)


class ProtocolLatestView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: ProtocolSerializer})
    def get(self, request):
        protocol = Protocol.objects.filter(user=request.user).order_by("-created_at").first()
        if protocol is None:
            raise NotFound()
        return Response(ProtocolSerializer(protocol).data)


def _fetch_events(protocol_id, after: int) -> tuple[list[ProtocolEvent], str]:
    events = list(ProtocolEvent.objects.filter(protocol_id=protocol_id, id__gt=after)[:100])
    state = Protocol.objects.values_list("status", flat=True).get(pk=protocol_id)
    return events, state


async def event_stream(protocol_id, after: int) -> AsyncIterator[str]:
    """Server-sent events backed by the persisted event log, so clients can resume by id."""
    started = last_beat = time.monotonic()
    while True:
        events, state = await sync_to_async(_fetch_events)(protocol_id, after)
        for ev in events:
            after = ev.id
            yield f"id: {ev.id}\nevent: {ev.type}\ndata: {json.dumps(ev.data)}\n\n"
        if not events:
            if state != ProtocolStatus.GENERATING:
                return
            if time.monotonic() - started > SSE_MAX_SECONDS:
                return
            if time.monotonic() - last_beat >= SSE_HEARTBEAT_SECONDS:
                last_beat = time.monotonic()
                yield ": keep-alive\n\n"
            await asyncio.sleep(settings.SSE_POLL_SECONDS)


class ProtocolEventsView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={(200, "text/event-stream"): OpenApiTypes.STR})
    def get(self, request, pk):
        """Progress stream: `section.ready`, `progress`, `done`, `error`. Resume with Last-Event-ID."""
        protocol = _protocol_or_404(request, pk)
        raw = request.headers.get("Last-Event-ID") or request.query_params.get("after") or "0"
        after = int(raw) if raw.isdigit() else 0
        response = StreamingHttpResponse(
            event_stream(protocol.id, after), content_type="text/event-stream"
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class ProtocolReviseView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=ReviseRequestSerializer, responses={200: ReviseResultSerializer})
    def post(self, request, pk, key):
        """Revise one section through conversation. Other sections are not regenerated."""
        protocol = _protocol_or_404(request, pk)
        ser = ReviseRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        notice = screen(request.user, ser.validated_data["instruction"], "revise")
        if notice is not None:
            return Response(ReviseResultSerializer({"section": None, "safety": notice}).data)
        try:
            section = revise_section(protocol, key, ser.validated_data["instruction"])
        except InterviewError as exc:
            return _conflict(str(exc))
        except SectionGenerationError:
            return Response(
                {"detail": "That change could not be applied. Try rephrasing it."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response(ReviseResultSerializer({"section": section, "safety": None}).data)


class ProtocolRatingView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=RatingRequestSerializer, responses={200: RatingResultSerializer})
    def post(self, request, pk):
        protocol = _protocol_or_404(request, pk)
        if protocol.status != ProtocolStatus.READY:
            return _conflict("The protocol is not ready to rate.")
        ser = RatingRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = ser.validated_data.get("comment") or None
        notice = screen(request.user, comment, "rating") if comment else None
        protocol.accuracy_rating = ser.validated_data["score"]
        # A flagged comment is dropped; the score still counts.
        protocol.rating_comment = None if notice else comment
        protocol.save(update_fields=["accuracy_rating", "rating_comment"])
        track(request.user, EventName.PROTOCOL_RATED, {"score": protocol.accuracy_rating})
        return Response(RatingResultSerializer({"safety": notice}).data)


class ProtocolPdfView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        protocol = _protocol_or_404(request, pk)
        if protocol.status != ProtocolStatus.READY:
            return _conflict("The protocol is not ready to export.")
        pdf = render_protocol_pdf(assemble_document(protocol), request.user.display_name)
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="alter-ego-protocol.pdf"'
        return response
