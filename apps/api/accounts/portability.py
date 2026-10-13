"""Data export and protocol reset (PRD 8.4: user owns their data)."""

from datetime import datetime
from typing import Any

from django.db import transaction

from core import clock


def _iso(v: Any) -> Any:
    return v.isoformat() if isinstance(v, datetime) or hasattr(v, "isoformat") else v


def export_user_data(user) -> dict[str, Any]:
    """Everything we hold for the user, decrypted, as plain JSON-serialisable data."""
    from calendars.models import CalendarEvent, CalendarLink
    from character.models import PracticeLog, Trait, TraitRating, TraitReflection
    from daily_os.models import DailyReflection, DeepWorkSession, Task, WeeklyRitual
    from knowledge.models import KnowledgeNote, ReadingItem
    from legacy.models import LegacyMilestone, QuarterlyReview
    from mentor.models import (
        MemoryFact, MentorChallenge, MentorMessage, MentorNudge, MentorThread,
    )
    from protocol.models import Interview, Protocol, ProtocolStatus
    from protocol.services import assemble_document

    protocols = []
    for p in Protocol.objects.filter(user=user):
        doc = assemble_document(p) if p.status == ProtocolStatus.READY else None
        protocols.append({
            "id": str(p.id), "status": p.status, "created_at": _iso(p.created_at),
            "schema_version": p.schema_version, "accuracy_rating": p.accuracy_rating,
            "rating_comment": p.rating_comment, "document": doc,
        })
    interviews = [
        {"id": str(i.id), "status": i.status, "started_at": _iso(i.started_at),
         "answers": [{"stage": t.stage, "question": t.question, "answer": t.answer}
                     for t in i.turns.all() if t.answer]}
        for i in Interview.objects.filter(user=user)
    ]
    try:
        personality = {"scores": user.personality.scores, "answers": user.personality.answers,
                       "completed_at": _iso(user.personality.completed_at)}
    except Exception:  # noqa: BLE001
        personality = None
    link = CalendarLink.objects.filter(user=user).first()

    return {
        "exported_at": clock.now().isoformat(),
        "account": {
            "email": user.email, "display_name": user.display_name, "timezone": user.timezone,
            "locale": user.locale, "created_at": _iso(user.created_at),
            "ai_training_opt_out": user.ai_training_opt_out,
            "mentor_nudges": user.mentor_nudges, "weekly_digest": user.weekly_digest,
        },
        "consents": [{"purpose": c.purpose, "version": c.version, "granted": c.granted,
                      "at": _iso(c.created_at)} for c in user.consents.all()],
        "interviews": interviews,
        "protocols": protocols,
        "tasks": [{"title": t.title, "detail": t.detail, "layer": t.layer, "source": t.source,
                   "due_date": _iso(t.due_date), "done_at": _iso(t.done_at)}
                  for t in Task.objects.filter(user=user)],
        "traits": [{"name": t.name, "statement": t.statement, "rationale": t.rationale,
                    "ratings": [{"day": r.day_offset, "score": r.score, "note": r.note}
                                for r in TraitRating.objects.filter(trait=t)],
                    "reflections": [{"month": r.month, "text": r.text}
                                    for r in TraitReflection.objects.filter(trait=t)]}
                   for t in Trait.objects.filter(user=user)],
        "practice_logs": [{"date": _iso(lg.date), "done": lg.done, "practice_id": str(lg.practice_id)}
                          for lg in PracticeLog.objects.filter(user=user)],
        "reflections": [{"date": _iso(r.date), "answers": r.answers, "rating": r.rating}
                        for r in DailyReflection.objects.filter(user=user)],
        "weekly_rituals": [{"week_start": _iso(r.week_start), "answers": r.answers}
                           for r in WeeklyRitual.objects.filter(user=user)],
        "deep_work_sessions": [{"started_at": _iso(s.started_at), "ended_at": _iso(s.ended_at),
                                "minutes": s.actual_minutes, "abandoned": s.abandoned}
                               for s in DeepWorkSession.objects.filter(user=user)],
        "mentor": {
            "threads": [{"title": th.title, "created_at": _iso(th.created_at),
                         "messages": [{"role": m.role, "body": m.body, "at": _iso(m.created_at)}
                                      for m in MentorMessage.objects.filter(thread=th)]}
                        for th in MentorThread.objects.filter(user=user)],
            "memory": [{"kind": f.kind, "text": f.text} for f in MemoryFact.objects.filter(user=user)],
            "nudges": [{"kind": n.kind, "body": n.body} for n in MentorNudge.objects.filter(user=user)],
            "challenges": [{"title": c.title, "detail": c.detail, "status": c.status}
                           for c in MentorChallenge.objects.filter(user=user)],
        },
        "knowledge": {
            "reading": [{"title": i.title, "author": i.author, "status": i.status,
                         "progress": i.progress} for i in ReadingItem.objects.filter(user=user)],
            "notes": [{"kind": n.kind, "title": n.title, "source": n.source, "body": n.body,
                       "tags": n.tags} for n in KnowledgeNote.objects.filter(user=user)],
        },
        "legacy": {
            "milestones": [{"horizon": m.horizon, "title": m.title, "detail": m.detail,
                            "progress": m.progress, "done": m.done_at is not None}
                           for m in LegacyMilestone.objects.filter(user=user)],
            "reviews": [{"scheduled_for": _iso(r.scheduled_for), "completed": r.completed_at is not None,
                         "answers": r.answers} for r in QuarterlyReview.objects.filter(user=user)],
        },
        "personality": personality,
        "calendar": {
            "link": {"account_email": link.account_email, "mode": link.mode} if link else None,
            "events": [{"title": e.title, "start": _iso(e.start), "end": _iso(e.end)}
                       for e in CalendarEvent.objects.filter(user=user)],
        },
    }


@transaction.atomic
def reset_protocol(user) -> dict[str, int]:
    """Delete the protocol and everything derived from it so the user can start again.

    Keeps the account, consents, reflections, rituals, mentor history, memory and notes.
    """
    from mentor.models import MentorChallenge, MentorNudge
    from protocol.models import Interview, Protocol

    counts = {"protocols": Protocol.objects.filter(user=user).count(),
              "interviews": Interview.objects.filter(user=user).count()}
    MentorChallenge.objects.filter(user=user).delete()
    MentorNudge.objects.filter(user=user).delete()
    Protocol.objects.filter(user=user).delete()  # cascades sprint, tasks, traits, items, milestones
    Interview.objects.filter(user=user).delete()
    return counts
