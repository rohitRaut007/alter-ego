from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from safety.serializers import SafetyNoticeSerializer

from .models import Interview, InterviewTurn, Protocol, ProtocolSection
from .schema.v2 import SECTION_KEYS
from .services import NextStep, assemble_document, current_sections


class QuestionSerializer(serializers.ModelSerializer):
    suggestions = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta:
        model = InterviewTurn
        fields = ["idx", "stage", "question", "suggestions", "multi_select", "placeholder"]
        read_only_fields = fields


class InterviewStepSerializer(serializers.Serializer):
    interview_id = serializers.UUIDField()
    status = serializers.CharField()
    answered_count = serializers.IntegerField()
    question = QuestionSerializer(allow_null=True)
    acknowledgement = serializers.CharField(allow_blank=True)
    progress = serializers.FloatField()
    done = serializers.BooleanField()
    safety = SafetyNoticeSerializer(allow_null=True)

    @staticmethod
    def build(interview: Interview, step: NextStep, safety=None) -> dict:
        return {
            "interview_id": interview.id,
            "status": interview.status,
            "answered_count": interview.turns.filter(answer__isnull=False).count(),
            "question": step.turn,
            "acknowledgement": step.acknowledgement,
            "progress": step.progress,
            "done": step.done,
            "safety": safety,
        }


class AnswerRequestSerializer(serializers.Serializer):
    answer = serializers.CharField(max_length=4000, trim_whitespace=True)


class CompleteResponseSerializer(serializers.Serializer):
    protocol_id = serializers.UUIDField()


class ProtocolSectionSerializer(serializers.ModelSerializer):
    content = serializers.JSONField()

    class Meta:
        model = ProtocolSection
        fields = ["key", "revision", "content", "created_at"]
        read_only_fields = fields


class ProtocolSerializer(serializers.ModelSerializer):
    expected_sections = serializers.SerializerMethodField()
    sections = serializers.SerializerMethodField()
    document = serializers.SerializerMethodField()

    class Meta:
        model = Protocol
        fields = [
            "id", "status", "schema_version", "failure_code", "accuracy_rating",
            "created_at", "completed_at", "expected_sections", "sections", "document",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_expected_sections(self, obj: Protocol) -> list[str]:
        return list(SECTION_KEYS)

    @extend_schema_field(ProtocolSectionSerializer(many=True))
    def get_sections(self, obj: Protocol) -> list[dict]:
        return ProtocolSectionSerializer(list(current_sections(obj).values()), many=True).data

    def get_document(self, obj: Protocol) -> dict | None:
        if obj.status != "ready":
            return None
        return assemble_document(obj)


class ReviseRequestSerializer(serializers.Serializer):
    instruction = serializers.CharField(max_length=1000, trim_whitespace=True)


class ReviseResultSerializer(serializers.Serializer):
    """Either the revised section, or a safety notice when the instruction tripped the boundary."""

    section = ProtocolSectionSerializer(allow_null=True)
    safety = SafetyNoticeSerializer(allow_null=True)


class RatingRequestSerializer(serializers.Serializer):
    score = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class RatingResultSerializer(serializers.Serializer):
    safety = SafetyNoticeSerializer(allow_null=True)
