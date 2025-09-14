# CLI Enhancements Plan: Tunnel + Init

## Goals

- Add `--tunnel` to `start` to expose the dev server via Cloudflare Tunnel (ephemeral via `cloudflared`).
- Show local and network URLs like Vite, plus the tunnel URL.
- On `init`, ensure `.on-the-go` is added to `.gitignore`.
- Detect if the project is a Git repo; if not, offer to `git init`. If declined, persist a config flag to disable the Git menu.

## A. `start` Command: Tunnel Support

### UX

```bash
kiro start -p 3900 --tunnel

# Output (example):
  Local:   http://localhost:3900
  Network: http://192.168.1.23:3900
  Tunnel:  https://abcde12345.trycloudflare.com
```

### Behavior

- Port resolution order: CLI flag `-p|--port` > env var > config default.
- Host binding:
  - Default stays as-is today (likely `localhost`).
  - If `--tunnel` is set, bind to `0.0.0.0` to make Network URL reachable on LAN and ensure `cloudflared` can reach the service.
- Start the dev server first; once listening, start the tunnel pointing to `http://localhost:PORT`.
- Detect and verify `cloudflared` availability:
  - If present on PATH, spawn ephemeral tunnel: `cloudflared tunnel --url http://localhost:PORT`.
  - Parse its stdout/stderr to capture the public URL (e.g., `https://*.trycloudflare.com`).
  - If not found, print a friendly hint to install with a one-liner and continue without tunnel (do not fail the server).
- Display addresses:
  - Local: `http://localhost:PORT` (always)
  - Network: `http://<lan-ip>:PORT` (first non-internal IPv4)
  - Tunnel: captured `trycloudflare.com` URL (only when `--tunnel` and successful)
- Graceful shutdown: on process exit (SIGINT/SIGTERM), terminate `cloudflared` child and server.

### Implementation Notes

- Language-agnostic flow:
  1) Parse args (`--port`, `--tunnel`, optional `--host`).
  2) Start server; listen callback fires when port is bound.
  3) Compute and print Local + Network URLs.
  4) If `--tunnel`, spawn `cloudflared` child, capture URL via log parsing, then print Tunnel URL.
  5) Wire process signals to clean up the child.

- Local network IP resolution:
  - Pick first non-internal IPv4 from active interfaces (e.g., Node: `os.networkInterfaces()`; Python: `psutil.net_if_addrs()` fallback; Rust: `get_if_addrs`).

- `cloudflared` parsing hints:
  - Look for lines containing `trycloudflare.com` or `https://...` in output.
  - Provide a timeout (e.g., 10s) to avoid hanging if tunneling fails; print a warning and continue.

## B. `init` Command: Git + Ignore

### UX

```bash
kiro init

# Prompts if not a Git repo
? No Git repo detected. Initialize one now? (Y/n) y

# Effects
- Adds `.on-the-go` to `.gitignore` (creates the file if missing).
- If accepted, runs `git init`.
- If declined, writes CLI config to disable the Git menu.
```

### Behavior

- Ensure `.gitignore` contains `.on-the-go` (append if missing; newline-safe).
- Detect Git repo via `.git` directory or `git rev-parse --is-inside-work-tree`.
- If not a repo:
  - Prompt to initialize Git.
  - On accept: run `git init` and report success/failure.
  - On decline: write a persistent project config to disable the Git menu.

### Config Persistence

- Store a small project config (JSON) to track features, e.g. at one of:
  - `.on-the-go/config.json` (preferred, self-contained)
  - or project-level file like `.kiro-remote.json`

- Proposed shape:
```json
{
  "features": {
    "gitMenu": false
  }
}
```

- CLI reads this config at startup to toggle Git-related UI/menu.

## C. Testing

- Arg parsing: `start -p`, `--tunnel`, and `init` flows.
- URL printing: ensure Local/Network formatting matches Vite-like output.
- Tunnel: mock child process for `cloudflared` to simulate output and capture URL; verify timeouts and error messaging.
- Init: verify `.gitignore` updates and config writing when Git init refused.

## D. Docs

- Update README/CLI usage with examples for `--tunnel` and `init` behavior.
- Add troubleshooting notes for `cloudflared` installation and firewall/port binding.

## E. Open Questions

- Should we auto-install `cloudflared` if missing (prompted), or just instruct?
- Always bind to `0.0.0.0` when `--tunnel`, or only when `--host` is specified?
- Preferred location/name for the project config file?

## F. Work Breakdown (Implementation Steps)

1. Locate CLI entrypoints and command definitions.
2. Add `--tunnel` flag to `start`; ensure host binding rules.
3. Implement LAN IP detection and URL printing.
4. Integrate `cloudflared` spawn, parsing, and cleanup.
5. Wire `init` to update `.gitignore` with `.on-the-go`.
6. Detect Git repo; prompt; run `git init` on accept.
7. Persist config to disable Git menu when declined.
8. Add tests and update docs.

