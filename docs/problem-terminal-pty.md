# Terminal Modes and Why We No Longer Ship node-pty

This document explains how the terminal works now that we’ve moved to a PseudoTerminal-first design, why we removed node-pty, and what to expect when running CLI tools.

## Current Behavior (PseudoTerminal-first)

- Default engine is “Pseudo (line)”: reliable line-mode with local echo and history.
- Optional “Pseudo (pipe)” mode: a long-lived shell via pipes (still not a real TTY).
- Backspace, Enter, Clear screen, and Ctrl+C are handled by the Session Engine.
- VS Code command “Open Pseudo Terminal” uses the same engine as the web terminal.

## Why not node-pty?

- Shipping and maintaining native PTY binaries across Electron versions and OS/arch is brittle and increases install failures.
- Our goals are reliability, zero native dependencies, and a solid mobile experience.
- Line-mode covers most AI/CLI workflows; full TUI parity is out of scope for now.

## What’s implemented now

- Session Engine (line/pipe) drives both the web terminal and the VS Code PseudoTerminal.
- Local echo + backspace + history (line mode): Up/Down recall, submit on Enter.
- Clear screen via ANSI injection; Ctrl+C cancels the active process.
- Optional prompt and hidden-echo toggles via settings.

## Limitations

- TUIs (vim/nano/htop/less) and full-screen apps still require a real TTY and will not render properly.
- In pipe mode, interactive readline at the server is still limited; prefer line mode.

## Settings

- `webAutomationTunnel.terminal.engineMode` = `line` (default) | `pipe`.
- `webAutomationTunnel.terminal.prompt.enabled` (default true)
- `webAutomationTunnel.terminal.prompt.template` (default “\x1b[36m${cwd}\x1b[0m$ ”)
- `webAutomationTunnel.terminal.hiddenEcho.enabled` (default true)

## Diagnostics

- Use “Kiro: Diagnose PseudoTerminal” to run a quick Session Engine echo test.
- Output includes platform details and whether the pseudo echo test passed.

## Migration note

- Node-pty is no longer shipped or required. If you need full TTY parity for TUIs, consider running those tools in your system terminal and using the extension terminal for line-based and AI workflows.

## Acceptance Criteria (updated)

- The extension installs via a single VSIX with no native builds.
- PseudoTerminal line mode is the default and behaves reliably across OS.
- Pipe mode remains available for simple interactive flows.
- TUIs that require a real TTY are called out as unsupported.
