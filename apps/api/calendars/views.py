from datetime import date, timedelta

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.permissions import HasFeature
from core import clock

from . import services
from .models import CalendarEvent, CalendarLink

PERMISSIONS = [IsAuthenticated, HasFeature("calendar")]


class LinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarLink
        fields = ["provider", "account_email", "mode", "connected_at"]
        read_only_fields = fields


class ConnectSerializer(serializers.Serializer):
    account_email = serializers.EmailField()


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = ["id", "title", "category", "start", "end"]
        read_only_fields = fields


class SyncResultSerializer(serializers.Serializer):
    created = serializers.IntegerField()
    mode = serializers.ChoiceField(choices=["demo", "google"])


class StatusSerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    link = LinkSerializer(allow_null=True)
    demo_notice = serializers.CharField(allow_null=True)


DEMO_NOTICE = (
    "Demo mode: events are kept inside Alter Ego OS and are not written to Google Calendar. "
    "Google sync arrives with OAuth credentials."
)


def _status(user) -> dict:
    link = CalendarLink.objects.filter(user=user).first()
    return {
        "connected": link is not None,
        "link": link,
        "demo_notice": DEMO_NOTICE if link and link.mode == "demo" else None,
    }


class CalendarStatusView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(responses={200: StatusSerializer})
    def get(self, request):
        return Response(StatusSerializer(_status(request.user)).data)

    @extend_schema(request=ConnectSerializer, responses={200: StatusSerializer})
    def post(self, request):
        ser = ConnectSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        services.connect(request.user, ser.validated_data["account_email"])
        return Response(StatusSerializer(_status(request.user)).data)

    @extend_schema(responses={204: None})
    def delete(self, request):
        services.disconnect(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CalendarSyncView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(request=None, responses={200: SyncResultSerializer})
    def post(self, request):
        link = CalendarLink.objects.filter(user=request.user).first()
        if link is None:
            raise NotFound("Connect a calendar first.")
        created = services.sync_week(request.user)
        return Response(SyncResultSerializer({"created": created, "mode": link.mode}).data)


class CalendarEventsView(APIView):
    permission_classes = PERMISSIONS

    @extend_schema(
        parameters=[OpenApiParameter("from", str), OpenApiParameter("to", str)],
        responses={200: EventSerializer(many=True)},
    )
    def get(self, request):
        today = clock.local_today(request.user)
        try:
            start = date.fromisoformat(request.query_params.get("from", today.isoformat()))
            end = date.fromisoformat(
                request.query_params.get("to", (today + timedelta(days=6)).isoformat())
            )
        except ValueError:
            raise ValidationError({"date": "Use YYYY-MM-DD."}) from None
        events = services.events_between(request.user, start, end)[:200]
        return Response(EventSerializer(list(events), many=True).data)
