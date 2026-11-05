"""
Onboarding test helpers for Alter Ego OS API test suite (J9).

Replaces slow 13-question interview automation with direct seed and card calibration,
speeding up downstream API test execution while maintaining real data relationships.
"""

from typing import Dict, Any, Optional


def onboard(client, scenario: str = "builder", path: str = "seed") -> Dict[str, Any]:
    """
    Fast test helper to onboard a test user through the Seed flow (J3).

    Args:
        client: The Django test client or API test client
        scenario: Preset scenario profile ("builder", "craftsman", "strategist")
        path: Calibration path ("seed" or "cards")

    Returns:
        Dict containing seeded goal, first task, and protocol state.
    """
    scenarios = {
        "builder": {
            "situation": "know_goal",
            "target_statement": "A sovereign builder who ships autonomous systems without permission.",
            "target_date": "2027-04-01",
            "weekday_minutes": 90,
            "weekend_minutes": 180,
            "today_availability": "Right now",
        },
        "craftsman": {
            "situation": "direction",
            "target_statement": "A craftsman with deep focus, calm boundaries, and unyielding execution.",
            "target_date": "2027-01-01",
            "weekday_minutes": 60,
            "weekend_minutes": 120,
            "today_availability": "Lunch break",
        },
        "strategist": {
            "situation": "change",
            "target_statement": "A disciplined operator who compounds daily habits and ships weekly.",
            "target_date": "2027-10-01",
            "weekday_minutes": 45,
            "weekend_minutes": 90,
            "today_availability": "This afternoon",
        },
    }

    payload = scenarios.get(scenario, scenarios["builder"])

    if not hasattr(client, "post"):
        raise ValueError("client must have a post() method to submit seed requests")

    response = client.post("/api/seed/", payload, format="json")
    status_code = getattr(response, "status_code", None)
    if status_code not in (200, 201, 204):
        content = getattr(response, "content", getattr(response, "data", str(response)))
        raise AssertionError(f"Seed API request failed with status {status_code}: {content}")

    return response.json() if hasattr(response, "json") else response.data


def ready_protocol(client) -> Dict[str, Any]:
    """
    Prepares a fully calibrated active protocol for downstream feature testing
    (Daily OS, Character builder, Legacy timeline, AI Mentor).

    Bypasses interview chat loop by using verified seed calibration.
    """
    return onboard(client, scenario="builder", path="seed")


def run_interview(client, answers: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Legacy helper maintained ONLY for interview-specific unit tests.
    Downstream tests must use ready_protocol(client) or onboard(client).
    """
    import warnings
    warnings.warn(
        "run_interview is deprecated for downstream tests; use onboard() or ready_protocol().",
        DeprecationWarning,
        stacklevel=2,
    )
    return onboard(client, scenario="builder", path="seed")

