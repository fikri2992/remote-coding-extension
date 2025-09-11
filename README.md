# Kiro Remote CLI

Kiro Remote is a CLI tool that runs a local web server and WebSocket backend for remote coding workflows, with ACP (Agent Client Protocol) integration.

## Features

- HTTP server serving a React web UI
- WebSocket backend with connection recovery
- Terminal sessions (pseudo/line-mode and pipe engine support)
- Git and File System operations via CLI backend services
- ACP integration via `@zed-industries/claude-code-acp` (workspace)

## Getting Started

### Install

```bash
git clone <repo>
cd kiro-remote
npm run install:all
```

### Develop

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

### Build

```bash
npm run build        # compile TS + build React
npm run package:cli  # optional: package with pkg
```

### Run

```bash
# build once
npm run build

# start server (also available as a binary via bin)
npm run start:cli

# or directly if added to PATH after packaging
kiro-remote start -p 3900
```

Then open http://localhost:3900 in your browser.

## CLI Commands

- `kiro-remote start [-p <port>] [--skip-build]` – build frontend (unless skipped) and start server
- `kiro-remote status` – print server status
- `kiro-remote stop` – stop server and clean up process files
- `kiro-remote init` – scaffold CLI config in `.on-the-go/config.json`

## ACP (Agent Client Protocol)

An ACP server is included via the `claude-code-acp` workspace. You can run a quick smoke test against the local server:

```bash
# In another terminal with server running on :3900
BASE_URL=http://localhost:3900 node scripts/smoke-acp.js
```

To wire a model provider (e.g., Anthropic), export credentials in your environment before connecting.

## Notes

- This repository no longer ships a VS Code extension. All VS Code-specific code and packaging have been removed from the build.
- The React UI is served from `src/webview/react-frontend/dist` at runtime.

