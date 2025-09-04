# Chat — Realtime, Offline‑Friendly, Optional Bot Connectors

Outcome: Reliable realtime chat across connected clients with offline queueing. Later, add optional “bot” connectors (LLM or automations) behind a safe interface.

Current state

- Server broadcasts `{ type: 'chat_message', ... }` (see `src/server/WebSocketServer.ts`).
- Frontend `ChatPage.tsx` receives and renders; persists to localStorage; sends user messages.

Gaps and goals

- Delivery: Ensure at‑least‑once delivery with client ack IDs; buffer on reconnect.
- Channels: Single default channel now; add named channels later (e.g., project, CI, bot).
- History: Persist last N messages on server optionally (file or in‑memory).
- Bot connector: Pluggable interface with strict rate‑limits.

Protocol (WS v1)

- Envelope: `{ type: 'chat', id?, data: { op, message?, channel?, lastAckId? } }`.
- Ops:
  - `send`: client → server user message. Server rebroadcasts normalized message.
  - `history`: client requests N messages; server responds with list and cursor.
  - `ack`: client acks last received id so server can drop buffer.
  - `bot`: optional op to invoke a named bot connector.

Server tasks

- Service: Add `ChatService.ts` with in‑memory ring buffer (configurable size, e.g., 500 msgs).
- Normalize message: `{ id, role, text, ts, senderId, channel }`.
- Acks: Maintain per‑connection last ack; purge buffers accordingly.
- Optional persistence: Store to `.remote-coding/chat.jsonl` with rotation.
- Bot connector interface (optional):
  - `providers/openai` sample; API key sourced from VS Code SecretStorage.
  - Hard limits; redact sensitive content by default.

Frontend tasks

- Enhance Chat UI:
  - Connection banner reflects true online state; retry and “work offline” modes.
  - Message status: sending → sent → delivered; local optimistic insert.
  - Retry unsent outbound when WS reconnects; de‑dup via content hash + ts.
  - Commands: `/git status`, `/open <path>`
  - Attachment stubs: add file snippet later (paste code block → upload? out of scope for MVP).

Checklists

- Server
  - [ ] `ChatService` with ring buffer and broadcast helpers.
  - [ ] WS routing for `{ type: 'chat', data.op }` separate from the existing ad‑hoc path.
  - [ ] History and ack ops; persist (optional) to JSONL.
  - [ ] Bot provider interface (behind explicit opt‑in and SecretStorage).
- Frontend
  - [ ] Replace ad‑hoc `type: 'chat_message'` with `type: 'chat'` ops.
  - [ ] Delivery and retry UI states; local optimistic insert with dedupe.
  - [ ] Channel selector (future); basic filters.
  - [ ] Settings to enable/disable bot connector.
- QA
  - [ ] Simulate WS flaps; ensure no duplicates, no message loss.
  - [ ] Large messages handling; max size and truncation warnings.
  - [ ] Mobile typing: composition events, enter vs shift+enter ok.

Acceptance criteria

- Two devices exchange messages reliably under intermittent connectivity.
- Offline compose works; sends after reconnect without duplicates.
- Feature toggle for bot present but off by default; no secret leaks.

