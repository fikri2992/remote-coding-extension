# Tasks — Terminal Hybrid Solution Migration

Purpose: Revamp the terminal from the previous plan (`docs/plan-terminal.md`) to the universal proxy approach (`docs/plan-terminal-hybrid-solution.md`), aligned with the system architecture and constraints captured in `docs/what-im-understanding.md`.

Tracking format: Use the checkboxes to track status. Keep items scoped and shippable. Reference concrete files/paths to reduce ambiguity.

Links:
- Previous: docs/plan-terminal.md
- Target: docs/plan-terminal-hybrid-solution.md
- Context: docs/what-im-understanding.md

---

## Phase 0 — Audit & Decisions

- [ ] Confirm current server/frontend state for terminal
  - Files: `src/server/TerminalService.ts`, `src/server/WebSocketServer.ts`, `src/webview/react-frontend/src/pages/TerminalPage.tsx`, terminal components.
  - Verify node-pty availability and fallback behavior on all platforms (Windows/macOS/Linux).
- [ ] Decide environment variable injection strategy for AI credentials
  - Source precedence: VS Code settings > process env.
  - Mapping keys as in target plan (Anthropic/OpenAI/Google/Gemini/Claude).
- [ ] Define persistence policy
  - Idle timeout (target: 30 minutes), buffer limits, reconnection semantics.
- [ ] Validate workspace-scoped execution (stay within workspace root; no arbitrary cwd).

Acceptance:
- Short design note documented inline in this file under each decision bullet.

---

## Phase 1 — Backend: Persistent Terminal Proxy

Goal: Enhance `TerminalService` to support persistent sessions with buffered output and credential injection. Maintain pipe-based fallback when node-pty is unavailable.

1. Terminal persistent sessions
- [x] Add in-memory session model
  - Add `PersistentTerminalSession` type: `sessionId`, `pty`, `clientId`, `lastActivity`, `outputBuffer`, `createdAt`.
- [x] Implement persistent map and reaper
  - Add `persistentSessions: Map<string, PersistentTerminalSession>`; reaper for idle sessions (30 min default).
  - File: `src/server/TerminalService.ts`.
- [x] Enhance `create` op
  - Support `{ persistent: true }` to spawn PTY with env injected.
  - On success, reply `{ op: 'create', ok: true, persistent: true, sessionId, cols, rows, cwd, availableProviders? }`.
  - Fallback: spawn pipe-based shell with same session envelope.
- [x] Enhance `input` op for reattachment
  - When receiving input for a known persistent session from a different `clientId`, update `clientId` and flush buffered output to the new client, then write input.
- [x] Add `list-sessions` op
  - Returns array of active persistent sessions with `sessionId`, `lastActivity`, `createdAt`, `persistent: true`, `status`.
- [x] Keepalive & resize
  - Keep existing `keepalive` and `resize`, update `lastActivity` for persistent sessions.

2. Credential injection
- [x] Create `src/server/CredentialManager.ts`
  - Read AI keys from VS Code configuration and environment.
  - Expose `getAllAICredentials()` and `getAvailableAIProviders()`.
- [x] Inject credentials into env for PTY create
  - Merge `process.env` with `credentialManager.getAllAICredentials()`.
  - Include `availableProviders` in `create` response for UI display.
 - [x] Make injection optional via config `webAutomationTunnel.terminal.injectAICredentials` (or env `KIRO_INJECT_AI_CREDS=1`). Default is off.

3. Security & hardening
- [ ] Ensure redact function covers common token formats (already present; re-check patterns)
- [ ] Restrict cwd to workspace root; normalize relative paths
- [ ] Preserve exec allowlist for non-PTY `exec` path unless explicitly disabled via env
- [ ] Add simple input rate limiting or backpressure note (buffer cap + drop notice in logs)

Acceptance:
- Start/stop/reconnect works across client reconnects with output buffering.
- `create(persistent:true)` returns `availableProviders` when credentials exist.
- Sessions auto-clean after idle timeout without leaks.

---

## Phase 2 — Protocol: WebSocket Enhancements

Goal: Align protocol with hybrid plan while keeping backward compatibility.

- [x] Extend `src/server/interfaces.ts`
  - Add `'terminal'` to `WebSocketMessage.type` union.
  - Add `TerminalMessageData` and `SessionInfo` interfaces as per target plan.
- [x] Extend `WebSocketServer` routing
  - Add handling for `terminal` messages `list-sessions` (or delegate to TerminalService `handle`).
  - Ensure uniform error responses: `{ type:'terminal', id, data: { ok:false, error } }`.

Acceptance:
- Frontend can `op: 'list-sessions'` and receive structured session data.
- No regressions for file system and git protocols.

---

## Phase 3 — Frontend: Mobile Interface for Persistence

Goal: Upgrade terminal page to manage persistent sessions and show connection/AI provider status.

- [ ] Update `src/webview/react-frontend/src/pages/TerminalPage.tsx`
  - Manual session start: do not auto-create; explicit “Create Session” button to begin proxying.
  - Add session list UI with create/switch/refresh.
  - Track `connectionStatus` and mark sessions as active/reconnecting/disconnected.
  - On connect, attempt `list-sessions` and reattach to last active session.
  - On `data` events, update `lastActivity` and write to xterm.
  - [ ] Optional: Enable clickable URLs in terminal (xterm web links addon) for device-code/OAuth flows (requires adding `xterm-addon-web-links`).
- [ ] Ensure `TerminalXterm` integrates with resize and input flows (already present; verify APIs used).
- [ ] Keep mobile action bar (`TerminalActionBar`) for Ctrl/Alt/Tab/Esc and common combos.
- [ ] Add small usage hints section (what works in universal terminal).

Acceptance:
- Creating a persistent session on mobile works and survives network loss/phone lock.
- Users can switch between active sessions and see connection/AI provider badges.

---

## Phase 4 — Cloudflare Tunnel Fit (No Code Changes)

Goal: Confirm compatibility with current tunnel flow described in `what-im-understanding.md`.

- [ ] Validate that same-origin check in `WebSocketServer` permits Cloudflare tunnel origins.
- [ ] Confirm terminal availability over tunnel on mobile (manual test).

Acceptance:
- Terminal proxy is usable end-to-end via tunnel without additional server changes.

---

## Phase 5 — Testing & Optimization

1. Unit tests (where test harness exists)
- [ ] Persistent session lifecycle: create → disconnect → reconnect → exit
- [ ] CredentialManager returns expected env variables and provider list
- [ ] Redaction masks secrets in representative outputs

2. Integration tests (happy paths)
- [ ] Regular CLI: `ls -la`, `git status`, `npm -v`
- [ ] AI CLI presence: command `--version` reporting when keys present
- [ ] Long-running command persists across disconnect (e.g., `npm install`)

3. Performance/robustness
- [ ] Bound output buffer with trim policy (e.g., cap 1000, slice to last 800)
- [ ] Basic adaptive streaming/backoff hooks present (can be no-op initially)
- [ ] Idle reaper cleans stale sessions without leaking processes

Acceptance:
- Meets success metrics targets in the hybrid plan (session survival, reconnect time, latency where measurable).

---

## Phase 6 — Documentation & Migration Notes

- [ ] Mark `docs/plan-terminal.md` as superseded; link to the hybrid plan and this tasks file.
- [ ] Document environment variables and VS Code settings keys consumed by `CredentialManager`.
- [ ] Add short “How to use Universal Terminal” guide in the React app or docs.

Acceptance:
- Clear upgrade path and usage guidance available for contributors and users.

---

## Phase 7 — Rollout & Safeguards

- [ ] Feature flag for persistent sessions if needed (env or config gate)
- [ ] Graceful fallback remains available (pipe-based shell) when `node-pty` missing
- [ ] Log events for create/exit/cleanup without leaking credentials

Acceptance:
- Safe to ship incrementally; fallback and flags reduce risk.

---

## File-by-File Implementation Pointers

- `src/server/TerminalService.ts`
  - Add persistent session management, buffer, reconnection handling, idle cleanup.
  - Inject env from `CredentialManager` on create.
  - Add `listPersistentSessions()` or similar getter.

- `src/server/CredentialManager.ts` (new)
  - Implement credential loading from VS Code config and env.

- `src/server/WebSocketServer.ts`
  - Route `terminal` ops incl. `list-sessions`; keep generic error wrapper.

- `src/server/interfaces.ts`
  - Add terminal message types and session info interfaces.

- `src/webview/react-frontend/src/pages/TerminalPage.tsx`
  - Add session list UI, reconnect flow, provider badges, connection status.

- `src/webview/react-frontend/src/components/terminal/*`
  - Verify `TerminalXterm` and `TerminalActionBar` cover mobile ergonomics.

---

## Definition of Done

- Persistent terminal sessions with buffer & reconnection work on mobile and desktop.
- AI credentials are injected; AI CLI tools run without extra setup.
- Pipe-based fallback remains functional when `node-pty` is unavailable.
- Frontend exposes create/switch/reconnect for sessions with clear status.
- Protocol additions are documented and typed.
- Docs updated; acceptance criteria met.

---

## Open Questions / To Decide

- Buffer size and compression thresholds for low bandwidth connections.
- Exact list of supported VS Code settings keys and their naming.
- Whether to expose session restoration across extension restarts (persist to disk) — out of scope for initial pass.
