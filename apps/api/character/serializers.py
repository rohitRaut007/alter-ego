from rest_framework import serializers

from daily_os.serializers import PracticeStateSerializer
from safety.serializers import SafetyNoticeSerializer


class RatingSerializer(serializers.Serializer):
    day_offset = serializers.IntegerField()
    score = serializers.IntegerField()


class TraitSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    statement = serializers.CharField()
    rationale = serializers.CharField()
    failure_mode = serializers.CharField()
    reflection_prompt = serializers.CharField()
    practices = PracticeStateSerializer(many=True)
    streak = serializers.IntegerField()
    ratings = RatingSerializer(many=True)
    rating_due_offset = serializers.IntegerField(allow_null=True)
    reflection_done_this_month = serializers.BooleanField()


class PracticeLogRequestSerializer(serializers.Serializer):
    date = serializers.DateField(required=False)
    done = serializers.BooleanField(default=True)


class PracticeLogSerializer(serializers.Serializer):
    practice_id = serializers.UUIDField()
    date = serializers.DateField()
    done = serializers.BooleanField()


class TraitRatingRequestSerializer(serializers.Serializer):
    day_offset = serializers.ChoiceField(choices=[0, 14, 30])
    score = serializers.IntegerField(min_value=1, max_value=5)
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class TraitRatingResultSerializer(serializers.Serializer):
    rating = RatingSerializer(allow_null=True)
    safety = SafetyNoticeSerializer(allow_null=True)


class TraitReflectionRequestSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=3000)


class TraitReflectionResultSerializer(serializers.Serializer):
    saved = serializers.BooleanField()
    safety = SafetyNoticeSerializer(allow_null=True)
