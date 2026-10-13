# ADR 0001: Monorepo tooling

Status: Accepted · Date: 2026-10-13

## Context
Web, mobile, an API, and shared contracts must evolve together by one developer. Scrap-it- already runs pnpm + Turborepo successfully, including an Expo app on Windows.

## Decision
- pnpm workspaces (`apps/*`, `packages/*`) with Turborepo for task orchestration and caching. `packageManager` is pinned.
- One lockfile, `pnpm-lock.yaml`. CI fails if `package-lock.json`, `yarn.lock` or `bun.lock` appears.
- Keep `.npmrc` `node-linker=hoisted` and `virtual-store-dir-max-length=50` (Metro and Windows path-length issues proven in Scrap-it-).
- Python lives in `apps/api` with its own `pyproject.toml` (uv or pip-tools); Turborepo wraps its scripts but Python dependencies are not managed by pnpm.
- Shared TS config packages: `tsconfig`, `eslint-config`.

## Consequences
- Same pattern as Scrap-it-, so known pitfalls (Metro symlinks, NativeWind resolution) are already solved.
- Hoisted linker allows phantom dependencies; mitigated with lint rule `import/no-extraneous-dependencies`.
- Python and JS toolchains stay separate; the only bridge is the OpenAPI file.
