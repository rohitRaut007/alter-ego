from datetime import date

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.permissions import HasFeature
from daily_os.services import get_sprint
from safety.serializers import SafetyNoticeSerializer
from safety.services import screen_all

from . import services
from .models import Horizon, LegacyMilestone, QuarterlyReview

PERMISSIONS = [IsAuthenticated, HasFeature("legacy")]


class MilestoneSerializer(serializers.ModelSerializer):
    done = serializers.BooleanField(read_only=True)

    class Meta:
        model = LegacyMilestone
        fields = ["id", "horizon", "title", "detail", "due_label", "progress", "done", "origin",
                  "position"]
        read_only_fields = fields


class MilestoneCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=300)
    horizon = serializers.ChoiceField(choices=Horizon.choices)
    detail = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
    due_label = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")


class MilestoneUpdateSerializer(serializers.Serializer):
    done = serializers.BooleanField(required=False)
    progress = serializers.IntegerField(min_value=0, max_value=100, required=False)
    title = serializers.CharField(max_length=300, required=False)
    detail = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class MilestoneResultSerializer(serializers.Serializer):
    milestone = MilestoneSerializer(allow_null=True)
    safety = SafetyNoticeSerializer(allow_null=True)


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuarterlyReview
        fields = ["id", "scheduled_for", "completed_at"]
        read_only_fields = fields


class SummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    done = serializers.IntegerField()
    average_progress = serializers.IntegerField()


class TimelineSerializer(serializers.Serializer):
    milestones = MilestoneSerializer(many=True)
    summary = SummarySerializer()
    next_review = ReviewSerializer(allow_null=True)


class ReviewScheduleSerializer(serializers.Serializer):
    scheduled_for = serializers.DateField(required=False)


class ReviewCompleteSerializer(serializers.Serializer):
    on_track = serializers.CharField(max_length=2000)
    change = serializers.CharField(max_length=2000, allow_blank=True, default="")


class ReviewResultSerializer(serializers.Serializer):
    review = ReviewSerializer(allow_null=True)
    safety = SafetyNoticeSerializer(allow_null=True)


def _conflict(message: str) -> Response:
    return Response({"detail": message}, status=status.HTTP_409_CONFLICT)


def _timeline(user) -> dict:
    next_review = QuarterlyReview.objects.filter(
        user=user, completed_at__isnull=True, scheduled_for__gte=date.min
    ).order_by("scheduled_for").first()
    return {"milestones": list(services.active(user)), "summary": services.summary(user),
            "next_review": next_review}


class TimelineView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: TimelineSerializer})
    def get(self, request):
        get_sprint(request.user)  # materialises protocol-derived milestones
        return Response(TimelineSerializer(_timeline(request.user)).data)


class MilestoneListView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=MilestoneCreateSerializer, responses={200: MilestoneResultSerializer})
    def post(self, request):
        sprint = get_sprint(request.user)
        ser = MilestoneCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        notice = screen_all(request.user, [d["title"], d["detail"]], "milestone")
        if notice is not None:
            return Response(MilestoneResultSerializer({"milestone": None, "safety": notice}).data)
        ms = services.add_milestone(request.user, sprint.protocol, title=d["title"],
                                    horizon=d["horizon"], detail=d["detail"], due_label=d["due_label"])
        return Response(MilestoneResultSerializer({"milestone": ms, "safety": None}).data)


class MilestoneDetailView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=MilestoneUpdateSerializer, responses={200: MilestoneResultSerializer})
    def patch(self, request, pk):
        ms = get_object_or_404(services.active(request.user), pk=pk)
        ser = MilestoneUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        notice = screen_all(request.user, [d.get("title", ""), d.get("detail", "")], "milestone")
        if notice is not None:
            return Response(MilestoneResultSerializer({"milestone": None, "safety": notice}).data)
        ms = services.update_milestone(
            ms, done=d.get("done"), progress=d.get("progress"), title=d.get("title"),
            detail=d.get("detail"),
        )
        return Response(MilestoneResultSerializer({"milestone": ms, "safety": None}).data)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        ms = get_object_or_404(services.active(request.user), pk=pk)
        if ms.origin == "protocol":
            return _conflict("Milestones from your protocol can be completed but not deleted.")
        ms.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReviewScheduleView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=ReviewScheduleSerializer, responses={201: ReviewSerializer})
    def post(self, request):
        ser = ReviewScheduleSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            review = services.schedule_review(request.user, ser.validated_data.get("scheduled_for"))
        except services.LegacyError as exc:
            return _conflict(str(exc))
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class ReviewCompleteView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=ReviewCompleteSerializer, responses={200: ReviewResultSerializer})
    def post(self, request, pk):
        review = get_object_or_404(QuarterlyReview, pk=pk, user=request.user)
        ser = ReviewCompleteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        answers = dict(ser.validated_data)
        notice = screen_all(request.user, list(answers.values()), "quarterly_review")
        if notice is not None:
            return Response(ReviewResultSerializer({"review": None, "safety": notice}).data)
        try:
            review = services.complete_review(review, answers)
        except services.LegacyError as exc:
            return _conflict(str(exc))
        return Response(ReviewResultSerializer({"review": review, "safety": None}).data)
