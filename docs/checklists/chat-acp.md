# Chat + ACP Integration Checklist

Use this checklist to validate the Chat page UX and its integration with the ACP WebSocket service in `kiro-remote`.

## UI/UX: Chat Page (src/webview/react-frontend/src/pages/ChatPage.tsx)

- [ ] Composer is pinned at the bottom of the page
- [ ] Messages area grows and scrolls independently above the composer
- [ ] Auto-scrolls to last message when new messages arrive
- [ ] Header shows current Mode and (optionally) current Model
- [ ] Context chips (selected files) render above the composer
- [ ] Mention suggestions (for files) appear at caret position and insert `@filename`
- [ ] Text input supports multi-line, Enter sends (optional future improvement)
- [ ] Buttons: Send (primary), Cancel (secondary)

## Message Rendering

- [ ] Renders text parts (`{ type: 'text', text }`)
- [ ] Renders file resource links (`{ type: 'resource_link', uri, text? }`)
- [ ] Renders inline resource text blocks (`{ type: 'resource', resource: { text, uri } }` up to size limit)
- [ ] Renders images (data URI)
- [ ] Renders audio (data URI, HTML5 `<audio>`)
- [ ] Renders terminal content (`{ type: 'terminal', output }`)
- [ ] Renders diffs with an "Apply" action via `diff.apply`
- [ ] Unknown parts render as JSON for debugging

## Content Attachment (Context)

- [ ] Add files as context chips
- [ ] Inline text for small files (<= 256KB) using `{ type: 'resource', resource: { text, uri } }`
- [ ] Use `{ type: 'resource_link', uri }` for large files

## ACP WebSocket Operations (service: `acp`)

- [ ] `connect` — initialize agent, observe `agent_initialized` event
- [ ] `session.new` — create session; store `sessionId` and `modes`
- [ ] `prompt` — submit `ContentBlock[]` with `sessionId`
- [ ] `cancel` — cancel in-flight prompt
- [ ] `permission` — respond to tool permission prompts
- [ ] `session.setMode` — switch mode (camelCase payload)
- [ ] `models.list` — optional; disable UI if empty
- [ ] `model.select` — optional; select model when supported
- [ ] `diff.apply` — apply newText to a file path (safeguarded on server)

## Streaming Events Handling (type: `session_update`)

- [ ] Normalize updates that come as `type` or `sessionUpdate`
- [ ] Ignore meaningless `(no content)` text placeholders in chat stream
- [ ] Map message chunks to bubbles:
  - [ ] `user_message_chunk`
  - [ ] `agent_message_chunk`
  - [ ] `agent_thought_chunk` (render as assistant with thought meta)
- [ ] Tool calls:
  - [ ] Support both `tool_call` and `tool_call_update`
  - [ ] Accept content in `update.content` or `update.tool_call.content`
  - [ ] Render header (status, name, id, path from `rawInput`)
  - [ ] Render content blocks: text/image/audio/diff/terminal/resource_link
- [ ] Other updates:
  - [ ] `plan` — render readable bullet plan
  - [ ] `available_commands_update` — support `availableCommands` and `available_commands`
  - [ ] `mode_updated` or `current_mode_update` — update `currentModeId` and show status line

## Permissions Flow

- [ ] Show modal when `permission_request` arrives (request/options)
- [ ] Post `permission` with `requestId` and selected `optionId`
- [ ] Handle `cancelled` outcome

## File System & Git (via WebSocket services `fileSystem` and `git`)

- [ ] File tree fetch for mentions/context (`fileSystem.tree`)
- [ ] File open for inline text (`fileSystem.open`)
- [ ] Git status for listing changed files used by mentions

## Error Handling & Recovery

- [ ] If a prompt fails with missing session, create new `session.new` then retry once
- [ ] Map 401 / `Authentication required` to auth UI when applicable
- [ ] Guard WebSocket RPC calls with timeouts and fallbacks

## Performance & DX

- [ ] Append-only chat list with minimal re-renders
- [ ] Avoid flooding with raw events in the user chat — keep a separate debug panel if needed
- [ ] Graceful handling of large diffs (truncate preview in UI)

## References

- `src/webview/react-frontend/src/pages/ChatPage.tsx`
- `src/webview/react-frontend/src/pages/ACPPage.tsx`
- `src/cli/server.ts` (WebSocket services: `acp`, `fileSystem`, `git`, `tunnels`)
- `src/acp/AcpHttpController.ts` (ACP handlers; emits events to `AcpEventBus`)
- `docs/guide/ACP-parsing.md` (WebSocket-based ACP guide)
