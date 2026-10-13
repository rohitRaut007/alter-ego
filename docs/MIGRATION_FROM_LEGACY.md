# Migration from legacy

Source: GitHub `jaiashwinisatish/alter-ego-os` (public), read-only inspection on 2026-10-13. It is a **TanStack Start + TanStack Router** app (React 19, Tailwind v4, shadcn/Radix, framer-motion, three.js hero, bun) generated with Lovable, using mock data, Supabase and web-tier AI server functions. Target: `apps/web` (Vite + React Router + TanStack Query, no SSR).

**Security:** the legacy README contains a plaintext credential and the repo is public. Nothing from README, `supabase/`, `.env*` or `src/lib/supabase.ts` is copied. Rotate that credential.

## Port

| Legacy | Target | Work |
|---|---|---|
| `src/components/ui/*` (shadcn) | `apps/web/src/components/ui` | Install only components that ported pages use; drop `sidebar.tsx` if unused |
| `src/styles.css` tokens (warm-white, charcoal, bronze accent, shadows, radius) | `packages/ui-tokens` + web CSS | Convert oklch to hex source of truth; remove `.dark` variant; fonts decision |
| `src/lib/utils.ts`, `hooks/use-mobile.tsx` | web `lib`, `hooks` | Copy |
| `components/app-shell.tsx` | `apps/web/src/components/layout` | Replace TanStack `Link`/`useRouterState` with React Router; nav matches PRD seven tabs |
| `routes/index.tsx` (landing) | `features/landing` | Replace route/head meta with React Router + document title util |
| `routes/onboarding.tsx` | `features/onboarding` | Wire to `/interviews` API; chips + progress UI kept |
| `routes/protocol.tsx` | `features/protocol` | Render from validated protocol; layers become real sections with SSE reveal |
| `routes/dashboard.tsx`, `daily.tsx`, `character.tsx`, `knowledge.tsx`, `mentor.tsx`, `settings.tsx` | `features/*` | Replace `useAppState` with TanStack Query hooks |
| `routes/legacy.tsx`, `personality.tsx` | `features/legacy`, `features/personality` | Legacy is Beta (hide behind entitlement); personality: decide if it feeds the interview or is a separate step |
| `routes/auth.tsx` | `features/auth` | Rewire to Django JWT |
| `lib/mock-data.ts` | `packages/validation` types + test fixtures | Task already has `layer` |
| `lib/i18n-complete.tsx` keys | `apps/web/src/i18n/en.json` | Convert to JSON catalog; add hi/mr later |
| `assets/hero-protocol.jpg`, `public/favicon.png` | web assets | Check licence/provenance before shipping |

## Drop

| Legacy | Why |
|---|---|
| `supabase/` (functions, migrations, seed, `.temp`) | Django is the sole backend; seed has credential-like lines |
| `src/lib/supabase.ts`, `@supabase/supabase-js` | No Supabase client in apps |
| `services/mentor-ai.ts`, `knowledge-ai.ts` | Web-tier LLM calls that read `.env` from disk. Replaced by Django LLM service |
| `lovable-error-reporting.ts`, `error-capture.ts`, `error-page.ts`, `@lovable.dev/*`, `AGENTS.md` | Platform-specific; Sentry replaces |
| `router.tsx`, `routeTree.gen.ts`, `server.ts`, `start.ts`, nitro, `@tanstack/react-start` | TanStack Start specific |
| `bun.lock`, `bunfig.toml` | One lockfile rule |
| `src/lib/i18n.tsx`, `i18n.tsx.backup` | Superseded by catalogs |
| `lib/app-state.tsx` persistence | Replaced by API + Query cache; its shape informs resources |
| README | Stale scaffold text and credential |
| three.js / `@react-three/*` | ~heavy; keep the static hero first, add 3D only if measured worth |

## Behavioural gaps to close during port
- Onboarding has 13 questions (~10 min) vs PRD 15–25 min covering five input areas; the interview is dynamic via LLM, not a fixed list.
- Legacy "mentor replies" were canned or called from the web tier; real mentor needs memory and safety (Phase 4).
- Reflection fields (`compounded`, `leaked`, `tomorrow`) map to the PRD's 3 questions; keep.
- Copy audit: remove any outcome-promising text (PRD risk "overclaiming"), including the landing headline "Become the person you were meant to become" if it reads as a promise. Owner to decide.

## Process
1. Port UI in vertical slices as each phase needs it (not all at once) so unused pages don't rot.
2. Each ported page ships with loading, empty, error states.
3. Record any deliberate visual change in the PR description.
