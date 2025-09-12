ACp Page Functionality Overview

This document summarizes the features implemented by the ACP UI page and how they connect to the backend. It also includes related files and technical details for each feature so you can trace behavior end‑to‑end.

Scope source: `src/webview/react-frontend/src/pages/ACPPage.tsx`


**Core Features**

- Connect Agent: Launches an ACP‑compatible agent process with optional env, CWD and proxy.
- Authentication: Lists available auth methods and performs agent authentication.
- Sessions: Creates/selects/deletes sessions, tracks last session, and auto‑recovers.
- Prompting: Sends a prompt with optional context (files/diffs) and streams updates to chat.
- Context Panel: Browses workspace, adds files or git‑changed files as prompt context, previews content.
- Mentions: Inline @file mention suggestions with fuzzy search and autoinsert.
- Models: Lists/chooses agent models (when supported by adapter).
- Permissions: Approves/denies tool permission requests from the agent.
- Terminal: Creates a terminal, reads output, kills/releases it, and waits for exit.
- Debug/Logs: Displays raw WebSocket events and agent STDERR feed.


**Key UI Files**

- `src/webview/react-frontend/src/pages/ACPPage.tsx`: Main page implementing all features (connect/auth/session/prompt/context/chat/terminal/logs/UI state).
- `src/webview/react-frontend/src/components/WebSocketProvider.tsx`: WS client abstraction used by the page (`sendJson`, `addMessageListener`, `sendAcp`).
- `src/webview/react-frontend/src/components/chat/MentionSuggestions.tsx`: Dropdown UI for @mention suggestions.
- `src/webview/react-frontend/src/components/code/SyntaxHighlighter.tsx`: Rendering helper for code blocks and diffs.


**Key Server Files**

- `src/cli/server.ts`: Boots HTTP+WS server and registers WS services: `acp`, `fileSystem`, `git`, `terminal`, `tunnels`.
- `src/acp/AcpHttpController.ts`: Implements ACP operations (connect/auth/session/prompt/models/diffs/permissions) and persistence (sessions/threads).
- `src/acp/ACPConnection.ts`: Spawns the agent, speaks JSON‑RPC over stdio, maps FS/terminal RPC, emits session updates.


Feature Details
===============

Connect Agent
- UI: reads `agentCmd`, `cwd`, `proxyUrl`, `anthropicKey`; persists non‑secret prefs in `localStorage`.
- Action: `sendAcp('connect', { agentCmd, cwd, proxy, env })`.
- Backend: `AcpHttpController.connect` parses/validates `agentCmd`, merges proxy to env, spawns agent via `ACPConnection.connect`.
- Events: emits `agent_connect`, `agent_initialized`, `agent_exit`, `agent_stderr` to WS clients.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:507` (handleConnect)
  - `src/acp/AcpHttpController.ts:1` (class + connect flow)
  - `src/acp/ACPConnection.ts:1` (spawn + JSON‑RPC wiring)
  - `src/cli/server.ts:199` (acp service op routing)

Authentication
- UI: lists methods and triggers auth.
- Actions:
  - `sendAcp('authMethods')` → populate `authMethods`.
  - `sendAcp('authenticate', { methodId })`.
- Backend: `AcpHttpController.getAuthMethods`, `authenticate` → `ACPConnection.authenticate`.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:488` (refreshAuthMethods)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:497` (handleAuthenticate)
  - `src/cli/server.ts:199` (acp op routing: authMethods/authenticate)
  - `src/acp/ACPConnection.ts:130` (authenticate)

Sessions
- Create: `sendAcp('session.new', { cwd })` and store `sessionId`.
- Select/Delete/List: `session.select`, `session.delete`, `sessions.list`.
- Auto‑recover: When prompting fails with “Session not found”, create a new session and retry (client and server both implement recovery paths).
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:529` (handleNewSession)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:636` (handleSelectSession)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:646` (handleDeleteSession)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:332` (refreshSessions)
  - `src/acp/AcpHttpController.ts:103` (newSession)
  - `src/acp/AcpHttpController.ts:226` (select/delete/list sessions)
  - `src/cli/server.ts:199` (acp ops: session.*)

Prompting & Streaming Chat
- Build prompt from input and selected context. Small text files are inlined as `resource` (<= 256KB); otherwise `resource_link` is sent.
- Action: `sendAcp('prompt', { sessionId, prompt })`.
- Streaming: WS `session_update` events are normalized and mapped to chat messages with roles `user`, `assistant`, `tool`, `system`.
- Tool calls: surfaced with synthesized header and per‑block rendering (diffs, terminal, text, images, audio).
- Cancel: `sendAcp('cancel', { sessionId })`.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:564` (handleSendPrompt)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:617` (handleCancel)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:145` (WS subscription: session_update → chat mapping)
  - `src/acp/AcpHttpController.ts:151` (prompt + recovery)
  - `src/acp/ACPConnection.ts:139` (prompt)
  - `src/acp/ACPConnection.ts:147` (cancel)

Context Panel (Files + Git)
- File tree: `fileSystem` WS service `operation: 'tree'` lists children at a path.
- File preview: `operation: 'open'` returns UTF‑8 text and size for preview/inlining.
- Git changed files: `git` WS service `operation: 'status'` collects staged/unstaged/untracked/conflicted paths.
- Add/Remove context: maintains `selectedContext` and per‑item lazy preview state.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:325` (discoverFiles)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:428` (openFileText)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:440` (toggleCtxPreview)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:323` (fetchGitStatus)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:467` (addCtx), `:474` (removeCtx)
  - `src/webview/react-frontend/src/components/WebSocketProvider.tsx:1` (sendJson helper used by `wsRpc`)
  - `src/cli/server.ts:78` (register git service), `:137` (register filesystem service)

Mentions (@file)
- Detects `@token` near caret; performs fuzzy match against visible file list + changed files.
- Renders suggestions dropdown; selecting inserts “@name” and adds the file as context.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:846` (detectMention)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:357` (updateMentionSuggestions)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:871` (acceptMentionSelection)
  - `src/webview/react-frontend/src/components/chat/MentionSuggestions.tsx:1`
  - `src/webview/react-frontend/src/lib/fuzzy.ts:1` (fuzzySearch)

Models
- Lists and selects models when supported by the agent adapter (non‑Claude).
- Actions: `sendAcp('models.list', { sessionId })`, `sendAcp('model.select', { sessionId, modelId })`.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:724` (handleSelectModel)
  - `src/acp/ACPConnection.ts:171` (listModels), `:185` (selectModel)
  - `src/acp/AcpHttpController.ts:197` (listModels), `:207` (selectModel)

Permissions
- When the agent requests a tool permission, UI shows modal with options; user can choose or cancel.
- Action: `sendAcp('permission', { requestId, outcome, optionId? })`.
- Backend: `AcpHttpController.permission` forwards to `ACPConnection.respondPermission`.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:625` (handlePermission)
  - `src/acp/AcpHttpController.ts:217` (permission)
  - `src/acp/ACPConnection.ts:153` (respondPermission)

Terminal
- Create/Read/Kill/Release/Wait for exit via ACP ops mapped to `ACPConnection` terminal helpers.
- Actions: `terminal.create`, `terminal.output`, `terminal.kill`, `terminal.release`, `terminal.waitForExit`.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:663` (handleCreateTerminal)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:347` (handleReadTerminal – also polled)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:692` (handleKillTerminal)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:701` (handleReleaseTerminal)
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:714` (handleWaitExitTerminal)
  - `src/acp/ACPConnection.ts:199` (terminal create/output/kill/release/wait)
  - `src/acp/AcpHttpController.ts:233` (terminal endpoints)

Diff Apply (from Tool Output)
- When tool output includes a diff block with `newText` and `path`, UI can apply it directly via `diff.apply`.
- Backend: `AcpHttpController.applyDiff` writes the file safely under workspace root.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:800` (renderMessageParts → Apply handler)
  - `src/acp/AcpHttpController.ts:276` (applyDiff)
  - `src/cli/server.ts:199` (acp op routing: diff.apply)

Logs & Debug
- Raw WS events panel shows the last N events; STDERR stream panel shows agent stderr lines.
- WS debug toggles exist in provider via `localStorage` keys `KIRO_DEBUG_WS` and `KIRO_DEBUG_TERMINAL_CLIENT`.
- Files:
  - `src/webview/react-frontend/src/pages/ACPPage.tsx:145` (event/stderr handling in WS listener)
  - `src/webview/react-frontend/src/components/WebSocketProvider.tsx:1` (debug logging)


Data Flow Summary
-----------------

- Frontend uses `WebSocketProvider.sendAcp` to send `{ type: 'acp', id, op, payload }` frames.
- `src/cli/server.ts` routes `acp` ops to `AcpHttpController` methods and wraps result as `{ success, data }`.
- `ACPConnection` bridges HTTP‑level ops to agent JSON‑RPC methods and emits async events (`session_update`, `permission_request`, `agent_stderr`, `terminal_*`).
- `WebSocketProvider.addMessageListener` delivers these events back to the page for rendering and state changes.


Common ACP Ops (WS)
-------------------

- Agent lifecycle: `connect`, `disconnect`, `authenticate`, `authMethods`
- Sessions: `session.new`, `session.setMode`, `session.select`, `session.delete`, `sessions.list`, `cancel`, `prompt`
- Models: `models.list`, `model.select`
- Permissions: `permission`
- Terminal: `terminal.create`, `terminal.output`, `terminal.kill`, `terminal.release`, `terminal.waitForExit`
- Diffs: `diff.apply`


Notes & Limitations
-------------------

- Mode selection UI is currently disabled even if modes are available; the page still tracks current mode updates.
- File previews only inline UTF‑8 text files; large files fall back to `resource_link`.
- Terminal arg parsing is naive; quoted args are de‑quoted but complex shells should use the agent/terminal.
- Git status fetch is best‑effort; errors fallback to an empty changed‑files list.
