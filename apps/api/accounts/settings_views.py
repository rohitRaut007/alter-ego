import json

from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from daily_os.services import latest_ready_protocol
from protocol.services import InterviewError, edit_identity
from safety.serializers import SafetyNoticeSerializer
from safety.services import screen_all

from . import portability
from .serializers import (
    IdentityEditSerializer,
    MeSerializer,
    ResetResultSerializer,
    ResetSerializer,
)


class IdentityResultSerializer(serializers.Serializer):
    me = MeSerializer(allow_null=True)
    safety = SafetyNoticeSerializer(allow_null=True)


class ExportView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={(200, "application/json"): OpenApiTypes.BINARY})
    def get(self, request):
        """Download everything held for this account as JSON."""
        data = portability.export_user_data(request.user)
        body = json.dumps(data, indent=2, ensure_ascii=False)
        response = HttpResponse(body, content_type="application/json")
        response["Content-Disposition"] = 'attachment; filename="alter-ego-export.json"'
        return response


class ResetView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=ResetSerializer, responses={200: ResetResultSerializer})
    def post(self, request):
        ser = ResetSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if not ser.validated_data["confirm"]:
            return Response({"detail": "Confirmation required."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ResetResultSerializer(portability.reset_protocol(request.user)).data)


class IdentityEditView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=IdentityEditSerializer, responses={200: IdentityResultSerializer})
    def patch(self, request):
        """Edit the alter ego name and identity statement directly on the protocol."""
        ser = IdentityEditSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        protocol = latest_ready_protocol(request.user)
        if protocol is None:
            return Response({"detail": "Complete the interview first."},
                            status=status.HTTP_404_NOT_FOUND)
        notice = screen_all(request.user, list(d.values()), "identity_edit")
        if notice is not None:
            return Response(IdentityResultSerializer({"me": None, "safety": notice}).data)
        try:
            edit_identity(protocol, alter_ego_name=d.get("alter_ego_name"),
                          identity_statement=d.get("identity_statement"))
        except InterviewError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(IdentityResultSerializer({"me": request.user, "safety": None}).data)
