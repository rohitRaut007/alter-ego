# ADR 0006: Hosting region and model-provider data terms

Status: Proposed (needs owner decision on region; provider terms partly verified) · Date: 2026-10-13

## Context
GDPR and DPDPA apply from launch (PRD §8.4). Primary users are in India; global later. Personal data is sent to a model provider.

## Provider terms: what was verified
Checked on 2026-10-13 against Anthropic's published pages:
- Commercial products (including the API) are not used to train models unless the customer opts in to a program. Source: [Anthropic privacy centre / consumer-terms update](https://www.anthropic.com/news/updates-to-our-consumer-terms).
- API inputs and outputs are deleted from backend within 30 days by default, with exceptions (usage-policy enforcement, legal). Source: [How long do you store my organization's data?](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-personal-data).
- Zero data retention exists but is enabled per organization by the account team. Source: [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).

**Not verified, must be confirmed before real user data flows:** data-processing agreement and standard contractual clauses availability, sub-processor list, inference region or data-residency options, DPDPA-specific terms, and whether ZDR is available to this account. Do not claim "data stays in India" until confirmed in writing.

## Decision (proposed)
- Primary region for app, Postgres and Redis: **AWS ap-south-1 (Mumbai)** or equivalent, to serve Indian users and align with DPDPA expectations. Add an EU region only when EU users are accepted.
- Model calls leave the region to the provider; this is disclosed in the privacy notice and consent ledger entry `ai_processing`.
- Request ZDR once volume justifies; until then rely on the 30-day default and minimise payload (no names, emails or ids in prompts; stable pseudonymous user label).
- Sign the provider DPA; record sub-processors in `docs/privacy/subprocessors.md` (to be created).

## Consequences
- Latency from Mumbai to the provider is acceptable for streaming UX.
- Cross-border transfer must be reflected in notices and consent text.
- If owner wants Supabase for hosted Postgres only, choose the Mumbai region and confirm it supports pgvector and backups encryption.
