**Sessions Guide**

This document explains how chat sessions are created, selected, persisted, and replayed from the backend up to the frontend. It lists the key files and functions so you can trace any issue quickly (e.g., history not loading on reload).

**Data Model**
- **Thread (UI-facing id):** The identifier used by the web UI for listing and history replay. Stored on disk with updates.
- **Agent Session (backend sessionId):** The live session in the ACP agent. The controller tracks the last active session and associates it with threads for prompting and updates.

**Persistence**
- On disk (server):
  - Sessions index + last used: `src/acp/SessionsStore.ts:13`
  - Thread histories: `src/acp/ThreadsStore.ts:17`
- In browser (client):
  - Last selected thread id: `chat:activeThreadId`
  - Last seen session id: `chat:lastSessionId`
  - Tool UI state per thread: `chatToolsGroupOpen:${threadId}`, `chatToolOpenMap:${threadId}`

**Backend**
- Controller: maintains the ACP agent connection and persists sessions/threads.
  - `src/acp/AcpHttpController.ts:9` — class AcpHttpController
  - `src/acp/AcpHttpController.ts:45` — `init()` loads stores and sets `lastSessionId`
  - `src/acp/AcpHttpController.ts:51` — `connect(body)` spawns/reuses agent and wires events
  - `src/acp/AcpHttpController.ts:100` — `newSession(body)` creates a new agent session and persists it
  - `src/acp/AcpHttpController.ts:171` — `prompt(body)` ensures an active session, appends user message to thread, forwards to agent; on “Session not found” it recovers once
  - `src/acp/AcpHttpController.ts:213` — `ensureActiveSession()` returns `lastSessionId` or creates a new session
  - `src/acp/AcpHttpController.ts:226` — `state()` exposes `{ connected, sessionId }`
  - `src/acp/AcpHttpController.ts:230` — `selectThread({ threadId })` associates the UI’s thread with the current active session and appends a benign marker
  - `src/acp/AcpHttpController.ts:274` — terminal helpers (not session-specific)
  - `src/acp/AcpHttpController.ts:388` — `applyDiff` helper (not session-specific)

- Stores: file-based persistence under `.on-the-go/acp`.
  - `src/acp/SessionsStore.ts:13` — stores `lastSessionId` and session metadata
    - `init():19`, `list():33`, `getLast():36`, `select():39`, `add():47`, `touch():57`, `delete():68`, `clearLast():75`
  - `src/acp/ThreadsStore.ts:17` — stores thread history files and `index.json`
    - `init():24`, `append():41`, `get():70`, `list():78`

- Event bus → WebSocket broadcast:
  - Bridge in server startup: `src/cli/server.ts:356` (registers WS acp service and forwards AcpEventBus events)
  - WS routing and acp_response mapping: `src/server/WebSocketServer.ts:520` (generic service router), and ACP envelope mapping `src/server/WebSocketServer.ts:560`

- Agent connection:
  - `src/acp/ACPConnection.ts:20` — spawns the agent, provides `newSession()`, `prompt()` and emits `session_update`
  - Requests used:
    - `session/new`: `ACPConnection.newSession()` `src/acp/ACPConnection.ts:106`
    - `session/prompt`: `ACPConnection.prompt()` `src/acp/ACPConnection.ts:115`

**Frontend**
- WebSocket client and ACP RPC:
  - `src/webview/react-frontend/src/components/WebSocketProvider.tsx:1`
  - `sendAcp(op, payload)`: `src/webview/react-frontend/src/components/WebSocketProvider.tsx:138`
  - Resolves `acp_response` messages and returns `result` or rejects on `ok: false`: `src/webview/react-frontend/src/components/WebSocketProvider.tsx:57`

- Chat page (selection, restore, and history replay):
  - `src/webview/react-frontend/src/pages/ChatPage.tsx:44` — component state, including `sessionId`, `activeThreadId`
  - Startup restore sequence: `src/webview/react-frontend/src/pages/ChatPage.tsx:142`
    1) Restore `chat:activeThreadId`
    2) `session.selectThread` → sets `sessionId`
    3) `thread.get` to load history
    4) Fallback to `session.state`, then `chat:lastSessionId`
  - Persist last session id locally: `src/webview/react-frontend/src/pages/ChatPage.tsx:196`
  - Selecting a session from the UI: `src/webview/react-frontend/src/pages/ChatPage.tsx:426`
    - Calls `session.selectThread` and sets `activeThreadId` + `sessionId`, then loads `thread.get`
  - History load: `src/webview/react-frontend/src/pages/ChatPage.tsx:648` — `loadThreadHistory(id)` → `thread.get`
  - Handling live updates: `src/webview/react-frontend/src/pages/ChatPage.tsx:108` — maps `session_update` events into message bubbles
  - Recovery event: `src/webview/react-frontend/src/pages/ChatPage.tsx:122` — on `session_recovered`, updates `sessionId`, sets `activeThreadId`, refreshes threads, and reloads history

**Protocol (WebSocket frames)**
- Client → Server: `{ type: 'acp', id, op, payload }`
- Server → Client: `{ type: 'acp_response', id, ok: true, result }` or `{ ok: false, error }`
- Live updates broadcast: `{ type: 'session_update', update }`, `{ type: 'session_recovered', ... }`

**LocalStorage Keys (Frontend)**
- `chat:activeThreadId` — last selected thread id (used at startup to auto-restore)
- `chat:lastSessionId` — last known agent session id (fallback if server state not available)
- `chatToolsGroupOpen:${threadId}` — Tool Calls group open/closed
- `chatToolOpenMap:${threadId}` — per-tool-call open state

**Typical Flows**
- New session:
  1) UI calls `session.new` → controller `newSession()` creates agent session and persists id.
  2) UI sets `sessionId` and `activeThreadId` to the new id; history list starts empty.
- Select existing session (thread):
  1) UI calls `session.selectThread({ threadId })` → controller associates existing/active agent session id (ensuring one exists).
  2) UI sets `activeThreadId` (thread id) and `sessionId` (agent id), then calls `thread.get(threadId)` to replay history.
- Send message:
  1) UI appends the user message locally and calls `prompt({ prompt })`.
  2) Controller `ensureActiveSession()` uses `lastSessionId` (or creates one once) and forwards to the agent; appends updates to the thread file.
  3) UI receives `session_update` events and renders tool calls / assistant messages.
- Reload:
  1) UI checks `chat:activeThreadId`; if present, it calls `session.selectThread` and `thread.get` to restore history and live session.
  2) If absent, falls back to `session.state()` then `chat:lastSessionId`.

**Troubleshooting Reload History**
- If history doesn’t load after a reload:
  - Confirm `localStorage.getItem('chat:activeThreadId')` exists in DevTools.
  - Verify the `acp_response` for `session.selectThread` returns a `sessionId`.
  - Check server `.on-the-go/acp/threads/index.json` contains the selected thread id.
  - Ensure `acp_response.ok` is true; otherwise review server logs for agent connection/auth.
  - Confirm `session_recovered` is not firing unexpectedly (which would switch `sessionId`).

**Notes**
- The UI distinguishes between thread ids (used for history files) and agent session ids (live state). The controller maps and persists appropriately. On reload, the UI uses the last thread id to restore both history and agent binding.

