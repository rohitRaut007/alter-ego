from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from analytics.services import track
from analytics.models import EventName

from .models import ConsentLedger, User
from .serializers import (
    ConsentInputSerializer,
    ConsentSerializer,
    DeleteAccountSerializer,
    LogoutSerializer,
    MeSerializer,
    RegisterResponseSerializer,
    RegisterSerializer,
)


class AuthThrottleMixin:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RegisterView(AuthThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        request=RegisterSerializer,
        responses={201: RegisterResponseSerializer},
        auth=[],
    )
    @transaction.atomic
    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = User.objects.create_user(
            email=data["email"],
            password=data["password"],
            display_name=data.get("display_name", ""),
            timezone=data.get("timezone", "UTC"),
        )
        ConsentLedger.objects.bulk_create(
            [ConsentLedger(user=user, **c) for c in data["consents"]]
        )
        track(user, EventName.ACCOUNT_CREATED)
        refresh = RefreshToken.for_user(user)
        body = {
            "user": MeSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
        return Response(body, status=status.HTTP_201_CREATED)


class ThrottledTokenObtainPairView(AuthThrottleMixin, TokenObtainPairView):
    pass


class ThrottledTokenRefreshView(AuthThrottleMixin, TokenRefreshView):
    pass


class LogoutView(APIView):
    @extend_schema(request=LogoutSerializer, responses={204: None})
    def post(self, request):
        ser = LogoutSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            RefreshToken(ser.validated_data["refresh"]).blacklist()
        except TokenError:
            return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_object(self) -> User:
        return self.request.user

    @extend_schema(request=DeleteAccountSerializer, responses={204: None})
    def delete(self, request):
        """Hard delete the account and everything linked to it."""
        ser = DeleteAccountSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if not request.user.check_password(ser.validated_data["password"]):
            return Response({"detail": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST)
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConsentListCreateView(generics.ListCreateAPIView):
    """Read the ledger or append a new decision. Rows are never edited."""

    pagination_class = None

    def get_serializer_class(self):
        return ConsentInputSerializer if self.request.method == "POST" else ConsentSerializer

    def get_queryset(self):
        return ConsentLedger.objects.filter(user=self.request.user)

    @extend_schema(request=ConsentInputSerializer, responses={201: ConsentSerializer})
    def post(self, request, *args, **kwargs):
        ser = ConsentInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        row = ConsentLedger.objects.create(user=request.user, **ser.validated_data)
        return Response(ConsentSerializer(row).data, status=status.HTTP_201_CREATED)
