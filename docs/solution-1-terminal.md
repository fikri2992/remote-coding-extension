# Solution 1 - VS Code Pseudoterminal (No native PTY)

Status: Ready

Objective: Replace node-pty usage with a VS Code Pseudoterminal-backed terminal that supports common CLI workflows (codex-cli, claude, etc.) using ANSI escape injection and hidden command echoing. Works without native modules and provides a solid UX from the React frontend controlling VS Code.

## Summary

We implement a terminal provider using `vscode.Pseudoterminal` that drives a "Session Engine". The engine runs commands either in line mode (spawn per command) or in pipe-shell mode (spawn a long-lived shell via stdio pipes). Because there is no true TTY, we simulate key terminal behaviors using:

- ANSI injection: clear screen, reset cursor, colors, soft-wrap hints
- Hidden command echoing: render the command as if typed by the user before executing
- Prompt simulation: configurable prompt `${cwd}>` or `$ cwd` with colors
- CR -> CRLF mapping on Windows; `clear`/`cls` intercept
- Ctrl+C emulation: kill the active child process (or `taskkill` on Windows)

This sidesteps Electron/Node ABI issues while still delivering a predictable terminal for line-based tools and many interactive prompts.

Non-goals:
- Full TUI parity (vim/htop/less full-screen behavior) - not feasible without a real PTY
- Perfect readline behavior (left/right arrows, cursor editing at server) - we keep editing in the UI and submit on Enter

## Architecture

High level components:

1) Pseudoterminal Provider (VS Code)
   - `KiroPseudoTerminal implements vscode.Pseudoterminal`
   - Bridges UI keystrokes to the Session Engine and writes engine output to the terminal

2) Session Engine (shared)
   - Mode A: Line Mode - collect a line until Enter; run with `child_process.spawn(cmd, { shell: true })`, stream output, then show prompt
   - Mode B: Pipe Shell - spawn `powershell.exe -NoLogo -NoProfile` (Windows) or `${SHELL:-/bin/bash} -i` and wire stdio. Intercept `clear/cls`, inject ANSI clears, map CR -> CRLF on Windows
   - Known Command Adapters - codex/claude adapters enforce `--no-tty/--json` and stream structured output

3) WebView/React Frontend
   - Continues to use the existing WS protocol via `TerminalService` but delegates to the Session Engine instead of node-pty
   - Keeps client-side line editing (submit on Enter)

4) TerminalService Integration
   - `src/server/TerminalService.ts` uses the Session Engine for `create/input/resize/dispose`
   - When configured, it spins a Pseudoterminal for local integrated terminal as an alternate "skin" over the same session

Key idea: The Session Engine is the source of truth. Both the VS Code integrated terminal (Pseudoterminal) and the React terminal talk to the same engine. This makes UX identical whether the user looks at VS Code or the web.

## ANSI Injection + Hidden Echoing

- Before executing a command, we emit a light/faint echo (dim color) of the user's line, preceded by the prompt. The shell itself runs without local echo to avoid double-echoing.
- For `clear|cls` we inject `\x1b[2J\x1b[H` to fully clear and home.
- On Windows, convert lone `\r` to `\r\n` before writing to the shell process.
- For Ctrl+C, send a kill to the child process (SIGINT on POSIX; `taskkill /T /F` fallback on Windows), then reprint the prompt.
- Apply minimal formatting for prompts and sections (e.g., cyan cwd, dim user input, reset after)

Prompt style example (configurable):

```
\x1b[36m${cwd}\x1b[0m$ 
```

Hidden echo example before execution:

```
\x1b[2m${typedCommand}\x1b[0m\r\n
```

## Configuration (proposed)

Extension settings to control behavior (names are illustrative and can be adjusted to match the extension namespace):

- `kiroTerminal.mode` (string; default `line`): `auto` | `line` | `pipe`
- `kiroTerminal.defaultShell` (string):
  - Windows: `powershell.exe -NoLogo -NoProfile`
  - POSIX: `${SHELL:-/bin/bash} -i`
- `kiroTerminal.env` (object): extra environment variables merged into the child process
- `kiroTerminal.prompt.enabled` (boolean; default `true`)
- `kiroTerminal.prompt.template` (string; default `\x1b[36m${cwd}\x1b[0m$ `)
- `kiroTerminal.hiddenEcho.enabled` (boolean; default `true`)

These settings allow prompt styling and hidden echo to be toggled without code changes.

## Behavior Modes

1) Line Mode (default for reliability):
   - Frontend collects line input; on Enter, sends the full line to the engine
   - Engine prints prompt + hidden echo; spawns the command via shell, streams output; prints exit code (optional), then prompt again
   - Intercepts builtins: `cd <path>` updates engine CWD without spawning a new process
   - Great for codex/claude and other CLIs that don't require an interactive TTY

2) Pipe Shell Mode (optional):
   - Spawn long-lived `powershell.exe` or bash with pipes; forward bytes
   - Intercept `clear|cls` to inject ANSI clear
   - Map CR -> CRLF on Windows so Enter submits reliably
   - Still not a real TTY, so full-screen TUIs won't render correctly

## Known Command Adapters

Adapters normalize specific tools into non-TTY, structured flows:

- codex-cli
  - Add `--no-tty` and `--json` if available
  - Stream JSON events; surface results as sections with ANSI headers

- Claude
  - Prefer `--json --stream`; fallback to plain text

- git
  - In line mode, run subcommands directly
  - Interactively detected prompts (e.g., credential) can pause and request input via UI overlay

Adapters can be added incrementally. Unknown commands run normally.

## Integration Points

- TerminalService refactor: route sessions through Session Engine
  - Replace direct `spawn(node-pty.spawn|pipe)` branches with `engine.createSession({ mode, cwd, env })`
  - Reuse existing redaction and buffering logic already present in `src/server/TerminalService.ts`

## Sample Implementation Sketches

Pseudoterminal wrapper:

```ts
// src/server/pseudo/KiroPseudoTerminal.ts
import * as vscode from 'vscode';

export class KiroPseudoTerminal implements vscode.Pseudoterminal {
  private onDidWriteEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.onDidWriteEmitter.event;
  private onDidCloseEmitter = new vscode.EventEmitter<void>();
  onDidClose?: vscode.Event<void> = this.onDidCloseEmitter.event;

  constructor(private engine: SessionEngine, private sid: string) {}

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    this.engine.attach(this.sid, data => this.onDidWriteEmitter.fire(data));
    this.engine.open(this.sid, initialDimensions);
  }
  close(): void {
    this.engine.dispose(this.sid);
    this.onDidCloseEmitter.fire();
  }
  handleInput(data: string): void {
    this.engine.input(this.sid, data);
  }
  setDimensions(d: vscode.TerminalDimensions): void {
    this.engine.resize(this.sid, d.columns, d.rows);
  }
}
```

Session Engine (line-mode focus):

```ts
// src/server/pseudo/SessionEngine.ts
import { spawn } from 'child_process';

export type SessionOptions = { cwd: string; env: NodeJS.ProcessEnv; mode: 'line'|'pipe' };
type Sink = (chunk: string) => void;

export class SessionEngine {
  private sessions = new Map<string, {
    cwd: string;
    env: NodeJS.ProcessEnv;
    sink: Sink;
    mode: 'line'|'pipe';
    child?: import('child_process').ChildProcess;
  }>();

  create(sid: string, opts: SessionOptions, sink: Sink) {
    this.sessions.set(sid, { cwd: opts.cwd, env: opts.env, sink, mode: opts.mode });
    this.printPrompt(sid);
  }

  attach(sid: string, sink: Sink) { this.sessions.get(sid)!.sink = sink; }
  open(_sid: string) { /* no-op for line mode */ }

  input(sid: string, data: string) {
    const s = this.sessions.get(sid)!;
    // Submit-on-Enter: collect on client; here we assume full line
    const line = data.replace(/\r\n?|\n/g, '');
    if (!line) return;
    if (line === 'clear' || line === 'cls') return this.clear(sid);
    if (line.startsWith('cd ')) return this.cd(sid, line.slice(3).trim());
    this.hiddenEcho(sid, line);
    const child = spawn(line, { shell: true, cwd: s.cwd, env: s.env });
    s.child = child;
    child.stdout.on('data', (b) => s.sink(String(b)));
    child.stderr.on('data', (b) => s.sink(String(b)));
    child.on('close', (code) => {
      s.sink(`\r\n[exit ${code}]\r\n`);
      this.printPrompt(sid);
      s.child = undefined;
    });
  }

  resize(_sid: string, _c: number, _r: number) {}
  dispose(sid: string) { this.sessions.delete(sid); }

  private printPrompt(sid: string) {
    const s = this.sessions.get(sid)!;
    s.sink(`\x1b[36m${s.cwd}\x1b[0m$ `);
  }
  private hiddenEcho(sid: string, line: string) {
    const s = this.sessions.get(sid)!;
    s.sink(`\x1b[2m${line}\x1b[0m\r\n`);
  }
  private clear(sid: string) {
    const s = this.sessions.get(sid)!;
    s.sink(`\x1b[2J\x1b[H`);
    this.printPrompt(sid);
  }
  private cd(sid: string, target: string) {
    const path = require('path');
    const s = this.sessions.get(sid)!;
    const next = path.isAbsolute(target) ? target : path.join(s.cwd, target);
    try { s.cwd = next; } catch {}
    this.hiddenEcho(sid, `cd ${target}`);
    this.printPrompt(sid);
  }
}
```

These are sketches to anchor design; actual code should integrate with existing `src/server/TerminalService.ts` and reuse its redaction and buffering logic.

## Compatibility Notes

- Windows: convert lone `\r` to `\r\n` in pipe mode; prefer line mode by default
- Clear screen: use `\x1b[2J\x1b[H` universally
- Colors: rely on xterm.js; set `TERM=xterm-256color` when spawning

## Security

- Keep allowlist in place for `exec` and offer opt-out via env `KIRO_EXEC_ALLOW_UNSAFE=1`
- Redact tokens in output (reuse existing `redact()` function)

## Diagnostics

- Command: `Kiro: Diagnose PseudoTerminal`
- Performs: environment probe (OS, shell), spawn tests (line and pipe), ANSI support check, CRLF mapping check (Windows), SIGINT/kill check, and reports configuration values relevant to the session
- Output: a single text report rendered in the terminal and copied to clipboard for bug reports

## Tasks (Checklist)

- [x] Create SessionEngine module (line mode first)
- [x] Implement `KiroPseudoTerminal` (open/close/input/resize)
- [x] Register command: `Kiro: Open Pseudo Terminal`
- [x] Wire `TerminalService` to use SessionEngine for web sessions
- [x] Intercept `clear|cls` (ANSI clear), implement `cd`
- [x] Ctrl+C emulation (SIGINT / taskkill) for active command
- [x] Prompt styling + hidden echo toggles (config)
- [x] Config: mode selection (auto | line | pipe), default shell, env
- [x] Diagnostics command: `Kiro: Diagnose PseudoTerminal`
- [x] Docs + troubleshooting update; link from `docs/problem-terminal-pty.md`

## Milestones

1. Line Mode MVP (done)
   - Prompt, hidden echo, `cd`, clear, run commands reliably
2. Adapters + Ctrl+C (Ctrl+C done; adapters pending)
   - codex/claude adapters; cancel active child
3. Pipe Shell Mode (done)
   - Long-running shell for simple interactive scenarios; CRLF mapping; ANSI clear interception; UI toggle

## Validation / Acceptance

- VSIX installs with zero native builds
- codex-cli / claude run from both VS Code terminal and React web terminal
- Clear screen, cd, prompt, and cancellation behave as documented
- No fallback banner shown; warning only when a command requires a real PTY

## Risks & Mitigations

- Some tools require TTY: mitigate with adapters (force non-TTY flags) and clear UX messages
- Windows process termination: use `taskkill /T /F` fallback when needed
- Output duplication: ensure local shell echo is off and rely on hidden echo only

## Future Enhancements

- Sidecar PTY daemon (Go/Rust) to regain full TTY when desired
- Docker-backed TTY sessions when Docker is available
- "Expect"-style prompt drivers for semi-interactive CLIs

## See Also

- Troubleshooting and PTY notes: `docs/problem-terminal-pty.md`
- General troubleshooting: `docs/troubleshooting.md`

