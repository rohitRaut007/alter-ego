# ADR 0004: Mentor memory

Status: Accepted · Date: 2026-10-13

## Context
PRD §5.3 requires a mentor that remembers prior sessions. Sending full history every call is costly, slow and leaks irrelevant context.

## Decision
Three tiers, assembled per turn by a context assembler in `mentor/memory`:

1. **Pinned context (cacheable prefix):** protocol summary (identity thesis, traits, current sprint), mentor persona prompt, safety rules.
2. **Structured facts** (`MemoryFact`: kind = goal | fear | constraint | preference | progress | commitment | insight; text; source; confidence; supersedes; embedding). Retrieved per turn by: always-include set (active commitments, current sprint) + top-k pgvector similarity to the user message + recency boost.
3. **Rolling summaries** (`ThreadSummary`): every N turns or at thread end a Celery job summarises into a short paragraph; last 2 summaries plus the last ~6 raw messages are included.

Facts are extracted by a Celery job after each session, deduplicated and conflict-resolved (`supersedes`). Users can view and delete facts. Fact text is field-encrypted; embeddings are stored unencrypted and treated as sensitive (see consequences).

Weekly metrics (e.g. "8 of 12 Week 2 tasks done, misses all Knowledge") are computed from SQL and injected as structured data, never recalled by the model.

## Consequences
- Predictable token cost per turn; prompt cache hits on the pinned prefix.
- Embeddings leak semantic content; pgvector column lives in the same encrypted-at-rest database and is deleted with the user. Revisit if threat model requires encrypted vectors.
- Extraction quality needs evaluation: keep a small golden transcript set in tests.

## Phase 4 as built
Local SQLite has no pgvector, so fact retrieval is lexical (token overlap, always including active commitments) behind the same `retrieve_facts` function the vector version will replace. Per turn the model receives the persona, a protocol summary, a progress snapshot (numbers and titles only), at most 6 facts, the last 2 rolling summaries and the last 6 messages. Summaries are written every 8 messages. Facts are extracted per message by a separate task, are shown to the user and can be deleted. Flagged messages never reach extraction or summarisation.
