"""Deterministic Phase 4+ task outputs for FakeLLM.

Every function only uses numbers and words that are present in its input payload, so the
replies are grounded the way a real model's should be, without making any model call.
"""

import re
from typing import Any


def mentor_reply_text(p: dict[str, Any]) -> str:
    msg = str(p.get("message", "")).lower()
    prog = p.get("progress", {}) or {}
    user = p.get("user", {}) or {}
    focus = prog.get("focus_titles", []) or []
    wk = prog.get("week", {}) or {}
    tone = prog.get("tone", "balanced")
    facts = p.get("facts", []) or []
    lines: list[str] = []

    if any(k in msg for k in ("first", "today", "start")):
        if focus and prog.get("focus_is_upcoming"):
            lines.append(f"Nothing is due yet. The first thing on your plan is “{focus[0]}”; "
                         "get a head start on it.")
        elif focus:
            lines.append(f"Start with “{focus[0]}”. It is your highest priority that is still open.")
        else:
            lines.append("Nothing is overdue. Use the morning block for the week's main deliverable.")
    elif any(k in msg for k in ("drift", "identity", "who am i")):
        stmt = user.get("identity_statement")
        if stmt:
            lines.append(
                f"Your own statement is: “{stmt}”. Pick one block from yesterday that "
                "contradicts it and say what you would do differently."
            )
        else:
            lines.append("Tell me which block yesterday felt least like the person you are building.")
    elif any(k in msg for k in ("read", "book", "knowledge")):
        r = prog.get("reading", {}) or {}
        if r.get("current_title"):
            lines.append(
                f"Finish “{r['current_title']}” before opening anything new; it is "
                f"{r.get('current_progress', 0)}% read."
            )
        else:
            lines.append("Open the Knowledge page for your sequenced list; the first unread title is the one.")
    elif any(k in msg for k in ("challenge", "hard")):
        lines.append(
            "Accept one of this week's challenges on the right. Pick the one on the layer "
            "that is slipping, not the one that is comfortable."
        )
    elif any(k in msg for k in ("sprint", "recalibrate", "plan")):
        lines.append(
            "Recalibrating means cutting, not adding. Name the one outcome that must be true "
            "by Sunday and drop the week's tasks that do not serve it."
        )
    else:
        lines.append("Here is where you stand, specifically.")

    if wk.get("total"):
        tail = f", {wk.get('overdue')} overdue." if wk.get("overdue") else "."
        lines.append(f"This is week {wk.get('week')}: {wk.get('done')} of {wk.get('total')} tasks done{tail}")
    if prog.get("insight"):
        lines.append(str(prog["insight"]))
    if facts:
        lines.append(f"You told me earlier: “{facts[0].get('text')}”. Keep that in view.")
    if tone == "steady":
        lines.append("Shrink today's plan to one finished thing. Momentum returns from completion, not volume.")
    elif tone == "push":
        lines.append("You have momentum. Spend your sharpest hour on the hardest item before you open any inputs.")
    lines.append("That is my read and you can overrule it. What is actually in the way?")
    return "\n\n".join(lines)


_FACT_PATTERNS = [
    (r"\b(i will|i'm going to|i am going to|i commit to|i plan to)\b[^.!?]*", "commitment"),
    (r"\b(i'm afraid|i am afraid|i fear|i'm worried|i keep (?:failing|avoiding|quitting))\b[^.!?]*", "fear"),
    (r"\b(my goal is|i want to|i'm trying to|i am trying to)\b[^.!?]*", "goal"),
    (r"\b(i can only|i only have|i don't have|i do not have)\b[^.!?]*", "constraint"),
    (r"\b(i work best|i prefer|i learn best)\b[^.!?]*", "preference"),
]


def extract_facts(p: dict[str, Any]) -> dict[str, Any]:
    text = str(p.get("message", ""))
    known = " ".join(p.get("known_facts", [])).lower()
    out: list[dict[str, Any]] = []
    for pattern, kind in _FACT_PATTERNS:
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            sentence = " ".join(m.group(0).split()).strip(" ,;")
            if sentence.lower() in known or len(out) >= 3:
                continue
            out.append({"kind": kind, "text": "User states: " + sentence[:160], "confidence": 0.7})
    return {"facts": out}


def summarise(p: dict[str, Any]) -> dict[str, Any]:
    msgs = p.get("messages", [])
    user_bits = [m["content"] for m in msgs if m.get("role") == "user"][:3]
    mentor_bits = [m["content"] for m in msgs if m.get("role") == "mentor"][-1:]
    parts: list[str] = []
    if p.get("previous_summary"):
        parts.append(str(p["previous_summary"]))
    if user_bits:
        parts.append("They raised: " + " / ".join(" ".join(b.split())[:90] for b in user_bits) + ".")
    if mentor_bits:
        parts.append("The mentor advised: " + " ".join(mentor_bits[0].split())[:140] + ".")
    return {"summary": " ".join(parts) or "No substantive discussion yet."}


def nudge(p: dict[str, Any]) -> dict[str, Any]:
    kind, s = p.get("kind"), p.get("stats", {}) or {}
    name = p.get("display_name") or "there"
    if kind == "reengagement":
        body = (
            f"{name}, it has been {s.get('days_quiet', 3)} days since your last logged work. "
            "Do one small thing today: your top priority for ten minutes. Starting is the whole job."
        )
    elif kind == "ritual":
        body = (
            "The weekly ritual is open. Five minutes: what shipped, what slipped, and next week's "
            "single outcome."
        )
    elif kind == "checkin":
        body = (
            f"Day {s.get('day')} of 90. {s.get('done', 0)} of {s.get('total', 0)} sprint tasks are done. "
            "Take ten minutes to decide what to keep, change or drop for the remaining weeks."
        )
    else:
        body = f"{s.get('streak')}-day practice streak. Protect it today before anything else."
    return {"body": body}


def challenges(p: dict[str, Any]) -> dict[str, Any]:
    weak = p.get("weak_layers", []) or []
    layer = weak[0]["layer"] if weak else "mission"
    second = weak[1]["layer"] if len(weak) > 1 else "daily_os"
    cap = int(p.get("capacity_minutes") or 60)
    traits = p.get("traits", []) or []
    pattern = traits[0]["failure_mode"] if traits else "Starting new work to avoid finishing old work."
    items = [
        {
            "title": f"Clear your {layer.replace('_', ' ')} backlog by Friday",
            "detail": f"You have overdue work here. Finish the oldest item first. Pattern to watch: {pattern}",
            "layer": layer,
            "difficulty": "Medium",
        },
        {
            "title": f"One uninterrupted {min(cap, 90)}-minute block, no switching",
            "detail": "Phone away, one outcome written down first. Do it once this week.",
            "layer": second,
            "difficulty": "Light",
        },
        {
            "title": "Ship one imperfect thing",
            "detail": "Publish or send something you have been polishing.",
            "layer": "mission",
            "difficulty": "Hard",
        },
    ]
    return {"challenges": items[: 3 if p.get("tone") == "push" else 2]}


def advisor(p: dict[str, Any]) -> dict[str, Any]:
    q = str(p.get("query", "")).lower()
    words = set(re.findall(r"[a-z]{4,}", q))
    cands = p.get("candidates", []) or []

    def overlap(c: dict[str, Any]) -> int:
        text = f"{c['title']} {c['summary']} {' '.join(c['tags'])}".lower()
        return len(words & set(re.findall(r"[a-z]{4,}", text)))

    picks = sorted(cands, key=lambda c: -overlap(c))[:2]
    reading = p.get("reading", []) or []
    current = [r for r in reading if r.get("status") == "reading"]
    lines: list[str] = []
    if any(k in q for k in ("note", "summar", "pattern")):
        notes = p.get("notes", []) or []
        if notes:
            lines.append("From your notes: " + "; ".join(f"“{n['title']}”" for n in notes[:4]) + ".")
            lines.append("The common thread is what you keep returning to; name it in one sentence.")
        else:
            lines.append("You have no notes yet. Capture one idea per reading session and I can find patterns.")
    elif any(k in q for k in ("connection", "collision", "connect")):
        if len(reading) >= 2:
            lines.append(
                f"Try colliding “{reading[0]['title']}” with “{reading[1]['title']}”: "
                "where do they disagree about the same problem?"
            )
        else:
            lines.append("You need two titles in progress to find a collision. Start a second one.")
    else:
        if current:
            lines.append(f"Finish “{current[0]['title']}” first ({current[0]['progress']}% read).")
        if picks:
            lines.append(
                "Next, from the curated set: "
                + "; ".join(f"“{c['title']}” by {c['author']}: {c['summary']}" for c in picks)
                + "."
            )
        goal = p.get("goal")
        if goal:
            lines.append(f"I chose these against your goal: “{goal[:90]}”.")
    lines.append("These are options. Skip any that do not fit where you are.")
    return {"answer": "\n\n".join(lines), "source_ids": [c["id"] for c in picks]}


JSON_TASKS = {
    "memory_extract": extract_facts,
    "thread_summary": summarise,
    "proactive_nudge": nudge,
    "weekly_challenges": challenges,
    "knowledge_advisor": advisor,
}
