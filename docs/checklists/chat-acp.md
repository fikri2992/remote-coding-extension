# Chat + ACP Integration Checklist

Use this checklist to validate the Chat page UX and its integration with the ACP WebSocket service in `kiro-remote`.

## UI/UX: Chat Page (src/webview/react-frontend/src/pages/ChatPage.tsx)

- [x] Composer is pinned at the bottom of the page
- [x] Messages area grows and scrolls independently above the composer
- [x] Auto-scrolls to last message when new messages arrive
- [x] Header shows current Mode and (optionally) current Model
- [x] Context chips (selected files) render above the composer
- [x] Mention suggestions (for files) appear at caret position and insert `@filename`
- [x] Text input supports multi-line (Enter-to-send optional for later)
- [x] Buttons: Send (primary), Cancel (secondary)

## Message Rendering

- [x] Renders text parts (`{ type: 'text', text }`)
- [x] Renders file resource links (`{ type: 'resource_link', uri, text? }`)
- [x] Renders inline resource text blocks (`{ type: 'resource', resource: { text, uri } }` up to size limit)
- [x] Renders images (data URI)
- [x] Renders audio (data URI, HTML5 `<audio>`)
- [x] Renders terminal content (`{ type: 'terminal', output }`)
- [x] Renders diffs with an "Apply" action via `diff.apply`
- [x] Unknown parts render as JSON for debugging

## Content Attachment (Context)

- [x] Add files as context chips
- [x] Inline text for small files (<= 256KB) using `{ type: 'resource', resource: { text, uri } }`
- [x] Use `{ type: 'resource_link', uri }` for large files

## ACP WebSocket Operations (service: `acp`)

- [x] `connect` — initialize agent, observe `agent_initialized` event
- [x] `session.new` — create session; store `sessionId` and `modes`
- [x] `prompt` — submit `ContentBlock[]` with `sessionId`
- [x] `cancel` — cancel in-flight prompt
- [x] `permission` — respond to tool permission prompts
- [x] `session.setMode` — switch mode (camelCase payload)
- [x] `models.list` — optional; disable UI if empty
- [x] `model.select` — optional; select model when supported
- [x] `diff.apply` — apply newText to a file path (safeguarded on server)

## Streaming Events Handling (type: `session_update`)

- [x] Normalize updates that come as `type` or `sessionUpdate`
- [x] Ignore meaningless `(no content)` text placeholders in chat stream
- [x] Map message chunks to bubbles:
  - [x] `user_message_chunk`
  - [x] `agent_message_chunk`
  - [x] `agent_thought_chunk` (render as assistant with thought meta)
- [x] Tool calls:
  - [x] Support both `tool_call` and `tool_call_update`
  - [x] Accept content in `update.content` or `update.tool_call.content`
  - [x] Render header (status, name, id, path from `rawInput`)
  - [x] Render content blocks: text/image/audio/diff/terminal/resource_link
- [x] Other updates:
  - [x] `plan` — render readable bullet plan
  - [x] `available_commands_update` — support `availableCommands` and `available_commands`
  - [x] `mode_updated` or `current_mode_update` — update `currentModeId` and show status line

## Permissions Flow

- [x] Show modal when `permission_request` arrives (request/options)
- [x] Post `permission` with `requestId` and selected `optionId`
- [x] Handle `cancelled` outcome

## File System & Git (via WebSocket services `fileSystem` and `git`)

- [x] File tree fetch for mentions/context (`fileSystem.tree`)
- [x] File open for inline text (`fileSystem.open`)
- [x] Git status for listing changed files used by mentions

## Error Handling & Recovery

- [x] If a prompt fails with missing session, create new `session.new` then retry once (client+server)
- [ ] Map 401 / `Authentication required` to auth UI when applicable
- [x] Guard WebSocket RPC calls with timeouts and fallbacks

## Performance & DX

- [x] Append-only chat list with minimal re-renders
- [x] Avoid flooding with raw events in the user chat — keep a separate debug panel if needed
- [x] Graceful handling of large diffs (truncate preview in UI)

## References

- `src/webview/react-frontend/src/pages/ChatPage.tsx`
- `src/webview/react-frontend/src/pages/ACPPage.tsx`
- `src/cli/server.ts` (WebSocket services: `acp`, `fileSystem`, `git`, `tunnels`)
- `src/acp/AcpHttpController.ts` (ACP handlers; emits events to `AcpEventBus`)
- `docs/guide/ACP-parsing.md` (WebSocket-based ACP guide)

