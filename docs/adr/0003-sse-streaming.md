# ADR 0003: SSE for mentor and protocol streaming

Status: Accepted · Date: 2026-10-13

## Context
Mentor replies stream token by token; protocol generation reveals one section at a time (PRD §7.1). Traffic is server to client; user input is ordinary POST.

## Decision
- Server-Sent Events over HTTP from Django ASGI. Endpoints: `GET /protocols/{id}/events`, `POST /mentor/threads/{id}/messages` (streamed response).
- Event types: `section.ready`, `progress`, `token`, `done`, `error`. Each event has an id; clients resume with `Last-Event-ID`.
- Protocol generation runs in Celery. Progress is appended to a persisted `ProtocolEvent` log and the SSE view replays it by id (polling the table). This replaced the original Redis pub/sub idea in Phase 2: it needs no extra infrastructure, survives worker restarts, and makes `Last-Event-ID` resume exact. Events carry section keys and counts only, never section content.
- Mobile uses a fetch-based SSE reader (React Native lacks native `EventSource`); fall back to polling `GET /protocols/{id}` every 2s if streaming fails.

## Consequences
- Simpler than WebSockets, works through standard proxies.
- Long-lived connections need ASGI workers and proxy timeouts raised (>= 120s) and heartbeats every 15s.
- Auth via Authorization header, so web uses fetch streams, not the browser `EventSource`.

## Phase 2 status
Implemented for `GET /api/v1/protocols/{id}/events`. The view is an async generator under ASGI (uvicorn); it ends when the protocol is `ready` or `failed` and the log is drained, sends a keep-alive comment every 15s, and stops after 10 minutes. The web client reads it with fetch streams (`packages/api-client`) and falls back to polling every 2s. Mentor token streaming (Phase 4) reuses the same transport.
