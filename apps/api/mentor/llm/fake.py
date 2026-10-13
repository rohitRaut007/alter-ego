"""Deterministic stand-in for a model provider. Used in tests, local dev and CI.

Content is templated from the user's own answers so personalisation is visible, but it is
not real model output. Real prompts live in mentor/prompts and are exercised in later phases.
"""

import json
import re
import time
from collections.abc import Iterator
from typing import Any

from .base import LLMOutputError, LLMResult
from .fake_tasks import JSON_TASKS, mentor_reply_text

MODEL_NAME = "fake-llm-1"

# (stage, question, suggestions, multi_select, placeholder)
INTERVIEW_SCRIPT: list[tuple[str, str, list[str], bool, str]] = [
    ("Ambition", "Tell me what you are trying to become.",
     ["A founder who ships", "A respected operator", "A researcher with real impact"], False,
     "Say it plainly, the way you would to someone you trust."),
    ("Ambition", "What domain are you building in, and what is the specific work?",
     ["B2B software", "Consumer product", "Deep tech", "Services"], False,
     "Name the domain and the thing you are actually making."),
    ("Current position", "What do you have today: skills, resources, relationships, constraints?",
     ["Strong technical skills", "Limited runway", "Small network", "Full-time job"], True,
     "Add anything that matters."),
    ("Personality", "How do you work best, and how do you tend to lose focus?",
     ["Deep morning blocks", "Short sprints", "Reading first", "Building first"], True,
     "Describe a good day and a bad day."),
    ("Failure modes", "Where do you reliably fail yourself? Be specific.",
     ["I start and don't finish", "I over-plan", "I avoid hard conversations", "I lose consistency"],
     False, "Give a real recent example."),
    ("Fears", "What are you most afraid will still be true in five years if nothing changes?",
     ["Wasted potential", "Being average", "Missing the window"], False,
     "Be as honest as you can."),
    ("Target outcome", "What does success look like in two years? Be concrete.",
     ["A funded company", "Profitable business", "Recognised expertise"], False,
     "Numbers, names, outcomes you could verify."),
    ("Timeline", "What can you commit each day, and by when do you want to see change?",
     ["1 hour a day", "2 hours a day", "Weekends only", "90 days"], False,
     "Be realistic about your actual week."),
]

ACKNOWLEDGEMENTS = [
    "Understood.",
    "That gives me something specific to work with.",
    "Noted, including the constraints.",
    "That pattern matters for how this gets scheduled.",
    "Thank you for being direct about that.",
    "That is worth designing around.",
    "Clear enough to measure against.",
    "Good. That is enough to build from.",
]


def _snip(text: str, n: int = 110) -> str:
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def _a(answers: list[dict[str, Any]], i: int) -> str:
    return _snip(answers[i]["answer"]) if i < len(answers) else "not stated"


def _task(id_: str, title: str, detail: str, layer: str, day: int, minutes: int,
          priority: bool = False, trait: str | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"id": id_, "title": title, "detail": detail, "layer": layer,
                           "due_day": day, "minutes": minutes, "priority": priority}
    if trait:
        out["trait_id"] = trait
    return out


def _identity(a: list, name: str) -> dict[str, Any]:
    return {
        "archetype": "The Deliberate Builder",
        "thesis": f"Turns a stated ambition into repeatable daily work. Starting point: “{_a(a, 0)}”.",
        "alter_ego_name": "The Operator",
        "identity_statement": f"I do the work in front of me, review it honestly, and adjust.",
        "legacy_definition": _a(a, 6),
        "why_this_fits": [
            f"You named this failure pattern: “{_a(a, 4)}”.",
            f"You described your working style as: “{_a(a, 3)}”.",
        ],
    }


def _character(a: list, name: str) -> dict[str, Any]:
    def trait(id_, nm, stmt, why, practice, fm, prompt):
        return {
            "id": id_, "name": nm, "statement": stmt, "rationale": why,
            "practices": [{"id": f"{id_}_p1", "description": practice, "cadence": "daily",
                           "minutes": 10}],
            "failure_mode": fm, "monthly_reflection_prompt": prompt,
        }

    return {"traits": [
        trait("follow_through", "Follow-through", "I finish what I commit to this week.",
              f"You said: “{_a(a, 4)}”. This trait targets that directly.",
              "Write tomorrow's single must-finish task before you stop work.",
              "Starting new work to avoid finishing old work.",
              "Where did I stop early this month, and what was I avoiding?"),
        trait("honest_review", "Honest review", "I look at what happened, not what I intended.",
              "A system only improves if the review is accurate.",
              "Answer the three evening reflection questions in under five minutes.",
              "Reviewing only the wins.", "Which review did I skip, and why?"),
        trait("deep_focus", "Deep focus", "I protect uninterrupted time for the hard work.",
              f"Your capacity: “{_a(a, 7)}”. Focus time is the scarce resource.",
              "One timed deep work block with notifications off.",
              "Switching context at the first friction.", "What interrupted my best blocks?"),
        trait("steady_courage", "Steady courage", "I take the uncomfortable step on schedule.",
              f"You named this fear: “{_a(a, 5)}”.",
              "Do one thing today that you have been postponing.",
              "Waiting until I feel ready.", "What did I avoid that mattered?"),
    ]}


def _knowledge(a: list, name: str) -> dict[str, Any]:
    books = [
        ("Deep Work", "Cal Newport", "Protects the focus block your plan depends on.", 8),
        ("The War of Art", "Steven Pressfield", "Addresses starting and not finishing.", 5),
        ("Atomic Habits", "James Clear", "Turns the practices into a repeatable system.", 7),
        ("The Mom Test", "Rob Fitzpatrick", "Sharpens how you learn from real users.", 4),
        ("Thinking, Fast and Slow", "Daniel Kahneman", "Improves judgement under uncertainty.", 14),
        ("Man's Search for Meaning", "Viktor Frankl", "Anchors the long-horizon reason for the work.", 5),
    ]
    return {
        "reading_list": [
            {"id": f"r{i + 1}", "title": t, "author": au, "why_now": why, "sequence": i + 1,
             "estimated_hours": h}
            for i, (t, au, why, h) in enumerate(books)
        ],
        "sequencing_rationale": "Execution habits first, then judgement, then long-horizon meaning.",
        "destruction_test_template": (
            "State the strongest argument against this book's main claim, then test it against "
            "your own situation. Keep what survives."
        ),
        "weekly_focus_domains": [_a(a, 1)],
    }


def _mission(a: list, name: str) -> dict[str, Any]:
    return {
        "statement": f"Build in this domain: {_a(a, 1)}.",
        "strategy": "Ship small, learn from real use, and review weekly against the 90-day sprint.",
        "roadmap": [
            {"name": "Foundation", "horizon_weeks": 4,
             "outcomes": ["A clear weekly cadence", "One shipped artifact"]},
            {"name": "Traction", "horizon_weeks": 8,
             "outcomes": ["Repeatable output each week", "First external feedback"]},
            {"name": "Compounding", "horizon_weeks": 12,
             "outcomes": ["A measurable result against the two-year outcome"]},
        ],
        "risks": [f"Pattern to watch: {_a(a, 4)}", "Overcommitting beyond stated capacity."],
        "execution_system": "Daily plan, weekly output ritual, monthly review of the whole system.",
    }


def _daily_os(a: list, name: str) -> dict[str, Any]:
    blocks = [
        ("06:00", "06:30", "Plan the day", "daily_os", "admin"),
        ("06:30", "08:30", "Deep work", "mission", "deep_work"),
        ("12:30", "13:00", "Reading", "knowledge", "learning"),
        ("17:30", "18:00", "Character practice", "character", "practice"),
        ("21:00", "21:15", "Evening reflection", "daily_os", "recovery"),
    ]
    return {
        "schedule": [{"start": s, "end": e, "label": lb, "layer": ly, "kind": k}
                     for s, e, lb, ly, k in blocks],
        "deep_work_minutes_per_day": 120,
        "shutdown_ritual": "Write tomorrow's first action and close the laptop.",
        "reflection_questions": ["What compounded today?", "What leaked?",
                                 "What is tomorrow's first action?"],
    }


def _presence(a: list, name: str) -> dict[str, Any]:
    return {
        "principles": ["Be clear before being impressive.", "Speak slower than feels natural."],
        "micro_practices": [{"id": "m1", "description": "Say your one-sentence aim aloud, once.",
                             "minutes": 5}],
        "wardrobe_notes": "Choose a small set that fits well and needs no thought.",
        "social_playbook": ["Enter with a question.", "Disagree with the idea, not the person."],
    }


def _legacy(a: list, name: str) -> dict[str, Any]:
    return {"milestones": [
        {"horizon": "2y", "statement": _a(a, 6),
         "evidence_of_progress": ["A verifiable result you can point to"],
         "leading_indicators": ["Weekly output completed"]},
        {"horizon": "5y", "statement": "The work sustains itself and compounds.",
         "evidence_of_progress": ["Others rely on what you built"],
         "leading_indicators": ["Quarterly review on track"]},
        {"horizon": "life", "statement": _a(a, 0),
         "evidence_of_progress": ["The standard you hold yourself to is visible in your work"],
         "leading_indicators": ["Habits hold without reminders"]},
    ]}


def _checklist(a: list, name: str) -> dict[str, Any]:
    spec = [
        ("c1", "Define this week's single outcome", "Write one sentence.", "mission", 1, 15, True, None),
        ("c2", "Block tomorrow's deep work", "Put it in your calendar.", "daily_os", 1, 10, False, None),
        ("c3", "Start the first reading", "Read for 25 minutes.", "knowledge", 2, 25, False, None),
        ("c4", "First follow-through practice", "Name the must-finish task.", "character", 3, 10, False, "follow_through"),
        ("c5", "Run a full day on the schedule", "Review what slipped.", "daily_os", 5, 30, False, None),
        ("c6", "Weekly output review", "What shipped, what did not.", "mission", 7, 30, True, None),
        ("c7", "Complete one postponed task", "Pick the one you avoided.", "character", 9, 30, False, "steady_courage"),
        ("c8", "Destruction test on the first book", "Use the template.", "knowledge", 12, 30, False, None),
        ("c9", "Mid-point review", "Adjust the plan to reality.", "mission", 15, 45, True, None),
        ("c10", "Presence micro-practice", "Say your aim aloud.", "presence", 18, 5, False, None),
        ("c11", "Two-year milestone check", "Is the plan pointed at it?", "legacy", 24, 30, False, None),
        ("c12", "30-day review", "What to keep, change, drop.", "mission", 30, 60, True, None),
    ]
    return {"tasks": [_task(*s[:7], trait=s[7]) for s in spec]}


def _sprint(a: list, name: str) -> dict[str, Any]:
    themes = ["Set the cadence", "Protect focus", "First shipment", "Review and adjust"] * 3
    weeks = []
    for w in range(1, 13):
        weeks.append({
            "index": w, "theme": themes[w - 1],
            "tasks": [
                _task(f"s{w}_1", f"Week {w}: main deliverable", "The one outcome for the week.",
                      "mission", min(90, (w - 1) * 7 + 3), 120, True),
                _task(f"s{w}_2", f"Week {w}: reading", "Continue the list.", "knowledge",
                      min(90, (w - 1) * 7 + 5), 45),
                _task(f"s{w}_3", f"Week {w}: practice", "Keep the character practice.", "character",
                      min(90, (w - 1) * 7 + 6), 30),
            ],
            "review_prompt": "What did I do that I would repeat, and what would I change?",
        })
    return {"goal": f"Move measurably toward: {_a(a, 6)}", "weeks": weeks}


SECTION_BUILDERS = {
    "identity": _identity, "character": _character, "knowledge": _knowledge, "mission": _mission,
    "daily_os": _daily_os, "presence": _presence, "legacy": _legacy,
    "checklist_30": _checklist, "sprint_90": _sprint,
}


def _tokens(obj: Any) -> int:
    return max(1, len(json.dumps(obj, default=str)) // 4)


class FakeLLM:
    model_name = MODEL_NAME

    def __init__(self, delay_ms: int = 0) -> None:
        self.delay_ms = delay_ms

    def complete_json(self, *, task: str, prompt_version: str, system: str,
                      payload: dict[str, Any], max_output_tokens: int) -> LLMResult:
        if self.delay_ms:
            time.sleep(self.delay_ms / 1000)
        if task == "interview_turn":
            data = self._interview_turn(payload)
        elif task == "protocol_section":
            data = self._section(payload)
        elif task == "protocol_section_revise":
            data = self._revise(payload)
        elif task in JSON_TASKS:
            data = JSON_TASKS[task](payload)
        else:
            raise LLMOutputError(f"FakeLLM does not implement task {task!r}")
        return LLMResult(data=data, model=MODEL_NAME,
                         input_tokens=_tokens(system) + _tokens(payload),
                         output_tokens=_tokens(data))

    def stream_text(self, *, task: str, prompt_version: str, system: str,
                    payload: dict[str, Any], max_output_tokens: int) -> Iterator[str]:
        if task != "mentor_reply":
            raise LLMOutputError(f"FakeLLM cannot stream task {task!r}")
        words = re.findall(r"\S+\s*", mentor_reply_text(payload))
        for i in range(0, len(words), 3):
            if self.delay_ms:
                time.sleep(min(self.delay_ms, 40) / 1000)
            yield "".join(words[i : i + 3])

    def _interview_turn(self, payload: dict[str, Any]) -> dict[str, Any]:
        answers = payload["answers"]
        n = len(answers)
        total = len(INTERVIEW_SCRIPT)
        ack = ACKNOWLEDGEMENTS[min(n - 1, len(ACKNOWLEDGEMENTS) - 1)] if n else ""
        if n >= total:
            return {"question": "That is enough to build your protocol.", "stage": "Complete",
                    "suggestions": [], "multi_select": False, "placeholder": "",
                    "acknowledgement": ack, "progress": 1.0, "done": True}
        stage, question, suggestions, multi, placeholder = INTERVIEW_SCRIPT[n]
        return {"question": question, "stage": stage, "suggestions": suggestions,
                "multi_select": multi, "placeholder": placeholder, "acknowledgement": ack,
                "progress": round(n / total, 2), "done": False}

    def _section(self, payload: dict[str, Any]) -> dict[str, Any]:
        key = payload["section"]
        builder = SECTION_BUILDERS.get(key)
        if builder is None:
            raise LLMOutputError(f"Unknown section {key!r}")
        return builder(payload["answers"], payload.get("display_name", ""))

    def _revise(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Applies the instruction in the simplest visible way: a note on the first text field."""
        current = json.loads(json.dumps(payload["current"]))
        note = _snip(payload["instruction"], 140)
        for field in ("thesis", "statement", "strategy", "sequencing_rationale", "shutdown_ritual",
                      "goal", "wardrobe_notes"):
            if isinstance(current.get(field), str):
                current[field] = f"{current[field]} Revised per your note: {note}"
                return current
        for k, v in current.items():
            if isinstance(v, str):
                current[k] = f"{v} Revised per your note: {note}"
                return current
        return current
