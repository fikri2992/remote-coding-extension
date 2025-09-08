**Kiro Remote CLI — Design + Plan**

This document captures requirements, scope, and a technical plan to build a standalone CLI that implements Kiro Remote’s key functionality without relying on the VS Code API. The goal is a first‑class terminal tool that can be installed and used globally, while remaining compatible with the existing React UI via an optional local HTTP/WebSocket server.

**Goals**
- Deliver core features as a Node.js CLI (no VS Code API dependency).
- Provide an optional server (`serve`) that exposes the same protocol used by the webview (HTTP + WebSocket), enabling the existing React UI to connect.
- Offer robust interactive terminal support with `node-pty`, plus a fallback engine.
- Manage the `.remote-coding` workspace structure (prompts/results) directly from CLI.
- Include common developer workflows (files, git, tunnels) in portable commands.

**Non‑Goals**
- Global OS‑level key injection or desktop automation.
- Shipping a GUI; the React app remains separate and can connect to the CLI server.

**Scope (Functional)**
- Terminal
  - Start interactive shells (`bash`, `zsh`, `fish`, `powershell`, `cmd`), resize, and stream I/O using `node-pty`.
  - Record transcripts and export logs.
  - Fallback pseudo‑terminal “line”/“pipe” engine when PTY is unavailable.
- Files
  - Workspace‑rooted operations: `tree`, `open`, `create`, `delete`, `rename`, `watch`.
  - Safety: prevent escaping the workspace root (unless `--unsafe`).
- Prompts (`.remote-coding`)
  - Ensure structure: `/.remote-coding/{prompt,result}`.
  - Create prompt files `<timestamp>_<rand5>.txt` with input text.
  - List/search prompts and results; open/view.
  - Optional categories/tags index (JSON under `categories/index.json`).
- Git
  - `status`, `log`, `diff`, `branch`, `commit`, `push`, `pull`, `show` using `child_process.spawn`.
  - Timeouts and clear error messages.
- Tunnels (optional, best‑effort)
  - `cloudflared` helper: install path detection, start/stop quick or named tunnels.
  - Emit public URL to stdout and write to a local state file.
- Config
  - Load from `~/.kiro-remote/config.json` and per‑workspace `.kiro/config.json`.
  - Override via CLI flags and environment variables.
- Server (optional)
  - `serve` subcommand starts HTTP + WebSocket server exposing the same protocol the React UI expects.
  - CORS/same‑origin allowlist, structured logging, graceful shutdown.

**Non‑Functional Requirements**
- Cross‑platform: Windows (ConPTY), macOS, Linux.
- Node 18+.
- Clear logs with levels (`--verbose`, `--debug`).
- Secure defaults (no path traversal, redact secrets in logs).

**High‑Level Architecture**
- `@kiro/cli` (bin entry): argument parsing, command dispatch.
- Core services (framework‑agnostic):
  - `TerminalService` (PTY + fallback engines)
  - `FileSystemService` (root‑scoped ops)
  - `GitService` (spawn wrappers, parsers)
  - `TunnelService` (cloudflared process manager)
  - `PromptService` (manage `.remote-coding` structure)
- Optional `Server`:
  - Express (or Fastify) + `ws` for WebSocket.
  - Routes: health, static (optional), and WebSocket upgrade at `/ws`.
  - Reuse core services; map WebSocket messages to service calls.

**CLI UX (Proposed)**
- Binary: `kiro`
- Global flags: `--workspace <path>`, `--config <file>`, `--verbose`, `--debug`.
- Commands:
  - `kiro shell [--engine auto|line|pipe] [--cwd <dir>]` — interactive PTY shell (default engine `auto`).
  - `kiro exec <cmd...>` — run a one‑shot command (returns code/output).
  - `kiro files tree [path] [--json]` — print directory tree.
  - `kiro files open <path> [--json]` — read a file (with truncation notice for large files).
  - `kiro files create <path> [--stdin|--content <text>]` — ensure parent and write.
  - `kiro files rm <path> [--recursive]` — delete file/dir.
  - `kiro files mv <src> <dst>` — rename/move.
  - `kiro files watch [path] [--json]` — stream FS events.
  - `kiro prompt new [--stdin|--content <text>] [--category <name>] [--tags a,b]` — create `<timestamp>_<rand5>.txt` under `/.remote-coding/prompt`.
  - `kiro prompt list [--bucket prompt|result|all] [--json]` — list files.
  - `kiro prompt show <id|path>` — open/print a prompt file.
  - `kiro git <status|log|diff|branch|commit|push|pull|show> [...args]` — thin wrappers over git.
  - `kiro tunnel start [--name <named>]` — start cloudflared, print URL.
  - `kiro tunnel stop` — stop.
  - `kiro serve [--port <n>] [--host <addr>]` — start HTTP + WebSocket server.

**Terminal (node‑pty) Details**
- Shell resolution:
  - Windows: prefer `powershell.exe`, fallback to `cmd.exe`.
  - macOS/Linux: use `$SHELL` or `/bin/bash`.
- Environment: merge process env; inject `TERM=xterm-256color` if missing.
- Resize: handle `SIGWINCH` (TTY) and explicit `--cols/--rows` passed from clients.
- Fallback engines:
  - `line`: echo typed input locally and run per line via `child_process.spawn`.
  - `pipe`: keep a long‑lived child process with stdin/stdout piping.
- Redaction: scrub tokens in logs (GitHub/Cloud, JWT, etc.).

**File System Details**
- Workspace root resolution; normalize paths; block traversal outside root by default.
- `open` size guard (e.g., 1MB cap) with truncation notice.
- `watch` implemented via `chokidar` (or native fs.watch with care on Windows).

**Prompt Management**
- Structure:
  - `/.remote-coding/prompt/` — inputs created by `prompt new`.
  - `/.remote-coding/result/` — outputs/artifacts created by other tools or future flows.
- Filename: `<epochMs>_<rand5>.txt`.
- Optional metadata: front‑matter block or sidecar JSON.
- Index: `/.remote-coding/categories/index.json` (category -> list of relative paths).

**Git Integration**
- Spawn `git` with cwd at the workspace root.
- Timeouts and helpful error messages (e.g., “not a git repository”).
- Output JSON option for tools; human format by default.

**Tunnel Integration**
- Detect `cloudflared` in PATH; guide install if missing.
- `start`:
  - quick tunnel: `cloudflared tunnel --url http://localhost:<port>` and parse public URL.
  - named tunnel: honor `--name` and load credentials if available.
- `stop`:
  - track PID/state file; kill process gracefully.

**Server Mode**
- `kiro serve` starts:
  - HTTP server (Express/Fastify) for health and static hosting (optional).
  - WS server at `/ws` using `ws`.
- Protocol: reuse current message schema (`type`, `id`, `data` with `fileSystem`, `terminal`, `git`).
- Origin policy: allow local and same‑origin tunnel hosts.

**Configuration**
- Search order (first match wins):
  - CLI flags
  - Env vars (`KIRO_*`, e.g., `KIRO_HTTP_PORT`, `KIRO_TERMINAL_ENGINE`)
  - Workspace config: `<workspace>/.kiro/config.json`
  - User config: `~/.kiro-remote/config.json`
- Example keys: `httpPort`, `terminal.engine`, `tunnel.name`, `log.level`.

**Directory Layout (Proposed)**
- `packages/cli/` — CLI source (bin + commands + services)
- `packages/core/` — shared services (Terminal/FileSystem/Git/Tunnel/Prompt)
- `packages/server/` — HTTP+WS server (thin wrapper around core)
- `packages/protocol/` — shared TypeScript interfaces for WS messages

**Dependencies**
- Required: `node-pty`, `ws`, `commander` (or `yargs`), `chokidar`.
- Optional: `express`/`fastify`, `pino` (logging), `kleur` (colors), `which` (resolve binaries).

**Security**
- Path guard: block operations outside root unless `--unsafe`.
- Redact secrets from logs (token patterns), limit payload sizes.
- CORS/origin checks for `serve`.

**Testing Strategy**
- Unit: path resolution, redaction, parsers.
- Integration: PTY spawn/resize, FS ops, git commands (with temp repos), cloudflared (mockable).
- E2E: `kiro serve` + React frontend connecting via WS.

**Packaging & Distribution**
- Build with TypeScript to `dist/`.
- `bin/kiro` with `#!/usr/bin/env node` shim.
- Publish `@kiro/cli` to npm; support `npm i -g @kiro/cli`.

**Phased Plan**
1) Extract Core (VS Code independent)
   - Move/rewrite services from `src/server` to `packages/core` where they use only Node APIs.
   - Replace VS Code FS APIs with `fs/promises` + `chokidar`.
   - Keep message interfaces in `packages/protocol`.
2) Implement CLI Skeleton
   - `kiro <command>` routing, config loader, logging.
   - Add `files` and `prompt` commands end‑to‑end.
3) Terminal (PTY + Fallback)
   - `kiro shell`, `kiro exec`, `--engine` and resize support.
   - Redaction and transcript support.
4) Git Commands
   - Thin wrappers with JSON/human output.
5) Server Mode
   - `kiro serve` exposing WS protocol; connect existing React app.
   - CORS/origin policy and graceful shutdown.
6) Tunnels (Optional)
   - Quick/named tunnel start/stop + URL discovery.
7) QA & Packaging
   - Cross‑platform tests (Windows/macOS/Linux).
   - Publish npm package and binaries.

**Open Questions**
- Do we need a plugin system for user‑defined commands?
- Should the server host the React build or require a separate static host?
- Preferred argument parser (`commander` vs `yargs`)?
- Default transcript format (ANSI, raw, or JSON frames)?

**Examples**
- Create a prompt from stdin:
  - `echo "Deploy plan" | kiro prompt new --stdin`
- Start an interactive shell with pipe engine:
  - `kiro shell --engine pipe --cwd ~/project`
- Serve WS API for the React UI:
  - `kiro serve --port 3900`

This plan keeps the CLI portable, secure, and compatible with the current UI protocol while cleanly separating Node‑only core services from VS Code specifics.

