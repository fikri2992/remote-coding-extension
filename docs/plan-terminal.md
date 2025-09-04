# Terminal — Command Runner to Full Interactive PTY

Outcome: Start with a safe Command Runner (execute a command, capture output), then add true interactive terminals using `node-pty`, all optimized for mobile.

Related server code to review/extend

- `src/server/ServerManager.ts`: lifecycle, status, WS wiring.
- `src/server/WebSocketServer.ts`: message routing and broadcast.
- `src/server/CommandHandler.ts`: command allowlist (will not be used for PTY; keep for editor commands).

New server module

- `src/server/TerminalService.ts` (proposed):
  - Stage 1 — Command Runner: `exec(command, cwd, env)` with timeout, output chunks streamed over WS.
  - Stage 2 — Interactive: use `node-pty` to spawn a pseudo terminal that supports `data`, `resize`, `input`, `exit` events.
  - Multiplex sessions: map `sessionId` → PTY instance; cleanup on idle.
  - Security: workspace cwd only; configurable command allow‑list; redact secrets from output.

Protocol (WS v1)

- Envelope: `{ type: 'terminal', id, data: { op, sessionId?, command?, args?, cols?, rows?, data? } }`
- Ops:
  - `create`: returns `{ sessionId }` and initial banner.
  - `data`: server → client stream `{ sessionId, chunk, at }`.
  - `input`: client → server `{ sessionId, data }`.
  - `resize`: `{ sessionId, cols, rows }`.
  - `exec`: one‑shot command runner; returns `{ stdout, stderr, code }` or streamed chunks with final `{ done }`.
  - `dispose`: kill session and free resources.

Frontend tasks

- Integrate `xterm.js` on `TerminalPage.tsx` with mobile keyboard helpers:
  - Sticky action row for Ctrl, Alt, Tab, Esc; long‑press for combos.
  - Optional monospace scaling slider; double‑tap to zoom.
- Session management: create, list, switch; reconnect logic on WS drop.
- Latency handling: coalesce small chunks; debounce writes for smoother paint.
- Copy/paste: long‑press select; gesture to copy; expose clear screen.

Step‑by‑step plan

- Stage 1: Command Runner (MVP)
  - [ ] Add `TerminalService.exec()` (child_process spawn with timeout, stream stdout/err over WS `terminal:data`).
  - [ ] Implement WS `op: 'exec'` path with cwd pinned to workspace.
  - [ ] Build minimal UI to run command and show output (non‑interactive).
- Stage 2: Interactive PTY
  - [ ] Add `node-pty` dependency in extension backend (packaged binary notes per OS).
  - [ ] Implement `create/input/resize/dispose` ops; idle timeout cleanup.
  - [ ] Streaming back‑pressure: pause/resume or buffer cap with drop notice.
  - [ ] Replace UI with xterm.js and session tabs.
- Hardening
  - [ ] Allow‑list commands (configurable) or at least explicit risk prompt.
  - [ ] Output redaction (tokens, known secrets) with opt‑in.
  - [ ] Rate‑limit input to avoid runaway resource usage.

Acceptance criteria

- Command Runner: `git status` and `ls -la` execute within 5s, output streamed without UI freezes.
- Interactive: Supports nano/vim, arrow keys, resizing; reconnect restores session within 10s.
- Mobile controls: common hotkeys accessible with ≤ 2 taps.

