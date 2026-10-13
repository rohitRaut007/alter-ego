# ADR 0008: Product analytics tool

Status: Accepted · Date: 2026-10-13

## Context
Need funnels (onboarding), retention (D7, D30), cohorts and an event taxonomy mapped to PRD §10, with strong privacy control, and low operational burden for one developer.

## Decision
**PostHog** (cloud, EU or US region chosen with ADR 0006; self-host is an option later).

Why: funnels, retention and cohort analysis built in; feature flags available for rollout; web and React Native SDKs; server-side capture from Django so key metrics are not blocked by ad blockers; can be self-hosted if data residency demands it; identified by pseudonymous user UUID.

Alternatives: Mixpanel (strong but no self-host, feature flags extra), Amplitude (heavier, enterprise pricing), GA4 (poor for product retention and privacy-sensitive data), custom Postgres tables (cheap, but dashboards cost time).

Rules:
- Server-side capture for outcome events; client capture only for UI interactions.
- No free-text user content in event properties. Properties are enums, ids, counts.
- Respect consent ledger: no capture until `analytics` consent is granted; honour opt-out.
- Session recording disabled.

## Consequences
- One more processor to list in sub-processors and DPA.
- If PostHog cloud region conflicts with residency needs, self-host on the same host as the API.
