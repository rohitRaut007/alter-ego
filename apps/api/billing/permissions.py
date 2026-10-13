from rest_framework.permissions import BasePermission

from .features import FEATURES, entitlements_for


def HasFeature(feature: str) -> type[BasePermission]:
    """Build a DRF permission class requiring a feature entitlement.

    Usage: `permission_classes = [IsAuthenticated, HasFeature("presence")]`
    """
    if feature not in FEATURES:
        raise ValueError(f"Unknown feature: {feature}")

    class _HasFeature(BasePermission):
        code = "entitlement_required"
        message = {"code": "entitlement_required", "feature": feature}

        def has_permission(self, request, view) -> bool:
            user = request.user
            return bool(
                user and user.is_authenticated and feature in entitlements_for(user)
            )

    _HasFeature.__name__ = f"HasFeature_{feature}"
    return _HasFeature
