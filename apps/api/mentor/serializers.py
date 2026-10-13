from rest_framework import serializers

from safety.serializers import SafetyNoticeSerializer

from .models import MemoryFact, MentorChallenge, MentorMessage, MentorNudge, MentorThread

LAYERS = ["identity", "character", "knowledge", "mission", "daily_os", "presence", "legacy"]


class ThreadSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = MentorThread
        fields = ["id", "title", "kind", "status", "created_at", "updated_at", "message_count"]
        read_only_fields = fields


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MentorMessage
        fields = ["id", "role", "body", "created_at"]
        read_only_fields = fields


class ThreadDetailSerializer(serializers.Serializer):
    thread = ThreadSerializer()
    messages = MessageSerializer(many=True)


class ThreadCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["chat", "weekly", "sprint"], default="chat")


class MessageRequestSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=4000, trim_whitespace=True)
    stream = serializers.BooleanField(default=True)


class MessageResultSerializer(serializers.Serializer):
    """JSON result when not streaming, or when the safety boundary replaced the reply."""

    user_message = MessageSerializer(allow_null=True)
    reply = MessageSerializer(allow_null=True)
    thread = ThreadSerializer()
    safety = SafetyNoticeSerializer(allow_null=True)


class FactSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemoryFact
        fields = ["id", "kind", "text", "created_at"]
        read_only_fields = fields


class NudgeSerializer(serializers.ModelSerializer):
    read = serializers.SerializerMethodField()

    class Meta:
        model = MentorNudge
        fields = ["id", "kind", "body", "created_at", "read"]
        read_only_fields = fields

    def get_read(self, obj: MentorNudge) -> bool:
        return obj.read_at is not None


class ChallengeSerializer(serializers.ModelSerializer):
    layer = serializers.ChoiceField(choices=LAYERS, read_only=True)
    task_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = MentorChallenge
        fields = ["id", "week_index", "layer", "difficulty", "title", "detail", "status", "task_id"]
        read_only_fields = fields


class PromptsSerializer(serializers.Serializer):
    prompts = serializers.ListField(child=serializers.CharField())
    persona_name = serializers.CharField()
