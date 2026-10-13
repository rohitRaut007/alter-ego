# ADR 0009: Safety boundary

Status: Accepted (classifier is a floor; resource list awaiting human review) · Date: 2026-10-13

## Context
The product is not therapy and clinical users are out of scope (PRD 4.3). It nonetheless asks people about their fears and failure modes and invites daily reflection, so some users will write distress or crisis language. The plan scheduled this for Phase 4; it was pulled forward because Phase 2 already collects such text and Phase 3 adds reflections and rituals.

## Decision
- A `safety` module screens free-text user input at every place we ask for it: interview answers, protocol revision instructions and rating comments, evening reflections, weekly ritual answers, trait check-in notes and monthly trait reflections. The mentor chat (Phase 4) will use the same call before any model sees a message.
- `screen(user, text, surface)` returns a `SafetyNotice` or `None`. The classifier is an interface; the current `KeywordClassifier` is deliberately conservative (it favours false positives) and categorises `crisis` (self-harm, suicide, harm to others) or `distress`.
- On a hit the request is **not** processed as coaching:
  - the text is not sent to a model, not stored for coaching, and not scored (a flagged rating note or comment is dropped; the numeric score still counts);
  - the API returns HTTP 200 with a `safety` object (supportive message and regional resources) instead of a coaching result;
  - the interview keeps the same question open and the user can continue with a different answer.
- Recording is content-free: a `SafetyEvent` row (user, surface, category, time), a structured log line with category and surface only, and a consent-gated `safety.boundary_triggered` analytics event with those same two properties.
- Resources are returned by region (India, US, global fallback) from the user's timezone. Numbers were verified on 2026-10-13: Tele-MANAS 14416 / 1-800-891-4416, KIRAN 1800-599-0019, India emergency 112, US 988 and 911, and the findahelpline.com directory.

## Consequences
- A keyword classifier will miss indirect or non-English language and will occasionally flag harmless text. It is a floor, not a clinical assessment. A model-based classifier can be added behind the same interface and should be evaluated against a labelled set before it replaces or supplements the rules.
- Hindi and Marathi input (Phase for i18n) needs its own patterns before those locales ship.
- The resource list must be reviewed by a qualified human and re-checked periodically; `safety/resources.py` keeps `HUMAN_REVIEWED = False` until then, and that review is a gate before real users (see ROADMAP).
- The notice is not a crisis intervention. The product does not follow up, so copy must keep pointing to real people and emergency services.
