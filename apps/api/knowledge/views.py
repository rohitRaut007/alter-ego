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
from .models import KnowledgeNote, NoteKind, ReadingItem, ReadingStatus

PERMISSIONS = [IsAuthenticated, HasFeature("knowledge")]


class ReadingItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingItem
        fields = ["id", "sequence", "title", "author", "why_now", "estimated_hours", "status",
                  "progress", "started_at", "finished_at"]
        read_only_fields = fields


class ReadingItemUpdateSerializer(serializers.Serializer):
    progress = serializers.IntegerField(min_value=0, max_value=100, required=False)
    status = serializers.ChoiceField(choices=ReadingStatus.choices, required=False)


class StatsSerializer(serializers.Serializer):
    reading = serializers.IntegerField()
    finished = serializers.IntegerField()
    want = serializers.IntegerField()
    notes = serializers.IntegerField()
    average_progress = serializers.IntegerField()


RECOMMENDATION_KINDS = ["finish", "start", "discover"]
ROADMAP_PHASES = ["now", "next_90_days", "this_year"]


class RecommendationSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=RECOMMENDATION_KINDS)
    title = serializers.CharField()
    author = serializers.CharField()
    reason = serializers.CharField()
    item_id = serializers.UUIDField(allow_null=True)
    source_id = serializers.CharField(allow_null=True)


class RoadmapPhaseSerializer(serializers.Serializer):
    phase = serializers.ChoiceField(choices=ROADMAP_PHASES)
    focus = serializers.CharField()
    titles = serializers.ListField(child=serializers.CharField())


class LibrarySerializer(serializers.Serializer):
    items = ReadingItemSerializer(many=True)
    stats = StatsSerializer()
    recommendation = RecommendationSerializer(allow_null=True)
    roadmap = RoadmapPhaseSerializer(many=True)
    destruction_test_template = serializers.CharField()
    sequencing_rationale = serializers.CharField()


class NoteSerializer(serializers.ModelSerializer):
    item_id = serializers.UUIDField(read_only=True, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta:
        model = KnowledgeNote
        fields = ["id", "kind", "title", "source", "body", "tags", "item_id", "created_at"]
        read_only_fields = fields


class NoteCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(max_length=6000)
    source = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    kind = serializers.ChoiceField(choices=NoteKind.choices, default=NoteKind.NOTE)
    tags = serializers.ListField(child=serializers.CharField(max_length=24), required=False,
                                 max_length=6)
    item_id = serializers.UUIDField(required=False, allow_null=True)


class NoteResultSerializer(serializers.Serializer):
    note = NoteSerializer(allow_null=True)
    safety = SafetyNoticeSerializer(allow_null=True)


class AdvisorRequestSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=1000)


class AdvisorSourceSerializer(serializers.Serializer):
    id = serializers.CharField()
    title = serializers.CharField()
    author = serializers.CharField()
    summary = serializers.CharField()


class AdvisorResultSerializer(serializers.Serializer):
    answer = serializers.CharField(allow_blank=True)
    sources = AdvisorSourceSerializer(many=True)
    safety = SafetyNoticeSerializer(allow_null=True)


def _conflict(message: str) -> Response:
    return Response({"detail": message}, status=status.HTTP_409_CONFLICT)


class LibraryView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: LibrarySerializer})
    def get(self, request):
        sprint = get_sprint(request.user)
        return Response(LibrarySerializer(services.library(request.user, sprint.protocol)).data)


class ReadingItemView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=ReadingItemUpdateSerializer, responses={200: ReadingItemSerializer})
    def patch(self, request, pk):
        item = get_object_or_404(ReadingItem, pk=pk, user=request.user, archived_at__isnull=True)
        ser = ReadingItemUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            item = services.set_progress(
                item, ser.validated_data.get("progress"), ser.validated_data.get("status")
            )
        except services.KnowledgeError as exc:
            return _conflict(str(exc))
        return Response(ReadingItemSerializer(item).data)


class NoteListView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: NoteSerializer(many=True)})
    def get(self, request):
        get_sprint(request.user)
        qs = KnowledgeNote.objects.filter(user=request.user)
        kind = request.query_params.get("kind")
        if kind in NoteKind.values:
            qs = qs.filter(kind=kind)
        return Response(NoteSerializer(list(qs[:200]), many=True).data)

    @extend_schema(request=NoteCreateSerializer, responses={200: NoteResultSerializer})
    def post(self, request):
        get_sprint(request.user)
        ser = NoteCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        notice = screen_all(request.user, [d["title"], d["body"], d.get("source", "")], "note")
        if notice is not None:
            return Response(NoteResultSerializer({"note": None, "safety": notice}).data)
        item = None
        if d.get("item_id"):
            item = get_object_or_404(ReadingItem, pk=d["item_id"], user=request.user)
        note = services.create_note(
            request.user, title=d["title"], body=d["body"], source=d.get("source", ""),
            tags=d.get("tags"), kind=d["kind"], item=item,
        )
        return Response(NoteResultSerializer({"note": note, "safety": None}).data)


class NoteDetailView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        get_object_or_404(KnowledgeNote, pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdvisorView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=AdvisorRequestSerializer, responses={200: AdvisorResultSerializer})
    def post(self, request):
        """Ask for reading advice, note summaries or connections. Cites curated sources only."""
        sprint = get_sprint(request.user)
        ser = AdvisorRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        query = ser.validated_data["query"]
        notice = screen_all(request.user, [query], "knowledge_advisor")
        if notice is not None:
            return Response(AdvisorResultSerializer(
                {"answer": "", "sources": [], "safety": notice}).data)
        result = services.ask_advisor(request.user, sprint.protocol, query)
        return Response(AdvisorResultSerializer({**result, "safety": None}).data)
