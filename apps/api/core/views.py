import redis
from django.conf import settings
from django.db import connection
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


@extend_schema(exclude=True)
class HealthView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


@extend_schema(exclude=True)
class ReadyView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        checks: dict[str, str] = {}
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
            checks["database"] = "ok"
        except Exception:
            checks["database"] = "error"
        if settings.CELERY_BROKER_URL.startswith("redis"):
            try:
                redis.from_url(settings.CELERY_BROKER_URL).ping()
                checks["redis"] = "ok"
            except Exception:
                checks["redis"] = "error"
        ok = all(v == "ok" for v in checks.values())
        return Response(
            {"status": "ok" if ok else "error", "checks": checks},
            status=200 if ok else 503,
        )
