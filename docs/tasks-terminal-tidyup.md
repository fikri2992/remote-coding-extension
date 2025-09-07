# Tasks — Terminal Tidy‑Up (PseudoTerminal Only, Mobile‑First UI)

Purpose: Remove node-pty usage, standardize on the PseudoTerminal SessionEngine, and simplify the terminal UI with a mobile‑first experience. This document tracks the work to complete the migration and cleanup.

Links
- Solution: docs/solution-1-terminal.md
- Problem context: docs/problem-terminal-pty.md
- Current UI: src/webview/react-frontend/src/pages/TerminalPage.tsx
- Server: src/server/TerminalService.ts, src/server/pseudo/*

---

## Objectives

- Default to PseudoTerminal line mode everywhere (no native PTY).
- Provide a simple, reliable mobile UI for command workflows.
- Keep a pipe-shell option for simple interactive cases, but off by default.
- Remove node-pty code paths, vendor scripts, and dependency.

## Non‑Goals

- Full TUI parity or ncurses apps (vim/htop/less).
- Complex readline at the server; client retains simple editing.

---

## Milestones

1) Disable node-pty by default (engineMode=line). [short]
2) Ship simplified mobile UI (single session flow + on‑screen keys). [short]
3) Remove node-pty entirely (deps + code). [medium]
4) Polish + docs + diagnostics. [short]

---

## Backend Cleanup (De‑PTY)

- [x] Set default engine to line
  - package.json contributes.configuration: `webAutomationTunnel.terminal.engineMode` default `line`.
  - Honor env `KIRO_TERMINAL_ENGINE` but prefer settings.
- [x] Remove node-pty dependency and vendor scripts
  - package.json: remove `node-pty` from dependencies; delete scripts: `pty:vendor`, `rebuild:pty`.
  - Remove `vendor/node-pty` loader and references.
- [x] Prune PTY branches in TerminalService
  - File: `src/server/TerminalService.ts`
  - Remove node-pty spawn path; keep only SessionEngine (line/pipe) and pipe fallback removed if redundant.
  - Ensure create/input/resize/dispose/list-sessions remain stable.
- [ ] Keep VS Code command for internal PseudoTerminal
  - Confirm `webAutomationTunnel.openPseudoTerminal` uses SessionEngine line/pipe.
- [ ] Normalize Windows behaviors
  - Ensure CR→CRLF mapping in pipe mode; line mode handled by engine.
  - Intercept `clear|cls` and inject ANSI clear.

## SessionEngine Polish

- [x] Local echo + backspace (done) — verify across platforms.
- [ ] Optional history (Up/Down) in line mode
  - Maintain last N commands; ignore in pipe mode.
- [ ] Builtins: `cd`, `pwd`, `echo`, `help` (lightweight) as needed for UX.
- [ ] Prompt customization via settings
  - `prompt.enabled`, `prompt.template`, `hiddenEcho.enabled`.
- [ ] Ctrl+C behavior
  - If child running: kill and re‑prompt; else print caret and re‑prompt.

## React UI — Mobile‑First Simplification

- [x] One primary flow
  - Single “Create Session” button, single active session view.
  - Session is persistent by default; automatic reattach on reconnect.
- [x] Replace complex chrome with compact toolbar
  - Buttons: Focus, Clear, Ctrl+C, Tab, Esc; optional: Up/Down (history).
  - Move engine selector into a small settings menu (default: line). (Removed from main UI)
- [ ] Optional input bar for line mode
  - Sticky bottom input with send button (submits line);
  - Xterm remains for output + simple keys; on mobile, input bar can be easier.
- [ ] Improve focus/keyboard UX
  - Auto‑focus after create; tap to focus; visible focus state; ARIA label.
- [ ] Clickable links (device‑code flows)
  - Add `xterm-addon-web-links` so auth URLs are tappable.
- [ ] Status/badges
  - Show engine badge (“Pseudo”), cwd, and last activity.

Files
- `src/webview/react-frontend/src/pages/TerminalPage.tsx`
- `src/webview/react-frontend/src/components/terminal/TerminalXterm.tsx`
- `src/webview/react-frontend/src/components/terminal/TerminalActionBar.tsx`

## Settings & Defaults

- [x] Update defaults
  - `webAutomationTunnel.terminal.engineMode`: `line` (was `auto`).
  - Add `webAutomationTunnel.terminal.prompt.enabled` (true)
  - Add `webAutomationTunnel.terminal.prompt.template` ("\x1b[36m${cwd}\x1b[0m$ ")
  - Add `webAutomationTunnel.terminal.hiddenEcho.enabled` (true)
- [ ] Remove deprecated/unused terminal settings after migration.

## Diagnostics & Help

- [ ] Add command: `Kiro: Diagnose PseudoTerminal`
  - Probe OS, shell, CRLF mapping, ANSI capabilities, SIGINT/kill.
  - Emit a copyable report.
- [ ] Update docs
  - `docs/solution-1-terminal.md` (ready)
  - Add quickstart usage note to troubleshooting.

## Code Removal & Dead Paths

- [ ] Delete node-pty vendor loader `vendor/node-pty` and related code.
- [ ] Remove PTY‑specific logs and flags in `TerminalService.ts`.
- [ ] Clean imports and unused helpers.

## Testing & QA

- [ ] Manual scenarios (Windows/macOS/Linux)
  - `cls`/`clear`, `cd`, run `git status`, `npm -v`.
  - Ctrl+C cancels a long‑running command.
  - Mobile Safari/Chrome focus + keyboard + viewport resize.
- [ ] Regression tests (if infra available)
  - Session creation, input, resize, dispose, list‑sessions.

## Rollout

- [ ] Version bump + changelog: “PseudoTerminal default; node-pty removed”.
- [ ] Note TUI limitations and how to use pipe mode when necessary.

## Definition of Done

- No node-pty dependency or code paths remain.
- Terminal defaults to PseudoTerminal line mode on both VS Code terminal and webview.
- Mobile UI is simplified and comfortable to use (focus, keys, input).
- Diagnostics command exists; docs reflect new defaults and limitations.
