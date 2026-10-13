# PRD gaps and reconciliations

Source: `docs/PRD.md` (v1.0 Draft, June 2026). Date of analysis: 13 Oct 2026.
Status column: **Decided** = user answered; **Default** = my recommendation, applied unless you object.

| # | Gap | PRD refs | Recommendation | Status |
|---|---|---|---|---|
| 1 | Launch target Q1 2027 vs Q2 2027 | §1 vs §12 | Public launch **Q2 2027**. Q1 2027 is the closed beta. | Decided |
| 2 | iOS is "Phase 1" vs Beta Jan–Mar 2027. Android "Phase 2" vs 2028 | §8.2 vs §12 | **No platform-specific staging.** One Expo (React Native) codebase builds iOS and Android together; mobile arrives as a single Phase 6 release. Store timing is a release decision. | Decided |
| 3 | Presence and Legacy labelled "Phase 1" vs Beta | §6.5, §6.6 vs §12 | Follow roadmap: both in Beta. | Default |
| 4 | Calendar integration is P1 but listed in Alpha | §6.7 vs §12 | Google Calendar (server OAuth) late Alpha only if Phases 1–3 land early; otherwise Beta. Device calendars (Apple Calendar on iOS, Android calendar) via `expo-calendar` on-device with the mobile release. | Default |
| 5 | Knowledge is P0 but Alpha is 11 weeks | §6.4 vs §12 | Alpha ships a minimal Knowledge slice (reading list + notes). Destruction tests, collision notebook, weekly recommendation, retrieval arrive Phase 5. | Default |
| 6 | Team section says Node.js | §13 | Keep **Django**. PRD §13 should be edited to say Python/Django. | Decided |
| 7 | Phase 0 (Jul–Sep 2026) is past; no prototype exists | §12 | Phase 0 is folded into Phase 2 (interview + protocol). The 20-user internal accuracy test becomes the first slice of the review queue. See ROADMAP.md feasibility verdict. | Default |
| 8 | Team size | §13 lists 5+ roles | **Solo.** The PRD team is not available; scope is cut accordingly. | Decided |
| 9 | Target age 22–40 vs 24–38 | §1 vs §4.1 | Use 24–38 primary, 30–45 secondary (§4). | Default |
| 10 | Mentor on mobile unspecified | §8.2 lists protocol, Daily OS, reminders only | Include mentor chat on mobile (your brief). | Decided |
| 11 | Presence needs video and AI feedback on recordings with no budget or privacy model | §6.5, §14 | Beta text-only first. Recorded self-assessment needs a separate consent and storage design; defer. | Default |
| 12 | Day-14 mentor example needs per-layer task stats | §7.2 | Every task carries a `layer` field from day one (legacy mock data already does). | Default |
| 13 | "Real-time protocol generation during or immediately after the interview" | §6.1 | Async Celery job streamed over SSE so sections reveal one by one (§7.1 step 3). | Default |
| 14 | "Measurable change in one trait within 30 days" (north star) has no measurement method | §10.1 | Per-trait self-rating at day 0, 14, 30 plus practice completion; event taxonomy in ARCHITECTURE.md. Needs your sign-off on the instrument. | Default |
| 15 | NPS target >65 and D30 >40% for a premium self-improvement product | §10.2 | Keep as targets; ROADMAP gates Alpha on leading indicators (onboarding completion, accuracy) only. | Default |
| 16 | No safety or crisis handling despite out-of-scope clinical users | §4.3 | Boundary detection and redirect built in Phase 3 (ADR 0009). Resources verified 2026-10-13; still needs a qualified human review and a stronger classifier before real users. | Decided |

## PRD §14 open questions: what blocks the build

| Question | Blocks build? | Blocks what | Needed by |
|---|---|---|---|
| Pricing India vs global | **Billing only.** Entitlements are modelled now without prices. | Payments, store-billing decision (Apple IAP, Google Play Billing) | Before Beta |
| Mentor persona and name | **Yes, for the mentor.** Persona text is a versioned prompt. | Mentor system prompt, onboarding copy | Phase 4 (earlier is better for Phase 2 voice) |
| Video budget | No | Presence media | Beta |
| Cohort size and cadence | No | Cohort data model | Phase 8 |
| Public protocol sharing | No, but affects privacy model | Sharing flag, public pages | Before Beta; default is private only |

## Open questions for you (one at a time)
1. **Rotate** the credential exposed in the legacy repo README (public repo). Nothing was copied.
2. Gap 3 default (Presence and Legacy follow the roadmap's Beta) still stands unless you change it.
