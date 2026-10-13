from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.permissions import HasFeature
from core import clock
from daily_os.services import get_sprint
from safety.services import screen

from . import services
from .models import Practice, Trait
from .serializers import (
    PracticeLogRequestSerializer,
    PracticeLogSerializer,
    TraitRatingRequestSerializer,
    TraitRatingResultSerializer,
    TraitReflectionRequestSerializer,
    TraitReflectionResultSerializer,
    TraitSerializer,
)

PERMISSIONS = [IsAuthenticated, HasFeature("character")]


def _conflict(message: str) -> Response:
    return Response({"detail": message}, status=status.HTTP_409_CONFLICT)


class TraitListView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: TraitSerializer(many=True)})
    def get(self, request):
        user = request.user
        sprint = get_sprint(user)
        data = services.trait_overview(user, sprint.protocol, clock.local_today(user),
                                       sprint.starts_on)
        return Response(TraitSerializer(data, many=True).data)


class PracticeLogView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=PracticeLogRequestSerializer, responses={200: PracticeLogSerializer})
    def post(self, request, pk):
        """Mark a practice done (or undo it) for today or yesterday."""
        practice = get_object_or_404(
            Practice, pk=pk, trait__user=request.user, archived_at__isnull=True
        )
        ser = PracticeLogRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        on = ser.validated_data.get("date") or clock.local_today(request.user)
        try:
            log = services.log_practice(request.user, practice, on, ser.validated_data["done"])
        except services.CharacterError as exc:
            return _conflict(str(exc))
        return Response(PracticeLogSerializer(
            {"practice_id": practice.id, "date": log.date, "done": log.done}).data)


class TraitRatingView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=TraitRatingRequestSerializer,
                   responses={200: TraitRatingResultSerializer})
    def post(self, request, pk):
        trait = get_object_or_404(Trait, pk=pk, user=request.user, archived_at__isnull=True)
        ser = TraitRatingRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        note = d.get("note") or None
        notice = screen(request.user, note, "trait_rating") if note else None
        try:
            rating = services.submit_rating(
                request.user, trait, int(d["day_offset"]), d["score"],
                None if notice else note,  # a flagged note is dropped; the score still counts
            )
        except services.CharacterError as exc:
            return _conflict(str(exc))
        return Response(TraitRatingResultSerializer({
            "rating": {"day_offset": rating.day_offset, "score": rating.score},
            "safety": notice,
        }).data)


class TraitReflectionView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=TraitReflectionRequestSerializer,
                   responses={200: TraitReflectionResultSerializer})
    def post(self, request, pk):
        trait = get_object_or_404(Trait, pk=pk, user=request.user, archived_at__isnull=True)
        ser = TraitReflectionRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        text = ser.validated_data["text"]
        notice = screen(request.user, text, "trait_reflection")
        if notice is not None:
            return Response(TraitReflectionResultSerializer(
                {"saved": False, "safety": notice}).data)
        services.submit_reflection(request.user, trait, text)
        return Response(TraitReflectionResultSerializer({"saved": True, "safety": None}).data)
