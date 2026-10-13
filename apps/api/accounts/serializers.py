from django.contrib.auth import password_validation
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from billing.features import FEATURES, entitlements_for, tier_for

from .models import ConsentLedger, ConsentPurpose, User


class ConsentInputSerializer(serializers.Serializer):
    purpose = serializers.ChoiceField(choices=ConsentPurpose.choices)
    version = serializers.CharField(max_length=32)
    granted = serializers.BooleanField()


class ConsentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsentLedger
        fields = ["id", "purpose", "version", "granted", "created_at"]
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    display_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    timezone = serializers.CharField(max_length=64, required=False)
    consents = ConsentInputSerializer(many=True)

    def validate_email(self, value: str) -> str:
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_consents(self, value: list[dict]) -> list[dict]:
        granted = {c["purpose"] for c in value if c["granted"]}
        missing = {ConsentPurpose.TERMS, ConsentPurpose.PRIVACY} - granted
        if missing:
            raise serializers.ValidationError(
                f"Required consent not granted: {', '.join(sorted(missing))}."
            )
        return value

    def validate(self, attrs: dict) -> dict:
        password_validation.validate_password(
            attrs["password"], user=User(email=attrs["email"])
        )
        return attrs


class MeSerializer(serializers.ModelSerializer):
    tier = serializers.SerializerMethodField()
    entitlements = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "display_name",
            "timezone",
            "locale",
            "ai_training_opt_out",
            "created_at",
            "tier",
            "entitlements",
        ]
        read_only_fields = ["id", "email", "created_at", "tier", "entitlements"]

    @extend_schema_field(serializers.ChoiceField(choices=["core", "full"]))
    def get_tier(self, obj: User) -> str:
        return tier_for(obj)

    @extend_schema_field(serializers.ListField(child=serializers.ChoiceField(choices=FEATURES)))
    def get_entitlements(self, obj: User) -> list[str]:
        return entitlements_for(obj)


class RegisterResponseSerializer(serializers.Serializer):
    user = MeSerializer()
    access = serializers.CharField()
    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
