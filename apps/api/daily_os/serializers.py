from rest_framework import serializers

from safety.serializers import SafetyNoticeSerializer

from .models import DailyReflection, DeepWorkSession, Task
from .services import REFLECTION_PROMPTS, RITUAL_PROMPTS

LAYERS = ["identity", "character", "knowledge", "mission", "daily_os", "presence", "legacy"]


class TaskSerializer(serializers.ModelSerializer):
    done = serializers.BooleanField(read_only=True)
    layer = serializers.ChoiceField(choices=LAYERS, read_only=True)
    trait_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = Task
        fields = [
            "id", "source", "layer", "title", "detail", "minutes", "priority", "due_day",
            "due_date", "week_index", "trait_id", "done", "done_at",
        ]
        read_only_fields = fields


class TaskUpdateSerializer(serializers.Serializer):
    done = serializers.BooleanField()


class PracticeStateSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    trait_id = serializers.UUIDField()
    trait_name = serializers.CharField()
    description = serializers.CharField()
    cadence = serializers.ChoiceField(choices=["daily", "weekly"])
    minutes = serializers.IntegerField()
    streak = serializers.IntegerField()
    best_streak = serializers.IntegerField()
    done_today = serializers.BooleanField()
    done_this_week = serializers.BooleanField()
    due_today = serializers.BooleanField()
    history = serializers.ListField(child=serializers.BooleanField())


class WeekProgressSerializer(serializers.Serializer):
    week = serializers.IntegerField()
    total = serializers.IntegerField()
    done = serializers.IntegerField()
    overdue = serializers.IntegerField()
    overdue_by_layer = serializers.DictField(child=serializers.IntegerField())


class ChecklistProgressSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    done = serializers.IntegerField()
    overdue = serializers.IntegerField()


class RitualStateSerializer(serializers.Serializer):
    available = serializers.BooleanField()
    week_start = serializers.DateField(allow_null=True)
    completed = serializers.BooleanField()
    due = serializers.BooleanField()


class ScheduleBlockSerializer(serializers.Serializer):
    start = serializers.CharField()
    end = serializers.CharField()
    label = serializers.CharField()
    layer = serializers.ChoiceField(choices=LAYERS)
    kind = serializers.CharField()


class BriefSerializer(serializers.Serializer):
    date = serializers.DateField()
    day_number = serializers.IntegerField()
    total_days = serializers.IntegerField()
    sprint_over = serializers.BooleanField()
    sprint_goal = serializers.CharField()
    tone = serializers.ChoiceField(choices=["start", "push", "balanced", "steady"])
    headline = serializers.CharField()
    body = serializers.CharField()
    insight = serializers.CharField(allow_null=True)
    week = WeekProgressSerializer()
    focus = TaskSerializer(many=True)
    due_tasks = TaskSerializer(many=True)
    completed_today = TaskSerializer(many=True)
    checklist = ChecklistProgressSerializer()
    practices = PracticeStateSerializer(many=True)
    practice_streak = serializers.IntegerField()
    best_practice_streak = serializers.IntegerField()
    schedule = ScheduleBlockSerializer(many=True)
    deep_work_target_minutes = serializers.IntegerField()
    deep_work_minutes_today = serializers.IntegerField()
    reflection_done = serializers.BooleanField()
    ritual = RitualStateSerializer()
    alter_ego_name = serializers.CharField()
    identity_statement = serializers.CharField()


class SprintWeekSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    total = serializers.IntegerField()
    done = serializers.IntegerField()
    is_current = serializers.BooleanField()
    tasks = TaskSerializer(many=True)


class SprintSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    starts_on = serializers.DateField()
    ends_on = serializers.DateField()
    goal = serializers.CharField()
    day_number = serializers.IntegerField()
    total_days = serializers.IntegerField()
    weeks = SprintWeekSerializer(many=True)
    checklist = TaskSerializer(many=True)


class PromptSerializer(serializers.Serializer):
    key = serializers.CharField()
    question = serializers.CharField()


class ReflectionAnswersSerializer(serializers.Serializer):
    compounded = serializers.CharField(max_length=2000, allow_blank=False)
    leaked = serializers.CharField(max_length=2000, allow_blank=True, default="")
    tomorrow = serializers.CharField(max_length=2000, allow_blank=True, default="")


class ReflectionRequestSerializer(serializers.Serializer):
    answers = ReflectionAnswersSerializer()
    rating = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    date = serializers.DateField(required=False)


class ReflectionSerializer(serializers.ModelSerializer):
    answers = ReflectionAnswersSerializer()

    class Meta:
        model = DailyReflection
        fields = ["date", "answers", "rating", "updated_at"]
        read_only_fields = fields


class ReflectionResultSerializer(serializers.Serializer):
    reflection = ReflectionSerializer(allow_null=True)
    prompts = PromptSerializer(many=True)
    safety = SafetyNoticeSerializer(allow_null=True)

    @staticmethod
    def build(reflection, safety=None) -> dict:
        return {
            "reflection": reflection,
            "prompts": [{"key": k, "question": q} for k, q in REFLECTION_PROMPTS],
            "safety": safety,
        }


class DeepWorkStartSerializer(serializers.Serializer):
    planned_minutes = serializers.IntegerField(min_value=5, max_value=240, default=90)
    task_id = serializers.UUIDField(required=False, allow_null=True)


class DeepWorkUpdateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["end", "abandon"])


class DeepWorkSessionSerializer(serializers.ModelSerializer):
    task_id = serializers.UUIDField(read_only=True, allow_null=True)
    actual_minutes = serializers.IntegerField(read_only=True)

    class Meta:
        model = DeepWorkSession
        fields = ["id", "task_id", "planned_minutes", "started_at", "ended_at", "abandoned",
                  "actual_minutes"]
        read_only_fields = fields


class RitualStatsSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    tasks_due = serializers.IntegerField()
    tasks_done = serializers.IntegerField()
    missed_by_layer = serializers.DictField(child=serializers.IntegerField())
    practice_days = serializers.IntegerField()
    deep_work_minutes = serializers.IntegerField()


class RitualAnswersSerializer(serializers.Serializer):
    shipped = serializers.CharField(max_length=2000)
    slipped = serializers.CharField(max_length=2000, allow_blank=True, default="")
    next_outcome = serializers.CharField(max_length=2000)


class RitualSerializer(serializers.Serializer):
    state = RitualStateSerializer()
    stats = RitualStatsSerializer(allow_null=True)
    prompts = PromptSerializer(many=True)
    answers = RitualAnswersSerializer(allow_null=True)
    safety = SafetyNoticeSerializer(allow_null=True)

    @staticmethod
    def build(state, stats, answers=None, safety=None) -> dict:
        return {
            "state": state,
            "stats": stats,
            "prompts": [{"key": k, "question": q} for k, q in RITUAL_PROMPTS],
            "answers": answers,
            "safety": safety,
        }
