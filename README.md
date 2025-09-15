# Coding on the Go CLI

Coding on the Go (COTG) is a CLI tool that runs a local web server and WebSocket backend for remote coding workflows, with ACP (Agent Client Protocol) integration.

## Requirements

- Node.js 22 or newer
- Windows

## Features

- HTTP server serving a React web UI
- WebSocket backend with connection recovery
- Terminal command
- Git and File System operations via CLI backend services
- ACP integration via `@zed-industries/claude-code-acp` (workspace)

## Install

Using npm (global):

```bash
npm install -g coding-on-the-go
```

## Quick Start

```bash
# create the necessary folder and files needed
cotg-cli init
# Start the server (builds frontend on first run)
cotg-cli start -p 3900

```

Then open http://localhost:3900 in your browser.

## Tunnel Mode (Cloudflare)

Expose your local server securely over the internet using an ephemeral Cloudflare Tunnel. This also prints LAN and localhost URLs (similar to Vite):

```bash
# much simpler command
cotg-cli start --tunnel 

# Bind to all interfaces when tunneling, print Local/Network/Tunnel URLs
cotg-cli start -p 3900 --tunnel
```

Example output:

```
All services started successfully!
  Local:   http://localhost:3900
  Network: http://192.168.1.23:3900
  Tunnel:  https://abcde12345.trycloudflare.com

WebSocket: Connected
Server PID: 12345
```

Notes:
- Requires `cloudflared` on PATH. If missing, run `cotg-cli init` to install or see Cloudflare Tunnel docs.
- The tunnel is terminated when you stop the CLI (Ctrl+C).

## Project Init

Initialize the `.on-the-go` folder, ensure `cloudflared` setup, and prepare your workspace:

```bash
cotg-cli init
```

What it does:
- Creates `.on-the-go/` with `config.json`, `prompts/`, and `results/` (if absent).
- Ensures `.on-the-go` is listed in `.gitignore`.
- Checks for a Git repository and offers to run `git init`.
  - If you decline, it updates `.on-the-go/config.json` to disable the Git menu in the UI.
- Optionally installs `cloudflared` and helps authenticate the ACP agent.

## Development

```bash
# Clone and bootstrap
git clone <repo>
cd coding-on-the-go
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

## License

This project is licensed under the MIT License. See the `LICENSE` file at the repository root for full text.

