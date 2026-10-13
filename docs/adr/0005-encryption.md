# ADR 0005: Encryption

Status: Accepted · Date: 2026-10-13

## Context
PRD §8.4 requires encryption at rest and in transit. Interview answers, journals, reflections and mentor messages are highly personal; database access by operators or a leaked backup must not expose them.

## Decision
- **In transit:** TLS 1.2+ at the edge; HSTS; internal service traffic over private network or TLS.
- **At rest:** managed Postgres and Redis encryption-at-rest, encrypted backups.
- **Field-level:** AES-256-GCM via a custom `EncryptedTextField` / `EncryptedJSONField`. Ciphertext format `v1:<key_id>:<nonce>:<ct>`; key ids allow rotation. Data-encryption keys come from a KMS in production (env-injected key material in dev). Applied to: interview answers, reflections, journal and collision notes, mentor message bodies, memory fact text.
- Not encrypted (so queries work): ids, timestamps, task state, layer, streak counters, scores.
- Passwords: Django's Argon2 hasher. Tokens: JWT signed with a rotated secret.
- Hard delete removes rows and associated keys material references; backups expire on schedule and the schedule is disclosed.

## Consequences
- Cannot SQL-search encrypted fields; search runs over embeddings or decrypts in application for small sets.
- Review queue (Django admin) must decrypt for reviewers: access is role-restricted and audited.
- Key loss is data loss: key backup and rotation runbook required before Alpha.
