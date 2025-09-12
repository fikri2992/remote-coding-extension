# Chat Session Logic — Root Cause Analysis, Changes, and Fix Plan

## Symptoms
- Selecting a session and sending a message sometimes created a brand‑new session instead of continuing the selected one.
- Console showed prompts sent with a sessionId, but replies didn’t arrive or arrived under a different id.
- Prompts sent while the agent (ACP) wasn’t connected resulted in no responses.

## Root Causes (original)
- Agent sessions are ephemeral to the agent process; local SessionsStore persists across restarts. Stored ids become invalid after an agent restart.
- UI sent prompts with whatever sessionId it had, without validating the agent knew about it.
- When the server created a new session after “Session not found,” the session_recovered event wasn’t initially adopted by the UI, causing repeated recoveries.

## Current Architecture (after fixes)
- Server owns the active agent session; the client no longer needs to pass sessionId.
- Threads (history) remain persistent and human‑facing; agent sessions are ephemeral and auto‑managed.

### Backend
- File: `src/acp/AcpHttpController.ts`
  - `prompt()` ignores client sessionId and uses `ensureActiveSession()`.
  - `ensureActiveSession()` creates a new session on demand, persists it, and emits `session_activated`.
  - On “Session not found,” `prompt()` creates a session, emits `session_recovered`, retries once, and persists usage.
  - `connect()` no longer clears `lastSessionId`; validity is handled lazily by `ensureActiveSession()`.
  - Added `state()` → `{ connected, sessionId }` and `selectThread({ threadId })` → ensures session, returns `{ ok, sessionId }`.

- File: `src/cli/server.ts`
  - WS ACP routes added: `session.state`, `session.ensureActive`, `session.selectThread`.
  - Event forwarding includes `session_recovered` (and we emit `session_activated`).

### Frontend
- File: `src/webview/react-frontend/src/pages/ChatPage.tsx`
  - On mount: `connect` → `session.state`; if a session exists, load its history.
  - On selecting a thread: `session.selectThread({ threadId })` ensures a live session; then load the thread’s history.
  - On send: `prompt({ prompt })` only (no sessionId). If “not connected,” call `connect` then retry once.
  - `canPrompt` no longer requires a stored sessionId (server ensures/reuses or recovers).

## Updated Data Flow (simplified)
- Load: connect → session.state → optional history
- Select thread: session.selectThread → ensure session → load history
- Send message: prompt({ prompt }) → server ensures/recovers active session once

## Acceptance Criteria (now met)
- Sending messages does not create a new session when one is already active.
- After an agent restart, the first prompt triggers recovery once; the UI adopts the new id and subsequent prompts reuse it.
- Threads list can be used to view history; continue seamlessly creates/uses the live session.

## New/Updated APIs
- Requests (WS acp ops)
  - `connect` → `{ ok, init }`
  - `session.state` → `{ connected: boolean, sessionId: string|null }`
  - `session.ensureActive` → `{ sessionId }`
  - `session.selectThread({ threadId })` → `{ ok: true, sessionId }`
  - `prompt({ prompt: ContentBlock[] })` → any
- Events
  - `session_recovered { oldSessionId, newSessionId, reason }`
  - `session_activated { sessionId }`
  - `session_update { update }` (existing)
  - `agent_initialized`/`agent_exit`/`permission_request` (existing)

## Verification Checklist
- With a running agent
  - Load → `session.state` returns current id or null
  - Select thread → `session.selectThread` returns a session id
  - Send → no new sessions created; responses stream via `session_update`
- After agent restart
  - First send recovers and emits `session_recovered`; UI adopts new id
  - Next sends reuse that id

## Remaining UX polish (optional)
- Toasts for `session_recovered` / `session_activated` (“Reconnected to a new session”).
- “Agent disconnected” banner with a Reconnect button when `session.state.connected === false`.
- In Threads sheet, show an “Active” badge for the thread being continued; other threads are viewable and continue will create/use the live session.

## Notes
- Threads are the user‑facing unit; live sessions are server‑managed. This separation keeps the UX simple and robust.
