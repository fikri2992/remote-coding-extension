# Solution 2 — External CLI Orchestrator (Outside VS Code)

Status: Draft

Objective: Move terminal orchestration out of the VS Code extension into a standalone CLI/daemon. The React frontend connects to this CLI for terminal sessions, file ops, and AI tool runs. VS Code becomes optional: used for editing, quick actions, or as a thin bridge when needed. This sidesteps extension sandbox/ABI constraints.

## Summary

We build `kiro-cli` (Node+node-pty packaged, or Go/Rust single binary) that:
- Hosts HTTP/WebSocket APIs for terminal, files, git, and AI commands
- Manages real PTY sessions natively (no Electron ABI issues)
- Optionally relays actions to VS Code when desired (open file, run command)

React frontend points to `kiro-cli` instead of the VS Code extension server. If the user still wants VS Code integration, the CLI can trigger VS Code actions using stable bridges (see below), without loading native modules inside the extension.

## Why a CLI helps

- Avoids Electron/Node ABI mismatch entirely (node-pty or native PTY lives in the CLI)
- Ships once per OS/arch (no VSIX native packaging pain)
- Easier background service behavior and process control

## How to send commands to VS Code from the CLI

Several bridging patterns; they can co-exist for resilience:

1) VS Code URI Handler (recommended)
- Extension registers a `vscode.UriHandler`; CLI opens a `vscode://` deep link with payload.
- Good for: open file, reveal folder, run extension commands, bring window to front.
- Flow:
  - CLI: `open "vscode://<publisher>.<extid>/run?cmd=<commandId>&payload=<token>"`
  - Extension: `handleUri(uri)` parses query and executes `vscode.commands.executeCommand(cmd, payload)`.
- Pros: Cross‑platform; works when VS Code is already running; minimal permissions.
- Cons: Query length limits; for large payloads do an HTTP fetch handshake.

2) code CLI shell-out
- CLI invokes `code -g file:line` or `code --reuse-window <path>`.
- Good for: open files, focus VS Code on a resource.
- Pros: Simple and robust.
- Cons: Not for arbitrary extension commands or rich payloads.

3) Extension HTTP/WS gateway (if extension is installed)
- Keep a very light extension that exposes `openFile`, `revealInExplorer`, `executeCommand` over localhost WS/HTTP.
- CLI calls it directly.
- Pros: Powerful and structured; no URI size limits.
- Cons: Requires the extension to run a local server (already present in this repo).

4) File-based IPC fallback
- CLI writes `.kiro/inbox.jsonl`; extension watches and executes; replies in `.kiro/outbox.jsonl`.
- Pros: No ports/firewalls; works offline.
- Cons: Higher latency; file‑watch quirks.

Recommended combo: URI Handler for quick actions + `code -g` for open file; keep HTTP/WS gateway for richer actions where the extension is present.

## Architecture Options

A) Node CLI with node-pty (packaged)
- Stack: Node 20 LTS + `node-pty`, `ws`/`uWebSockets.js`, `express`.
- Package via `pkg`/`nexe` so ABI matches packaged Node runtime.
- Pros: Reuse existing TypeScript logic; fast iteration.
- Cons: Native build pipeline for node-pty per OS/arch (but done once in CI, not at user install).

B) Go/Rust single-binary CLI (preferred for durability)
- Stack: Go with ConPTY/pty libs or Rust with portable-pty.
- Expose WS/HTTP; PTY is pure native; no Node ABI.
- Pros: Small static binaries, fewer moving parts; Windows ConPTY straightforward.
- Cons: Rewrite of PTY/session layer; less reuse of Node code.

Either way, React frontend consumes the same `create/input/resize/data/exit` PTY API as today.

## How it plays out (user flow)

- User runs `kiro-cli serve`.
- CLI prints local URL and optional public URL (tunnel).
- React app connects to CLI, presents terminal, files, git, AI tools.
- On “Open in VS Code”, CLI does:
  - For a file: `code -g <path>:<line>` (immediate), and/or
  - `vscode://<publisher>.<extid>/open?path=<rel>&line=<n>` (lets extension handle path mapping/workspace context).
- If the extension is installed and listening, CLI can also call its HTTP/WS for deep actions (e.g., run `workbench.action.quickOpen` or custom commands) when needed.

## Pros / Cons

Pros:
- No VSIX native modules; avoids Electron ABI
- True PTY support; TUIs work when using native PTY in CLI
- Works with or without VS Code
- Cleaner separation of concerns (CLI = engine; VS Code = client/bridge)

Cons:
- Another process to manage (install/launch/upgrade)
- Some VS Code APIs still require an extension (e.g., decorations, diagnostics)
- Double surface area if both CLI and extension coexist

## Security & Networking

- CLI binds to `127.0.0.1` by default; optional token header for WS/HTTP
- For tunnels, issue time‑limited tokens and restrict methods
- When bridging to VS Code via URI, validate payloads in the extension and enforce allowlists

## Implementation Sketches

URI Handler in the extension:

```ts
// src/extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.window.registerUriHandler({
    handleUri: async (uri) => {
      const params = new URLSearchParams(uri.query);
      const cmd = params.get('cmd') || 'vscode.open';
      const path = params.get('path');
      const line = Number(params.get('line') || '1');
      if (path) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(Math.max(0, line - 1), 0);
        editor.selection = new vscode.Selection(pos, pos);
        await vscode.commands.executeCommand('revealLine', { lineNumber: pos.line, at: 'center' });
        return;
      }
      // Generic command execution (allowlist recommended)
      await vscode.commands.executeCommand(cmd);
    }
  }));
}
```

Open a URI from the CLI (Node example):

```js
// open-vscode.js
const { spawn } = require('child_process');
function openVSCodeUri(uri) {
  const platform = process.platform;
  if (platform === 'win32') return spawn('cmd', ['/c', 'start', '', uri]);
  if (platform === 'darwin') return spawn('open', [uri]);
  return spawn('xdg-open', [uri]);
}
openVSCodeUri('vscode://publisher.kiro-remote/open?path=/abs/file.js&line=42');
```

Open a file directly via code CLI:

```sh
code -g /abs/file.js:42 --reuse-window
```

CLI PTY server outline (Go/Rust or Node):
- Endpoint `POST /pty/create { cols, rows, cwd, env } -> { sessionId }`
- WS `/pty/attach?sid=...` streams data both ways
- `POST /pty/resize { sid, cols, rows }`
- `POST /pty/kill { sid }`

## Migration Plan

- Phase 1: Standalone CLI line-mode
  - Implement terminal sessions with PTY (CLI) and mirror current WS protocol
  - React frontend target switch from extension to CLI via config

- Phase 2: VS Code bridges
  - Add URI handler to extension (no native deps)
  - Implement “Open in VS Code” from CLI/React

- Phase 3: Optional: Integrated VS Code pseudo terminal view
  - Extension adds a PseudoTerminal that proxies to CLI’s PTY WS (no native deps)

## Tasks

- [ ] Bootstrap `kiro-cli` (Go or Node packaged)
- [ ] Implement PTY server: create/attach/input/resize/exit (WS + HTTP)
- [ ] File ops and git endpoints (reuse current API shape)
- [ ] Auth token + localhost bind + CORS rules
- [ ] React frontend: env/config to target CLI server
- [ ] “Open in VS Code” actions (code CLI + URI handler)
- [ ] Minimal VS Code extension update: registerUriHandler; optional proxy to CLI
- [ ] Packaging: Windows/macOS/Linux binaries; autoupdate channel
- [ ] Docs: install/run, security, troubleshooting

## When to pick this over Solution 1

- You need TUIs and robust PTY now without native modules inside VS Code
- You prefer a single binary install rather than VSIX with per‑ABI prebuilds
- You want the React frontend to run independently of VS Code being open

## Tradeoffs vs Solution 1 (Pseudoterminal)

- Solution 1 keeps everything inside VS Code, but no TUIs (pseudo only)
- Solution 2 moves engine outside, unlocks full PTY, and simplifies packaging; adds a background service to manage

