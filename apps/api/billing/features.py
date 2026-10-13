"""Tier gating. Feature keys are the contract with clients (`entitlements[]`)."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from accounts.models import User

CORE_FEATURES = ("protocol", "daily_os", "character", "knowledge", "mentor")
FULL_ONLY_FEATURES = ("presence", "legacy", "calendar")
FEATURES = CORE_FEATURES + FULL_ONLY_FEATURES

TIER_FEATURES: dict[str, tuple[str, ...]] = {
    "core": CORE_FEATURES,
    "full": FEATURES,
}


def tier_for(user: "User") -> str:
    sub = getattr(user, "subscription", None)
    return sub.tier if sub else "core"


def entitlements_for(user: "User") -> list[str]:
    sub = getattr(user, "subscription", None)
    if sub is None or not sub.is_entitled:
        return []
    return list(TIER_FEATURES.get(sub.tier, ()))
