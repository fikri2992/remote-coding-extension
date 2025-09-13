# Terminal Commands (Process Manager) — Design Plan

This plan proposes a new, mobile‑friendly “Terminal Commands” experience that focuses on spawning and managing processes, not on interactive PTY shells. It replaces the need to ship `src/webview/react-frontend/src/pages/TerminalPage.tsx` and provides a safer, simpler UX for starting, monitoring, and cancelling tasks.

Key paths referenced:
- Interactive terminal (buggy; do not ship): `src/webview/react-frontend/src/pages/TerminalPage.tsx`
- ACP page and terminal RPC usage: `src/webview/react-frontend/src/pages/ACPPage.tsx`, `src/acp/ACPConnection.ts`, `src/acp/AcpHttpController.ts`, `src/cli/server.ts`
- WebSocket provider: `src/webview/react-frontend/src/components/WebSocketProvider.tsx`

---

## Goals

- Provide a mobile‑friendly, non‑interactive process manager for commands like:
  - npm run dev, npm run build
  - docker build / docker compose up -d
  - node ace serve --watch
- Show a list of running and recently finished commands with statuses.
- Allow cancel/kill and release (detach) operations.
- Persist process history locally so users can quickly re‑run commands.
- Avoid xterm/PTY complexity entirely; rely on ACP terminal RPCs and WS event bridge.

---

## Architecture Overview

- Frontend page: `TerminalCommandsPage.tsx` under `src/webview/react-frontend/src/pages/`.
- State: a lightweight `ProcessStore` (React context + reducer) to track processes and outputs with localStorage persistence.
- Transport: WebSocket via `useWebSocket()`.
  - Spawn: `sendAcp('terminal.create', { command, args, cwd?, outputByteLimit? })` → returns `{ terminalId }`.
  - Pull output: `sendAcp('terminal.output', { terminalId })` → `{ output, truncated, exitStatus }`.
  - Kill: `sendAcp('terminal.kill', { terminalId })`.
  - Release: `sendAcp('terminal.release', { terminalId })`.
  - Wait: `sendAcp('terminal.waitForExit', { terminalId })` → resolves when process ends.
- Live events (optional):
  - Subscribe to `addMessageListener` and handle ACP-bridged events (from `src/cli/server.ts` bridge using `AcpEventBus`):
    - `type: 'terminal_output'` → incremental chunks
    - `type: 'terminal_exit'` → exit status

---

## Data Model

Process item shape (frontend only; persisted to localStorage):
```
{
  id: string,                // local UUID
  terminalId?: string,       // returned by ACP when started
  command: string,
  args: string[],
  cwd?: string,
  status: 'idle'|'starting'|'running'|'exited'|'killed'|'released'|'error',
  exitCode?: number,
  signal?: string,
  createdAt: number,
  updatedAt: number,
  output: string,            // rolling buffer (with max length)
  truncated?: boolean,
  outputByteLimit?: number,  // forwarded to ACP to bound memory
}
```

Implementation notes:
- Keep `output` capped (e.g., 1–2 MB). If exceeded, trim from the head.
- `outputByteLimit` in `terminal.create` lets the backend cap buffer; we’ll also trim locally.
- When `terminal_exit` arrives or `waitForExit` resolves, set `status: 'exited'` and record `exitCode`/`signal`.

---

## UI/UX (Mobile-first)

- Header: “Terminal Commands” + quick presets.
- Presets (one-tap chips):
  - `npm run dev`
  - `npm run build`
  - `docker compose up -d`
  - `docker build -t myimage .`
  - `node ace serve --watch`
- Command input bar:
  - Two fields: `Command` and `Args` (space-separated), optional `CWD` dropdown/field
  - Buttons: `Run`, `Save preset` (optional), `Clear`
- Processes list:
  - Cards with: command line, cwd, status badge, elapsed time, last activity
  - Actions per item: `Refresh`, `Kill`, `Release`, `Wait`, `Copy logs`, `Remove`
  - Expandable output section (collapsible) with live updates when possible
- Global actions: `Refresh All`, filter: `All | Running | Finished`.

Accessibility and mobile details:
- Large tap targets (min 44px), sticky bottom action bar for `Run`.
- Infinite scroll for history, search by command text.
- When a process is running, show a subtle live indicator and `auto-refresh` toggle.

---

## State Management

- `ProcessStore` provides:
  - actions: `addProcess`, `updateProcess`, `appendOutput`, `setStatus`, `removeProcess`.
  - effects: `startProcess`, `refreshOutput`, `killProcess`, `releaseProcess`, `waitForExit`.
  - persistence: write-through to localStorage on each reducer update.
  - hydration: load from localStorage on mount; clean up stale `running` to `unknown` with a “Recover” button that calls `terminal.output` then `waitForExit`.

---

## Backend Contract (verified)

- WS service `acp` handles:
  - `terminal.create`, `terminal.output`, `terminal.kill`, `terminal.release`, `terminal.waitForExit` in `src/cli/server.ts` via `AcpHttpController`.
- ACP events bridged to WS broadcast in `src/cli/server.ts` line ~462–479:
  - `terminal_output` and `terminal_exit` are sent to all clients.
- `WebSocketProvider.tsx` exposes:
  - `sendAcp(op, payload)` returning a Promise.
  - `addMessageListener(handler)` to subscribe to any WS messages (e.g., `type: 'terminal_output'`).

---

## Error Handling & Safety

- When `sendAcp` fails (agent not connected / auth required):
  - Show CTA: “Open ACP to connect/authenticate”, deep-link to `/acp`.
- Kill vs Release:
  - Kill ends the process.
  - Release detaches tracking; item becomes `released` and no longer pullable.
- Prevent duplicates:
  - Debounce Run button and disable while `starting`.

---

## Telemetry & Limits

- Use `outputByteLimit` (e.g., 2–4 MB) when creating terminals.
- Locally cap `output` to ~1–2 MB to avoid bloating React state.
- Optional auto-refresh (e.g., every 2–5s) for running processes when no live chunks come.

---

## Persistence & Multi‑Device Sync

- Server‑side persistence: maintain a durable list of terminal commands in a JSON file, e.g., `.on-the-go/acp/terminal-commands.json`.
  - Implement a `TerminalCommandsStore` (Node) with `init()`, `upsert()`, `update()`, `list()`, `remove()`, `clear()`.
  - Hook into ACP controller (`AcpHttpController`) to:
    - On `terminal.create`: upsert `{ terminalId, command, args, cwd, status: 'running', createdAt }`.
    - On `terminal.kill`/`terminal.release`: update `{ status: 'killed'|'released' }`.
    - On ACP `terminal_exit` event: update `{ status: 'exited', exitCode, signal }`.
  - Broadcast `terminal_command_update` over WebSocket whenever a record changes.

- WS API (new `acp` ops):
  - `terminal.commands.list` → returns the persisted list for hydration on any device.
  - `terminal.commands.remove` → remove a record by `terminalId`.
  - `terminal.commands.clear` → wipe all records (admin/dev tool).

- Client hydration (TerminalCommandsPage):
  - On mount (and on reconnect), call `sendAcp('terminal.commands.list')` and merge into local UI state.
  - Subscribe to `terminal_command_update` to live‑sync across devices.
  - Continue using `terminal.output` for logs on demand; do not persist output server‑side.

Security/limits:
- Do not store logs server‑side to avoid bloat; logs are fetched via `terminal.output` when needed.
- Cap client output buffers locally as described above.

---

## Routing & Menu

- Add route `/terminal-commands` in `src/webview/react-frontend/src/router.tsx` with component `TerminalCommandsPage`.
- Add a new left-nav/menu item “Terminal Commands”.

---

## Phased Implementation

1) MVP
- Page + minimal store.
- Run process, list card with status, manual Refresh, Kill, Wait.
- Persist to localStorage, basic presets.

2) Live updates & polish
- Handle `terminal_output` and `terminal_exit` events to append logs and close items.
- Copy logs, filter, search, mobile affordances.

3) Advanced
- Preset manager, per-item auto-refresh, CWD selector with recent paths, colorized output (optional), export logs.

---

## Testing Matrix

- Commands: npm build, npm dev (long), docker build, docker compose up -d, node ace serve --watch.
- Windows shell resolution (ACP uses `shell: true` on win32).
- Disconnected ACP agent flow.
- Buffer growth and truncation behavior.
- Multiple concurrent processes.
