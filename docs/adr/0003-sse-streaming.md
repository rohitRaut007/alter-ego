# ADR 0003: SSE for mentor and protocol streaming

Status: Accepted · Date: 2026-10-13

## Context
Mentor replies stream token by token; protocol generation reveals one section at a time (PRD §7.1). Traffic is server to client; user input is ordinary POST.

## Decision
- Server-Sent Events over HTTP from Django ASGI. Endpoints: `GET /protocols/{id}/events`, `POST /mentor/threads/{id}/messages` (streamed response).
- Event types: `section.ready`, `progress`, `token`, `done`, `error`. Each event has an id; clients resume with `Last-Event-ID`.
- Protocol generation runs in Celery; progress is published via Redis pub/sub and relayed by the SSE view.
- Mobile uses a fetch-based SSE reader (React Native lacks native `EventSource`); fall back to polling `GET /protocols/{id}` every 2s if streaming fails.

## Consequences
- Simpler than WebSockets, works through standard proxies.
- Long-lived connections need ASGI workers and proxy timeouts raised (>= 120s) and heartbeats every 15s.
- Auth via Authorization header, so web uses fetch streams, not the browser `EventSource`.
