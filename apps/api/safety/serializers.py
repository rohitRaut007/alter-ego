from rest_framework import serializers


class SafetyResourceSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    contact = serializers.CharField()
    kind = serializers.ChoiceField(choices=["phone", "web", "emergency"])
    note = serializers.CharField()


class SafetyNoticeSerializer(serializers.Serializer):
    """Returned with HTTP 200 instead of a coaching reply when the boundary triggers."""

    paused = serializers.BooleanField()
    category = serializers.ChoiceField(choices=["crisis", "distress"])
    message = serializers.CharField()
    resources = SafetyResourceSerializer(many=True)
