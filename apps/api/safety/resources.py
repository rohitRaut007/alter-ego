"""Support resources shown when the safety boundary triggers.

Verified against official or organisational sources on 2026-10-13 (see `source`). They still
need a human review before real users (docs/ROADMAP.md gates), so `HUMAN_REVIEWED` stays False
and the review queue should flip it only after sign-off.
"""

from dataclasses import dataclass

HUMAN_REVIEWED = False


@dataclass(frozen=True)
class Resource:
    id: str
    name: str
    contact: str
    kind: str  # "phone" | "web" | "emergency"
    note: str
    source: str


IN = [
    Resource("in_tele_manas", "Tele-MANAS (Government of India)", "14416 or 1-800-891-4416",
             "phone", "Free, 24x7 counselling in many Indian languages.",
             "https://telemanas.mohfw.gov.in"),
    Resource("in_kiran", "KIRAN Mental Health Helpline", "1800-599-0019", "phone",
             "Free, 24x7, run by the Ministry of Social Justice and Empowerment.",
             "https://www.drishtiias.com/daily-updates/daily-news-analysis/kiran-mental-health-rehabilitation-helpline"),
    Resource("in_emergency", "Emergency services (India)", "112", "emergency",
             "If you or someone else is in immediate danger.", "https://www.112.gov.in"),
]

US = [
    Resource("us_988", "988 Suicide & Crisis Lifeline", "Call or text 988", "phone",
             "Free, 24x7 in the United States.", "https://988lifeline.org"),
    Resource("us_emergency", "Emergency services (US)", "911", "emergency",
             "If you or someone else is in immediate danger.", "https://www.911.gov"),
]

GLOBAL = [
    Resource("global_directory", "Find a Helpline", "findahelpline.com", "web",
             "Free directory of verified crisis lines in 175+ countries.",
             "https://findahelpline.com"),
    Resource("global_local_emergency", "Your local emergency number", "Local emergency number",
             "emergency", "If you or someone else is in immediate danger, contact local emergency "
             "services.", ""),
]

_US_TIMEZONES = {
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Phoenix", "America/Anchorage", "America/Detroit", "America/Boise",
    "America/Indiana/Indianapolis", "America/Kentucky/Louisville", "Pacific/Honolulu",
}
_IN_TIMEZONES = {"Asia/Kolkata", "Asia/Calcutta"}


def resources_for_timezone(tz: str) -> list[Resource]:
    if tz in _IN_TIMEZONES:
        return [*IN, *GLOBAL]
    if tz in _US_TIMEZONES:
        return [*US, *GLOBAL]
    return list(GLOBAL)
