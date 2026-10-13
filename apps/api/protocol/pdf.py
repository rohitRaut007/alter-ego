"""Formatted PDF export of a protocol document."""

from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

INK = colors.HexColor("#171310")
MUTED = colors.HexColor("#716A65")
ACCENT = colors.HexColor("#A86A2C")
RULE = colors.HexColor("#E5E2DE")


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "eyebrow": ParagraphStyle("eyebrow", parent=base["Normal"], fontSize=8, textColor=ACCENT,
                                  fontName="Helvetica-Bold", spaceAfter=4),
        "title": ParagraphStyle("title", parent=base["Title"], fontSize=26, leading=32,
                                textColor=INK, alignment=0, spaceAfter=10, fontName="Times-Roman"),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontSize=17, leading=22, textColor=INK,
                             spaceBefore=6, spaceAfter=8, fontName="Times-Roman"),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=11, leading=15, textColor=INK,
                             spaceBefore=8, spaceAfter=3, fontName="Helvetica-Bold"),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontSize=10, leading=14.5,
                               textColor=INK, spaceAfter=6),
        "muted": ParagraphStyle("muted", parent=base["BodyText"], fontSize=8.5, leading=12,
                                textColor=MUTED),
        "cell": ParagraphStyle("cell", parent=base["BodyText"], fontSize=8.5, leading=11,
                               textColor=INK),
    }


def _p(text: Any, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(str(text)), style)


def _bullets(items: list[str], st: dict[str, ParagraphStyle]) -> list[Paragraph]:
    return [Paragraph(f"&bull;&nbsp;&nbsp;{escape(i)}", st["body"]) for i in items]


def _table(rows: list[list[Any]], widths: list[float], st: dict[str, ParagraphStyle]) -> Table:
    data = [[_p(c, st["cell"]) for c in row] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F5F3EF")),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def _footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 12 * mm, "Alter Ego OS · Protocol")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def render_protocol_pdf(doc_json: dict[str, Any], display_name: str = "") -> bytes:
    st = _styles()
    width = A4[0] - 40 * mm
    out: list[Any] = []

    ident = doc_json["identity"]
    out += [
        _p("ALTER EGO OS · YOUR PROTOCOL", st["eyebrow"]),
        _p(f"{display_name}'s protocol" if display_name else "Your protocol", st["title"]),
        _p(f"“{ident['identity_statement']}”", st["h1"]),
        _p(f"{ident['alter_ego_name']} · {ident['archetype']}", st["muted"]),
        Spacer(1, 6),
        HRFlowable(width="100%", color=RULE),
        Spacer(1, 8),
        _p(doc_json["disclaimer"], st["muted"]),
        PageBreak(),
    ]

    out += [_p("Identity architecture", st["h1"]), _p(ident["thesis"], st["body"]),
            _p("Legacy definition", st["h2"]), _p(ident["legacy_definition"], st["body"]),
            _p("Why this fits you", st["h2"]), *_bullets(ident["why_this_fits"], st)]

    out += [Spacer(1, 10), _p("Character stack", st["h1"])]
    for t in doc_json["character"]["traits"]:
        out += [_p(t["name"], st["h2"]), _p(t["statement"], st["body"]),
                _p(f"Why: {t['rationale']}", st["muted"]),
                *_bullets([f"{p['description']} ({p['cadence']}, {p['minutes']} min)"
                           for p in t["practices"]], st),
                _p(f"Failure mode: {t['failure_mode']}", st["muted"])]

    out += [PageBreak(), _p("Knowledge system", st["h1"]),
            _p(doc_json["knowledge"]["sequencing_rationale"], st["body"])]
    rows = [["#", "Title", "Author", "Why now"]] + [
        [r["sequence"], r["title"], r["author"], r["why_now"]]
        for r in doc_json["knowledge"]["reading_list"]
    ]
    out += [_table(rows, [10 * mm, 45 * mm, 35 * mm, width - 90 * mm], st),
            Spacer(1, 6), _p("Destruction test", st["h2"]),
            _p(doc_json["knowledge"]["destruction_test_template"], st["body"])]

    m = doc_json["mission"]
    out += [Spacer(1, 10), _p("Mission and strategy", st["h1"]), _p(m["statement"], st["body"]),
            _p(m["strategy"], st["body"])]
    for ph in m["roadmap"]:
        out += [_p(f"{ph['name']} · {ph['horizon_weeks']} weeks", st["h2"]),
                *_bullets(ph["outcomes"], st)]
    out += [_p("Risks to design around", st["h2"]), *_bullets(m["risks"], st),
            _p("Execution system", st["h2"]), _p(m["execution_system"], st["body"])]

    d = doc_json["daily_os"]
    out += [PageBreak(), _p("Daily operating system", st["h1"])]
    rows = [["Time", "Block", "Layer", "Kind"]] + [
        [f"{b['start']}–{b['end']}", b["label"], b["layer"], b["kind"]] for b in d["schedule"]
    ]
    out += [_table(rows, [30 * mm, 70 * mm, 35 * mm, width - 135 * mm], st), Spacer(1, 6),
            _p(f"Deep work target: {d['deep_work_minutes_per_day']} minutes a day.", st["body"]),
            _p("Shutdown ritual", st["h2"]), _p(d["shutdown_ritual"], st["body"]),
            _p("Evening reflection", st["h2"]), *_bullets(d["reflection_questions"], st)]

    pr = doc_json["presence"]
    out += [Spacer(1, 10), _p("Presence", st["h1"]), *_bullets(pr["principles"], st),
            _p("Micro-practices", st["h2"]),
            *_bullets([f"{x['description']} ({x['minutes']} min)" for x in pr["micro_practices"]], st),
            _p("Wardrobe", st["h2"]), _p(pr["wardrobe_notes"], st["body"]),
            _p("Social playbook", st["h2"]), *_bullets(pr["social_playbook"], st)]

    out += [PageBreak(), _p("Legacy timeline", st["h1"])]
    labels = {"2y": "Two years", "5y": "Five years", "life": "A life"}
    for ms in doc_json["legacy"]["milestones"]:
        out += [_p(labels[ms["horizon"]], st["h2"]), _p(ms["statement"], st["body"]),
                _p("Evidence of progress", st["muted"]), *_bullets(ms["evidence_of_progress"], st),
                _p("Leading indicators", st["muted"]), *_bullets(ms["leading_indicators"], st)]

    out += [PageBreak(), _p("30-day checklist", st["h1"])]
    rows = [["Day", "Task", "Layer", "Min"]] + [
        [t["due_day"], f"{t['title']} — {t['detail']}", t["layer"], t["minutes"]]
        for t in sorted(doc_json["checklist_30"], key=lambda t: t["due_day"])
    ]
    out += [_table(rows, [14 * mm, width - 66 * mm, 36 * mm, 16 * mm], st)]

    sp = doc_json["sprint_90"]
    out += [Spacer(1, 12), _p("90-day sprint", st["h1"]), _p(sp["goal"], st["body"])]
    for w in sp["weeks"]:
        out += [_p(f"Week {w['index']} · {w['theme']}", st["h2"]),
                *_bullets([t["title"] for t in w["tasks"]], st),
                _p(f"Review: {w['review_prompt']}", st["muted"])]

    buf = BytesIO()
    SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm,
        bottomMargin=20 * mm, title="Alter Ego OS Protocol", author="Alter Ego OS",
    ).build(out, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
