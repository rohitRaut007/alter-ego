# Migration from legacy

Source: GitHub `jaiashwinisatish/alter-ego-os` (public). A **TanStack Start + TanStack Router** app (React 19, Tailwind v4, shadcn/Radix, framer-motion, three.js hero, bun) generated with Lovable, using mock data, Supabase and web-tier AI server functions. Target: `apps/web` (Vite + React Router + TanStack Query, no SSR), talking only to the Django API through the generated client.

**Security:** the legacy README contains a plaintext credential and the repo is public. Nothing from README, `supabase/`, `.env*` or `src/lib/supabase.ts` was copied. That credential must be rotated.

## Status: every legacy screen is in the web app

| Legacy route | Web route | Status | What changed |
|---|---|---|---|
| `/` landing + 3D hero | `/` | Ported | Same sections and hero scene (lazy-loaded). Mock chat labelled "Example"; fabricated stats and "generated instantly" copy removed |
| `/auth` | `/auth` | Ported | Real JWT auth, consent checkboxes, no "instant demo" bypass, no Supabase wording |
| `/onboarding` | `/onboarding` | Ported | Chat, stage header, chips, multi-select, compile state, now driven by the interview API and safety stop |
| `/personality` | `/personality` | Ported | 20-item Big Five, scoring moved server-side, results feed the mentor |
| `/dashboard` | `/dashboard` | Ported | One aggregate endpoint; real layer progress and 7-day momentum |
| `/daily` | `/daily` | Ported | Morning/deep work/evening tabs, add-your-own task, practices, timer, inline reflection, calendar panel |
| `/protocol` | `/protocol` | Ported | Seven-layer overview and dialog with highlights from the user's own protocol, plus section tabs, revise, rating, PDF |
| `/mentor` | `/mentor` | Ported | Streaming chat, history, suggested prompts, challenges that become tasks, nudges, visible memory |
| `/character` | `/character` | Ported | Traits, streak bars with 14-day history, mentor challenges, day 0/14/30 check-ins and monthly reflection |
| `/knowledge` | `/knowledge` | Ported | Reading list, advisor, notes, collision notebook, weekly recommendation, roadmap, stats, destruction test |
| `/legacy` | `/legacy` | Ported | Milestones per horizon, add/complete, quarterly review (Full plan) |
| `/settings` | `/settings` | Ported | Profile and identity, personality, language, privacy toggles, export, reset, calendar, sign out |
| root error/404 | error boundary, 404 page | Ported | |
| `i18n-complete` | `lib/i18n.tsx` | Ported | The legacy dictionaries (en, es, hi, de, fr, zh, ja, pt, ko) and the language selector. Entries that made false claims (Supabase, demo bypass, mock stats) were removed so English shows instead |
| shadcn components | `components/ui/*` | Ported (the 12 used) | Unused components were not carried over |

Added beyond the legacy app: Plan page (30-day checklist and 90-day sprint), evening reflection and weekly ritual pages, safety notices on every free-text input.

## Deliberately not carried over

| Legacy | Why |
|---|---|
| `supabase/` (functions, migrations, seed, `.temp`) and `lib/supabase.ts` | Django is the sole backend. Behaviour was reimplemented and tested there |
| `services/mentor-ai.ts`, `knowledge-ai.ts` | Web-tier LLM calls that read `.env` from disk. Replaced by the Django LLM service |
| Instant demo access (skip auth) | Cannot exist with server-side data |
| `lovable-error-reporting`, `error-capture`, `@lovable.dev/*`, `AGENTS.md` | Platform specific |
| `router.tsx`, `routeTree.gen.ts`, `server.ts`, `start.ts`, nitro, `@tanstack/react-start` | TanStack Start specific |
| `bun.lock`, `bunfig.toml` | One-lockfile rule |
| `lib/app-state.tsx` persistence and `lib/mock-data.ts` seeds | Replaced by the API; shapes informed the resources |
| README | Stale scaffold text and the credential |

## Honest differences from the legacy behaviour
- **Calendar** is in demo mode: events are kept inside the app, and the UI says so. Real Google sync needs OAuth credentials (ROADMAP Phase 7). The legacy screen faked a connection.
- **Mentor and advisor** use the fake provider until a model id and persona are configured; replies are templated from real data.
- **Legacy and Calendar** require the Full plan. Locally, `ALPHA_GRANT_FULL=true` grants it.
- **Hero** keeps the three.js scene, code-split so it does not load with the app shell (it is about 950 kB, loaded only on the landing page).
