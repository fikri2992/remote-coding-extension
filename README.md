# Web Agent Client CLI

Web Agent Client is a CLI tool that runs a local web server and WebSocket backend for remote coding workflows, with ACP (Agent Client Protocol) integration.

## Requirements

- Node.js 18 or newer
- macOS, Linux, or Windows

## Features

- HTTP server serving a React web UI
- WebSocket backend with connection recovery
- Terminal sessions (pseudo/line-mode and pipe engine support)
- Git and File System operations via CLI backend services
- ACP integration via `@zed-industries/claude-code-acp` (workspace)

## Install

Using npm (global):

```bash
npm install -g web-agent-client
```

Using npx (no global install):

```bash
npx web-agent-client start -p 3900
```

## Quick Start

```bash
# Start the server (builds frontend on first run)
web-agent-client start -p 3900

# Check status
web-agent-client status

# Stop the server
web-agent-client stop
```

Then open http://localhost:3900 in your browser.

## CLI Commands

Top-level commands:

- `web-agent-client start [-p <port>] [--skip-build]` – build frontend (unless skipped) and start server
- `web-agent-client status` – print server status
- `web-agent-client stop` – stop server and clean up process files
- `web-agent-client init` – scaffold CLI config in `.on-the-go/config.json` and run environment checks

Command groups:

- `web-agent-client fs` – File system operations
  - `tree [path] [--depth N] [--json]`
  - `read <path> [--encoding utf8] [--max-bytes 1024]`
  - `create <path> [--type file|directory] [--content <text>]`
  - `delete <path> [--recursive]`
  - `rename <source> <destination>`
  - `watch <path> [--timeout 60]`
  - `stats <path>`
  - `config [--json] [--save <path>]`
  - `watcher-stats`

- `web-agent-client git` – Git operations
  - `status [--json] [--workspace <path>]`
  - `log [--count N] [--json] [--workspace <path>]`
  - `diff [file] [--json] [--workspace <path>]`
  - `add <files...> [--workspace <path>]`
  - `commit <message> [--files <files...>] [--workspace <path>]`
  - `push [--remote origin] [--branch <name>] [--workspace <path>]`
  - `pull [--remote origin] [--branch <name>] [--workspace <path>]`
  - `branch [--create <name>] [--from <source>] [--switch <name>] [--workspace <path>]`
  - `state [--json] [--workspace <path>]`
  - `find-repos [path] [--json]`
  - `config [--json]`

- `web-agent-client terminal` – Terminal operations
  - `session [--cols 80] [--rows 24] [--cwd <path>] [--persistent] [--engine auto|line|pipe]`
  - `exec <command> [--cwd <path>] [--timeout <ms>]`
  - `config [--json]`
  - `shell`
  - `list`
  - `test-safety <command>`
  - `interactive [--cols 80] [--rows 24] [--cwd <path>] [--engine auto|line|pipe]`

Note: there is also `web-agent-client server` which behaves like `start` with similar options.

## Development

```bash
# Clone and bootstrap
git clone <repo>
cd web-agent-client
npm run install:all

# Develop

- Run server + UI together:
  ```bash
  npm run dev:full
  ```

- Server only (recompiles TS):
  ```bash
  npm run dev:server
  ```

- Frontend only (from `src/webview/react-frontend`):
  ```bash
  npm run dev:frontend
  ```

## Build

```bash
npm run build        # compile TS + build React
npm run package:cli  # optional: package with pkg
```

## ACP (Agent Client Protocol)

An ACP server is included via the `claude-code-acp` workspace. You can run a quick smoke test against the local server:

```bash
# In another terminal with server running on :3900
BASE_URL=http://localhost:3900 node scripts/smoke-acp.js
```

To wire a model provider (e.g., Anthropic), export credentials in your environment before connecting.

### Documentation

- ACP Lifecycle, reconnect, and streaming flow: [docs/guide/acp-lifecycle.md](docs/guide/acp-lifecycle.md)
- ACP Page functionality overview: [docs/guide/acp-functionality.md](docs/guide/acp-functionality.md)

## Notes

- This repository no longer ships a VS Code extension. All VS Code-specific code and packaging have been removed from the build.
- The React UI is served from `src/webview/react-frontend/dist` at runtime.

