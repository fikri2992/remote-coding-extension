# WebSocket-Only Backend Guide

## Overview

- The backend exposes a single WebSocket endpoint at `/ws` on the same port that serves the React frontend.
- All application features (ACP, terminal, filesystem, git, tunnels) communicate exclusively over WebSocket.
- HTTP is used only to serve static assets; all `/api/*` routes respond with 404.

## Endpoint

- URL: `ws://<host>:<port>/ws` (or `wss://` if served over HTTPS)
- Dev: Vite proxies `/ws` to the backend port (see `src/webview/react-frontend/vite.config.ts`).
- Handshake: upon connection, the server sends a frame:
  - `{ type: 'connection_established', connectionId, timestamp, supportsAcpRequests: true }`

## Message Envelope

- Every message includes a top-level `type` used for routing to a service.
- Supported services: `terminal`, `fileSystem`, `git`, `tunnels`, `acp`.
- Optional `id` can be provided by clients to correlate request/response pairs.
- Server responses:
  - For most services: `{ type: '<service>', id, ok: true|false, result|error }`
  - For `acp`: `{ type: 'acp_response', id, ok: true|false, result|error }`

## Services

### ACP (`type: 'acp'`)

- Request: `{ type: 'acp', id, op: '<operation>', payload: { ... } }`
- Response: `{ type: 'acp_response', id, ok, result|error }`
- Common operations:
  - `connect`, `authenticate`, `authMethods`
  - `session.new`, `session.setMode`, `session.select`, `session.delete`, `session.last`, `sessions.list`
  - `prompt`, `cancel`
  - `models.list`, `model.select`
  - `permission`
  - `terminal.create`, `terminal.output`, `terminal.kill`, `terminal.release`, `terminal.waitForExit`
  - `diff.apply`
  - `threads.list`, `thread.get`

Client helper: `WebSocketProvider.sendAcp(op, payload)` wraps this pattern and resolves the paired `acp_response`.

### Terminal (`type: 'terminal'`)

- Request example:
  - Create session: `{ type: 'terminal', id, data: { op: 'create', sessionId: '<id>', cols, rows, persistent: true, engine: 'pipe' } }`
  - Input: `{ type: 'terminal', id, data: { op: 'input', sessionId, data: 'ls\n' } }`
  - Resize: `{ type: 'terminal', id, data: { op: 'resize', sessionId, cols, rows } }`
- Streamed updates arrive as `{ type: 'terminal', id, data: { ... } }` frames.

### File System (`type: 'fileSystem'`)

- Request: `{ type: 'fileSystem', id, data: { operation: 'tree'|'open'|'watch'|'create'|'delete'|'rename', path, options } }`
- The server forwards the full message to the FS service, which sends result frames back to the requesting client.

### Git (`type: 'git'`)

- Request: `{ type: 'git', id, data: { gitData: { operation: 'status'|'log'|'diff'|'add'|'commit'|'push'|'pull'|'show'|'branch'|'state'|'find-repos', options } } }`
- Response: `{ type: 'git', id, ok, result|error }`

### Tunnels (`type: 'tunnels'`)

- Request: `{ type: 'tunnels', id, op: 'list'|'status'|'create'|'stop'|'stopAll'|'install', payload }`
  - `create`: `{ localPort, name?, token? }` (`name` or `token` selects named tunnel, otherwise quick tunnel)
  - `stop`: `{ id? , pid? }`
- Response: `{ type: 'tunnels', id, ok, result|error }`

## Connection Security

- Origin allowlist includes common local development origins (e.g., `http://localhost:3000`, `http://localhost:3900`).
- Same-origin connections over tunnels are also permitted if the hostnames match.

## Frontend Integration

- The React app uses `WebSocketProvider` to manage the connection and helpers:
  - `sendJson(message)` to send raw frames
  - `addMessageListener(handler)` to subscribe to all frames
  - `sendAcp(op, payload)` for ACP request/response pairing
- Default URL derives from `window.location` and appends `/ws`.

## HTTP Behavior

- Static serving only (React build under `dist`).
- All `/api/*` routes return 404 with `{ error: 'API disabled. Use WebSocket endpoint /ws' }`.
- No `/health` endpoint; use a WS status op if needed.

## Example Flow (ACP)

1) Connect:
   - Request: `{ type: 'acp', id, op: 'connect', payload: { agentCmd?, cwd?, env?, proxy? } }`
   - Response: `{ type: 'acp_response', id, ok: true, result: { ok: true, init, ... } }`
2) New session: `{ type: 'acp', id, op: 'session.new', payload: { cwd? } }`
3) Prompt: `{ type: 'acp', id, op: 'prompt', payload: { sessionId, prompt: [...] } }`
4) Streaming updates: server pushes frames like `{ type: 'session_update', update: {...} }` and terminal events.

## Migration Notes

- Legacy HTTP ACP/Tunnels endpoints have been disabled in the server; use the WS services above.
- Vite dev server continues to proxy `/ws`, so `npm run dev:full` remains the recommended dev flow.
- If external tools were calling HTTP APIs directly, switch them to WS frames following the patterns above.

