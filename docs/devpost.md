# Web Agent Client — Coding on the go via Agent Client Protocol (ACP)

## Inspiration
As a software engineer who just entered a new phase of life, I became a new parent while working from home. I quickly realized I needed more flexibility. I want an agentic coding assistant I can access directly from my phone, not something that forces me to be at my desk.

The market didn’t offer what I needed:
- Extra subscriptions — If I already pay for Kiro or Claude Code, but want remote coding, many tools force another subscription (e.g., Devin-like products). It’s fragmented and costly.
- Cloud lock‑in — Most “remote coding” tools are tied to cloud environments. My day‑to‑day uses local MySQL, Redis, Docker. Running those remotely either doesn’t work or gets prohibitively expensive. Migrating to cloud DBs/serverless isn’t realistic for a fixed team stack.
- Broken workflow continuity — Switching between mobile and desktop isn’t smooth. I end up juggling PRs, merges, and context switching. I can’t just pick up where I left off—it feels like two disconnected worlds.

What I actually want:
- Read code and files from my phone.
- Assign an AI agent to search, analyze, and diagnose.
- Fix small bugs or at least identify issues.
- Run tests or scripts from my phone.

Let the agent handle the boring, repetitive research from the codebase so that when I’m done changing diapers or playing with my kids, I can sit down at my computer and immediately continue—with all the insights, research, and investigations ready.

> “It’s like being Batman and having Alfred. Alfred doesn’t fight crime—Batman does—but Alfred prepares the Batmobile, the suit, and tidies the documents.”

I don’t want an AI that replaces coding (my job). I want an assistant that removes the tedious parts so I can focus on building.

## What it does
Web Agent Client is a local CLI that serves a React web UI and exposes a WebSocket backend so you can talk to an ACP‑compatible coding agent (today: Claude Code ACP) from any browser, including mobile.

Key capabilities (grounded in the codebase):
- ACP chat with streaming updates
  - Frontend pages `src/webview/react-frontend/src/pages/ChatPage.tsx` and `src/webview/react-frontend/src/pages/ACPPage.tsx` render sessions, chat messages, tool calls, diffs, terminals, and logs.
  - Backend ACP controller `src/acp/AcpHttpController.ts` bridges WebSocket operations to the agent over JSON‑RPC via `src/acp/ACPConnection.ts`.
  - Streaming events (`session_update`, `permission_request`, `agent_stderr`, etc.) are broadcast through `AcpEventBus` and delivered to all clients via `src/server/WebSocketServer.ts`.
- Contextual prompting from your repo
  - Browse files and changed files, then add them as in‑line context (`resource`) or as links (`resource_link`). See `src/webview/react-frontend/src/pages/ACPPage.tsx` and WS “fileSystem”/“git” services wired in `src/cli/server.ts`.
  - Inline @file mentions with fuzzy suggestions (`MentionSuggestions.tsx`), so you can quickly reference files while typing on mobile.
- Lightweight Git and File System operations
  - WebSocket `git` service: status, log, diff, show, add, commit, branch ops backed by `src/cli/services/GitService.ts` and routed in `src/cli/server.ts`.
  - WebSocket `fileSystem` service: read tree, open files with safe limits (see `CLIFileSystemService` and `FileSystemConfig`).
- Terminal from the agent or UI
  - Agent‑initiated terminals are created through JSON‑RPC handlers in `ACPConnection` (`terminal/create`, `terminal/output`, etc.).
  - UI can also create and read terminal output via WS ops mapped in `AcpHttpController` and routed in `src/cli/server.ts`.
  - Extra safety in `src/cli/services/TerminalSafety.ts` to validate dangerous commands when executing locally.
- Apply diffs directly
  - Diff blocks from the agent can be applied safely through `diff.apply` → `AcpHttpController.applyDiff()`.
- Session persistence and recovery
  - Sessions, threads, and modes are stored under `.on-the-go/acp/` with disk‑backed stores (`SessionsStore`, `ThreadsStore`, `ModesStore`).
  - If a session goes missing, the backend auto‑recovers to a new one and the UI adopts it (`session_recovered`).
- Cloud tunnel support (optional)
  - A `tunnels` WS service (Cloudflared) is registered in `src/cli/server.ts` to make sharing local port(s) easier.

How you use it:
- `npm run dev:full` for dev (backend + HMR frontend), or `npm run start:cli` for a single process that serves the built UI.
- Open `http://localhost:3900`, hit Connect (optionally supply `ANTHROPIC_API_KEY`), create a session, and start prompting.

## How we built it
- Monorepo: Node/TypeScript CLI + React frontend, with a workspace for the ACP adapter:
  - Root CLI/web server code in `src/`.
  - React app in `src/webview/react-frontend/`.
  - ACP agent adapter workspace in `claude-code-acp/` (wired through `package.json` workspaces and `build:agent`).
- Unified server architecture
  - `src/cli/server.ts` orchestrates startup:
    - `HttpServer` (`src/server/HttpServer.ts`) serves the React build and handles CORS/security headers.
    - `WebSocketServer` (`src/server/WebSocketServer.ts`) attaches to the same HTTP server at `/ws`, routes typed messages to services, and manages heartbeats.
    - Registers WS services: `terminal`, `git`, `fileSystem`, `tunnels`, and `acp`.
- ACP integration over JSON‑RPC
  - `AcpHttpController` spawns the agent via `ACPConnection.connect()` and maps app operations (`connect`, `session.new`, `prompt`, `permission`, `models.list`, `diff.apply`, and terminal ops) to JSON‑RPC calls.
  - `ACPConnection` auto‑selects JSON‑RPC framing: NDJSON for Claude Code ACP, LSP otherwise. It forwards streaming `session/update` events and terminal output back to the event bus.
  - Windows‑friendly process spawning: `spawn(command.path, command.args, { shell: false, windowsHide: true })` to avoid quoting issues with paths containing spaces.
- Frontend data flow
  - `WebSocketProvider` encapsulates the wire protocol (send/receive, correlation IDs, timeouts) and exposes a `sendAcp(op, payload)` helper.
  - `ChatPage.tsx` and `ACPPage.tsx` render message parts (text, diffs, terminals, file attachments) and listen to streaming events.
  - The chat UI also formats tool‑call titles with readable paths (e.g., shortening absolute paths to `./src/...`)—see `formatToolName()` in `ChatPage.tsx`.
- Persistence & recovery
  - Disk stores under `.on-the-go/acp/` restore recent sessions, threads, and modes on reconnect. On “Session not found,” the backend transparently creates a new session, emits `session_recovered`, and retries the prompt.

References to internal docs:
- ACP lifecycle: `docs/guide/acp-lifecycle.md`
- ACP functionality: `docs/guide/acp-functionality.md`
- Known issue write‑ups: `docs/problem/chat-timeout.md`, `docs/problem/acp-websocket-react-integration.md`

## Challenges we ran into
- ACP vs “ACP” confusion
  - There’s Agent Client Protocol (this project) and Agent Communication Protocols out in the wild—many models/tools conflate the two. Early attempts to “vibe code” the integration led to hallucinations and wrong protocol assumptions. I had to hand‑implement ACP flows using the actual `@zed-industries/agent-client-protocol` and `@zed-industries/claude-code-acp` packages and test iteratively.
- Limited ecosystem support and docs
  - Today, only a couple of adapters/CLIs are available (Claude Code ACP, Gemini CLI is emerging). Docs are sparse; a lot of behavior was learned by reading code, tracing JSON‑RPC, and building smoke tests (`scripts/smoke-acp-ws.js`).
- Pivot away from VS Code hooks
  - The original plan was to use Kiro hooks and a VS Code extension (“kiro on the go”). Hooks can’t trigger from outside the IDE, which broke the remote workflow. I pivoted to a CLI‑served web app with ACP under the hood.
- WebSocket + React integration issues
  - Mismatch between lightweight `WebServer` and `HttpServer` (`setAcpController` missing) caused runtime errors. Documented in `docs/problem/acp-websocket-react-integration.md`. The fix was consolidating on `HttpServer` and attaching the WS upgrade handler at `/ws`.
- Prompt timeout from the UI
  - Default `sendAcp` timeout is 15s. Long tool runs or reconnects could drop the final `acp_response` and show: “acp timeout for op=prompt”. Documented in `docs/problem/chat-timeout.md` with recommended solutions (increase timeout, adopt ack‑then‑stream pattern on the server).
- Cross‑platform process and paths
  - Windows quoting (agent spawn) and path formatting in the UI required careful handling. We disabled shell spawn for the agent, added `shell: false`, and improved tool‑call labeling to be readable across OSes.

## Accomplishments that we’re proud of
- End‑to‑end ACP chat in a browser
  - Connect, create session, send prompts, stream updates, and approve tool permissions—fully over WebSocket frames (`type: 'acp'`, `acp_response`, plus event fan‑out).
- Solid reconnection and session recovery story
  - Heartbeats, client‑side reconnect, and server‑side session recovery on “Session not found” with `session_recovered` notifications.
- Practical developer workflows on mobile
  - File browsing and file previews, Git changed files as context, inline @file mentions, and “apply diff” buttons let me do triage and prep work on the go.
- Safety considerations
  - Command validation and environment sanitization in `TerminalSafetyManager`. File write safety in `applyDiff()` (enforces workspace root).
- Quantitative progress from commits
  - ~192 commits so far, roughly: ~102 feature commits, ~15 fixes, ~15 refactors, ~9 docs updates (counts approximated from `git log` patterns). The project saw several milestone refactors including the WebSocket/HTTP consolidation and ACP session persistence.

## What we learned
- Protocol design details matter
  - NDJSON vs LSP framing, request/response correlation over WS, and “ack‑then‑stream” patterns change UX reliability dramatically.
- Recovery paths are not optional
  - In remote/mobile scenarios, reconnects are frequent. Session recovery and state restoration (threads/modes) make the difference between “works in the lab” and “usable daily.”
- Don’t fight the platform
  - The pivot from VS Code hooks to a CLI‑served web UI unblocked the core use‑case (access from phone) and simplified distribution.

## What’s next for coding on the go
- Ack‑then‑stream prompt handling on the server
  - Immediately ack `prompt` requests and stream updates in events to eliminate client‑side timeouts.
- Smarter response delivery after reconnect
  - Route the final `acp_response` to the most recent connection for a session, not the socket that originated the request.
- Broader adapter support
  - Expand beyond Claude Code ACP, add more ACP‑compatible agents as the ecosystem grows.
- Offline‑friendly queueing and sync
  - Queue prompts/actions while offline and replay on reconnect with conflict handling.
- Mobile UX polish
  - PWA, better touch targets, and an even smoother mention/context flow on small screens.
- Authentication UX
  - Surface adapter‑specific login flows more clearly (e.g., Claude `/login` in terminal), and explore standardizing auth prompts over ACP where possible.

## Architecture at a glance
- Servers
  - `src/cli/server.ts` — Orchestrates HTTP + WS, registers services, bridges the ACP event bus to clients.
  - `src/server/HttpServer.ts` — Static serving + security/CORS; `/api/*` disabled in favor of WS.
  - `src/server/WebSocketServer.ts` — WS upgrade, heartbeats, and typed message routing (`acp`, `git`, `fileSystem`, `terminal`, `tunnels`).
- ACP integration
  - `src/acp/AcpHttpController.ts` — Agent lifecycle, sessions, prompting, permissions, models, diffs.
  - `src/acp/ACPConnection.ts` — JSON‑RPC over stdio, NDJSON/LSP framing, terminal plumbing, and FS helpers.
  - `src/acp/AcpEventBus.ts` — Broadcasts `agent_*`, `session_update`, `permission_request`, `terminal_*` to clients.
- Frontend
  - `src/webview/react-frontend/src/components/WebSocketProvider.tsx` — `sendAcp()` + reconnect/timeout logic.
  - `src/webview/react-frontend/src/pages/ChatPage.tsx` — Chat + context + sessions picker + tool‑call rendering.
  - `src/webview/react-frontend/src/pages/ACPPage.tsx` — ACP console for debugging (connect/auth/session/prompt/terminal/diffs/logs).

## Built with
- TypeScript, Node.js, React
- WebSocket (`ws`), `zod`, `uuid`
- `@zed-industries/agent-client-protocol`, `@zed-industries/claude-code-acp`

## Try it locally
```bash
npm run install:all
npm run dev:full
# then open http://localhost:3900
```

Optionally export `ANTHROPIC_API_KEY` before connecting if your agent requires it.
