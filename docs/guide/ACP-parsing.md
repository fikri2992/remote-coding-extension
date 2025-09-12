# ACP Web App: Parsing, Chat, Permissions, Modes, and Models

This document provides a comprehensive reference for the ACP Web App’s user interaction features and server behaviors. It is intended to support UI migrations by enumerating what the current app parses, renders, and exposes via REST/WS, including adapter-specific differences (Claude Code ACP) and known gaps.

Related files:
- Frontend: `acp-web-app/public/index.html`, `acp-web-app/public/app.js`, `acp-web-app/public/ui-enhancer.js`
- Backend: `acp-web-app/server/index.ts`, `acp-web-app/server/acpConnection.ts`, `acp-web-app/server/jsonrpc.ts`, `acp-web-app/server/types.ts`
- Persistence: `acp-web-app/server/sessionsStore.ts`, `acp-web-app/server/threadsStore.ts`, `acp-web-app/data/`
- Claude adapter: `docs/integration/claude-code-acp.md`
- Modes & models mapping: `docs/mapping/modes-and-models.md`
- Architecture & usage: `docs/architecture.md`, `docs/usage.md`

---

## Connect and initialization (WebSocket service 'acp')

WebSocket request frame (type `acp`):

```json
{ "type": "acp", "id": "<reqId>", "op": "connect", "payload": { "agentCmd": "...", "cwd": "...", "env": {"KEY": "VAL"}, "proxy": "http://..." } }
```

Server behavior (`src/cli/server.ts` → WS service 'acp' → `AcpHttpController.connect` → `ACPConnection.connect`):
- Parses `agentCmd` into executable + args; if `proxy` is provided, appends `--proxy <url>` to the args.
- Spawns the agent process with stdio pipes.
  - On Windows, uses `shell: true` so `.cmd` shims (e.g., `claude-code-acp.cmd`) resolve.
- Adapter detection (`server/acpConnection.ts`):
  - If the command path/args include `claude-code-acp`, sets adapter name to `claude` and framing to `ndjson`.
  - Otherwise defaults to `generic` with LSP `Content-Length` framing.
- Performs JSON-RPC `initialize` and stores the response (including `authMethods` and `agentCapabilities`).
- Broadcasts WS `{ type: 'agent_initialized', init }` to clients, which the UI uses to enable/disable inputs based on `promptCapabilities`.

Response frame:

```json
{ "type": "acp_response", "id": "<reqId>", "ok": true, "result": { "ok": true, "init": { /* initialize response */ } } }
```

See also: `docs/architecture.md` sequence diagrams.

## Prompt Input: What the UI sends (WebSocket)

The UI constructs a `prompt: ContentBlock[]` and sends an `acp` frame with `op: "prompt"`.

```json
{ "type": "acp", "id": "<reqId>", "op": "prompt", "payload": { "sessionId": "...", "prompt": [ /* ContentBlock[] */ ] } }
```

Accepted content block shapes (validated in `server/index.ts` via `zod`):
- `{ type: 'text', text: string }`
- `{ type: 'image', data: string /* base64 */, mimeType: string }`
- `{ type: 'audio', data: string /* base64 */, mimeType: string }`
- `{ type: 'resource_link', uri: string, text?: string }`
- `{ type: 'resource', resource: { text: string, mimeType?: string } | { blob: string /* base64 */, mimeType?: string, uri: string } }`

UI features and gating:
- Capabilities are read from `agent_initialized` WS message (`agentCapabilities.promptCapabilities`), parsed in `public/app.js`:
  - `image` → enables image attachments (`#imageInput`).
  - `audio` → enables audio attachments (`#audioInput`).
  - `embeddedContext` → enables arbitrary files as embedded `resource` blocks (`#fileInput`).
- Converters:
  - `fileToBase64(file)` → base64.
  - `filesToImageBlocks(fileList)` / `filesToAudioBlocks(fileList)` / `filesToResourceBlocks(fileList)` convert File inputs to `ContentBlock`s.
- Drag & drop (`#dropzone`) feeds into an attachments queue (see “Known gaps” re: queue helpers).

If `sessionId` is omitted, the server falls back to the `lastSessionId`.

Cancel via WebSocket:

```json
{ "type": "acp", "id": "<reqId>", "op": "cancel", "payload": { "sessionId": "..." } }
```

---

## Streaming Updates: What the UI parses and renders (WebSocket)

WS endpoint: `/ws`. The backend (`server/index.ts`) broadcasts messages with `type` fields, and the UI handles them in `public/app.js`.

Key message types and parsing behaviors:

- `agent_initialized { init }`
  - UI caches capabilities (`image`, `audio`, `embeddedContext`) and enables inputs.
  - Appears right after the `acp` `connect` request and the agent’s `initialize` RPC.

- `agent_stderr { line }`
  - Appends raw stderr into the “Agent stderr” panel.

- `session_update { update }`
  - The core chat/event stream. UI inspects `update.type` (alias `update.sessionUpdate`) and renders accordingly.
  - Message chunks:
    - `agent_message_chunk` with `content: { type: 'text' | 'image' | 'audio' }`
      - Text: assistant bubble (ignores `(no content)`).
      - Image/audio: base64 media rendered inline.
    - `user_message_chunk` (text): user bubble.
    - `agent_thought_chunk` (text): italicized “Thought”.
  - Planning and commands:
    - `plan { entries: [{ content, status }, ...] }`: rendered as a bullet list.
    - `available_commands_update { availableCommands: [{ name }, ...] }`: rendered list for user awareness.
      - Note: Some agents may emit snake_case properties (e.g. `available_commands`). If integrating a different agent, you may need to map to the expected `availableCommands` shape.
  - Mode and token usage:
    - `mode_updated { modeId }` (generic agents) and `current_mode_update { current_mode_id }` (Claude-like) both supported. UI updates header `Mode` dropdown and renders a “Mode: …” bubble.
    - `token_usage { usedTokens, maxTokens? }`: updates a “Tokens” header badge with color-coded thresholds.
  - Tool calls:
    - `tool_call` / `tool_call_update` events handled with robust parsing for a variety of shapes from adapters. The UI tries `update.content` array first, then falls back to `update.tool_call.content` (or `update.toolCall.content`).
    - Recognized tool content types:
      - `{ type: 'content', content: { type: 'text' | 'image' | 'audio', ... } }`
      - `{ type: 'text' | 'image' | 'audio', ... }`
      - `{ type: 'terminal', terminalId }` → notifies terminal start.
      - `{ type: 'diff', path, hunks?, newText? }` → opens a diff overlay with optional “Apply” (sends `acp` op `diff.apply`).
      - `{ type: 'resource_link', uri, text? }` → clickable; for `file://` URIs the UI may use the WebSocket `fileSystem` service to fetch preview text; non-file URIs open in a new tab.
    - When content is missing but `rawInput` is present, the UI shows a truncated hint for debugging.

- `permission_request { requestId, request }`
  - Opens a modal with options. See “Permission model” below for full flow.

- `terminal_output { terminalId, chunk, stream }` and `terminal_exit { terminalId, exitStatus }`
  - Stream into any UI-created terminal panes.

Raw events inspector: The UI appends every WS message line into a dockable “Raw Events” panel to aid development and debugging.

---

## Permission model (tool calls, WebSocket)

End-to-end flow:
1. Agent issues JSON-RPC request `session/request_permission { session_id, tool_call, options }` over stdio.
2. `server/acpConnection.ts` intercepts this request:
   - Records the pending `requestId`.
   - Normalizes options to `{ id, name, kind }` where `kind ∈ { allow_once, allow_always, reject_once, reject_always }`.
   - Emits `'permission_request'` event upwards to `server/index.ts`.
3. Backend broadcasts WS `{ type: 'permission_request', requestId, request }` to the browser.
4. UI shows a modal with buttons for each option and a “Cancel”.
5. UI responds with WebSocket `acp` frame:

```json
{ "type": "acp", "id": "<reqId>", "op": "permission", "payload": { "requestId": 1, "outcome": "selected", "optionId": "..." } }
```
6. `server/acpConnection.ts` replies to the original JSON-RPC request:
   - `'cancelled'` → `{ outcome: { outcome: 'cancelled' } }`
   - `'selected'` with `optionId` → `{ outcome: { outcome: 'selected', optionId } }`

Notes:
- The server rejects invalid shapes (missing `requestId` or missing `optionId` for `selected`).
- UI/Server print logs for easy diagnosis (stderr panel + server logs).

---

## Modes (session.setMode, WebSocket)

- WebSocket frame: `{ type: 'acp', op: 'session.setMode', payload: { sessionId, modeId } }` → `ACPConnection.setMode()`.
- Adapter differences handled automatically in `server/acpConnection.ts`:
  - Claude adapter (detected by command path or args) expects camelCase: `{ sessionId, modeId }`.
  - Generic/Rust agents expect snake_case: `{ session_id, mode_id }`.
- UI:
  - `Mode` dropdown (in header) is populated from `session/new` response when the agent returns a `modes` object: `{ availableModes: [{ id, name }...], currentModeId }`.
  - When WS updates `mode_updated` or `current_mode_update` arrive, the dropdown and a chat bubble reflect the new mode.

See also: `docs/mapping/modes-and-models.md`.

---

## Models (WebSocket; optional; adapter-dependent)

- Listing: WebSocket `{ type: 'acp', op: 'models.list', payload: { sessionId } }`.
- Selection: WebSocket `{ type: 'acp', op: 'model.select', payload: { sessionId, modelId } }`.
- `server/acpConnection.ts` behavior:
  - If `supportsModelListing() === false` (Claude adapter), returns an empty list and selection is disallowed.
  - Otherwise tries `session/list_models` first, then falls back to `agent/list_models`.
  - For selection, tries `session/select_model`, then `agent/select_model`.
- UI:
  - Populates `Model` dropdown when a non-empty list is returned.
  - If empty or an error is returned, keeps the dropdown disabled.

Adapter note: Claude Code ACP currently does not implement list/select; UI disables the control by design.

---

## Authentication (WebSocket; agent-dependent)

- If a prompt fails with a 401 or `-32000 Authentication required`, the server maps the error to `{ authRequired: true, authMethods: [...] }`.
- UI populates the “Auth Methods” dropdown and sends `acp` `{ op: 'authenticate', payload: { methodId } }`.
- The `Anthropic API Key` field populates `env.ANTHROPIC_API_KEY` for the `connect` payload.
- Methods: send `acp` `{ op: 'authMethods' }` to fetch `{ methods }`.

---

## Sessions and Threads (WebSocket)

- Sessions persistence: `server/sessionsStore.ts` persists `lastSessionId` and a list to `data/sessions.json`.
- Threads persistence: `server/threadsStore.ts` appends every `session_update` to `data/threads/<sessionId>.json` and maintains `data/threads/index.json`.
- WebSocket ops:
  - `sessions.list` → `{ sessions, lastSessionId }`
  - `session.last` → `{ sessionId }`
  - `session.select` → select current session
  - `session.delete` → delete a session
  - `threads.list` → list transcripts
  - `thread.get` → fetch a transcript by id
 - UI:
   - “Threads” section uses these ops to list and open transcripts.

---

## Terminals (UI- and agent-initiated, WebSocket)

UI-initiated (panel in the app, all via `acp` ops):
- `terminal.create { command, args?, env?, cwd?, outputByteLimit? }` → `{ terminalId }`.
- `terminal.output { terminalId }` → `{ output, truncated, exitStatus }`.
- `terminal.kill { terminalId }` and `terminal.release { terminalId }`.
- `terminal.waitForExit { terminalId }`.

Agent-initiated (JSON-RPC → server): handled in `server/acpConnection.ts`:
- `terminal/create`, `terminal/output`, `terminal/kill`, `terminal/release`, `terminal/wait_for_exit`.
- WS: `terminal_output` and `terminal_exit` stream to the UI.

Windows-specific behavior: server strips `mkdir -p` for built-in `mkdir` and spawns with `shell: true` to resolve `.cmd` shims.

---

## MCP servers (optional; WebSocket)

- UI form collects HTTP/SSE servers with optional headers and stores them in `localStorage`.
- `acp` op `session.new` forwards `mcpServers` to the agent in the payload.

---

## Known gaps and TODOs (important for migration)

- Attachments queue UI helpers are referenced but not fully implemented in `public/app.js`:
  - `attachmentsQueue` exists and is used when sending prompts.
  - The following helper functions are referenced but not present:
    - `addFilesToQueue(...)`
    - `renderAttachments()`
  - Impact: the “Queued Attachments” list (`#attachmentsList`) will not display or manage items unless these helpers are implemented. The send flow will still include any programmatically queued items.
- Diff apply API is minimal: WebSocket `acp` op `diff.apply { path, newText }` simply replaces the file contents. There is no structured hunk application or conflict detection yet.
- Model list/select is adapter-dependent; Claude Code ACP intentionally does not support it (UI remains disabled).
- Error/refusal updates: UI prints generic messages for `error` or `refusal` updates if provided; consider richer UX if needed.
- Resource preview may use the `fileSystem` WebSocket service for files addressable by `file://` URIs; non-file URIs open in a new tab.

---

## Adapter-specific behavior (Claude Code ACP)

- Framing: NDJSON line-based over stdio instead of LSP `Content-Length`. Automatically detected in `server/acpConnection.ts`.
- `session/update` payload may arrive as `{ sessionId, update }` instead of just the `update`; server normalizes and emits both.
- `session/set_mode` parameter case: camelCase.
- Permissions: The server normalizes permission options to `{ id, name, kind }` for the UI.
- Models: no list/select support; the server returns an empty list and the UI disables model selection.

For setup steps and troubleshooting, see `docs/integration/claude-code-acp.md`.

---

## Quick checklist for UI migrations

- Make sure to implement the attachments queue helpers to fully support images, audio, and embedded `resource` blocks in the composer.
- Mirror the WS parsing behaviors in your new UI:
  - Handle all `session_update` subtypes listed above.
  - Render media (image/audio) and tool content, including `diff`, `terminal`, and `resource_link`.
  - Reflect `mode_updated` / `current_mode_update` and `token_usage` in the header UI.
- Implement the permission modal:
  - Present all options with their `name`.
  - Post `selected` or `cancelled` via `POST /api/permission` with the `requestId` and `optionId` when required.
- Disable model selection for Claude Code; only enable where the backend returns a non-empty list.
- Propagate capabilities from `agent_initialized` to enable/disable image/audio/file attachments.
- Keep the Raw Events inspector or equivalent tooling during development; it is invaluable for diagnosing adapter differences.
