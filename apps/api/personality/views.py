from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.models import EventName  # noqa: F401  (kept for future events)
from core import clock

from .models import PersonalityResult
from .questions import DESCRIPTIONS, IDS, QUESTIONS, TRAITS, compute_scores


class PersonalityQuestionSerializer(serializers.Serializer):
    id = serializers.CharField()
    text = serializers.CharField()
    trait = serializers.ChoiceField(choices=list(TRAITS))


class TraitInfoSerializer(serializers.Serializer):
    trait = serializers.ChoiceField(choices=list(TRAITS))
    name = serializers.CharField()
    high = serializers.CharField()
    low = serializers.CharField()


class QuestionnaireSerializer(serializers.Serializer):
    questions = PersonalityQuestionSerializer(many=True)
    traits = TraitInfoSerializer(many=True)


class ScoresSerializer(serializers.Serializer):
    openness = serializers.IntegerField()
    conscientiousness = serializers.IntegerField()
    extraversion = serializers.IntegerField()
    agreeableness = serializers.IntegerField()
    stability = serializers.IntegerField()


class ResultSerializer(serializers.Serializer):
    scores = ScoresSerializer()
    completed_at = serializers.DateTimeField()
    answered = serializers.IntegerField()


class SubmitSerializer(serializers.Serializer):
    answers = serializers.DictField(
        child=serializers.IntegerField(min_value=1, max_value=5), allow_empty=False
    )


def _result(row: PersonalityResult) -> dict:
    return {"scores": row.scores, "completed_at": row.completed_at, "answered": len(row.answers)}


class QuestionnaireView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: QuestionnaireSerializer})
    def get(self, request):
        data = {
            "questions": [{k: q[k] for k in ("id", "text", "trait")} for q in QUESTIONS],
            "traits": [{"trait": t, **{k: DESCRIPTIONS[t][k] for k in ("name", "high", "low")}}
                       for t in TRAITS],
        }
        return Response(QuestionnaireSerializer(data).data)


class PersonalityView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ResultSerializer})
    def get(self, request):
        row = PersonalityResult.objects.filter(user=request.user).first()
        if row is None:
            raise NotFound()
        return Response(ResultSerializer(_result(row)).data)

    @extend_schema(request=SubmitSerializer, responses={200: ResultSerializer})
    def post(self, request):
        """Score the assessment. Unanswered items are allowed; the user can retake later."""
        ser = SubmitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        answers = ser.validated_data["answers"]
        unknown = set(answers) - IDS
        if unknown:
            raise ValidationError({"answers": f"Unknown question ids: {sorted(unknown)}"})
        row, _ = PersonalityResult.objects.update_or_create(
            user=request.user,
            defaults={"answers": answers, "scores": compute_scores(answers),
                      "completed_at": clock.now()},
        )
        return Response(ResultSerializer(_result(row)).data, status=status.HTTP_200_OK)
