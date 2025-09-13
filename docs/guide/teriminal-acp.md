# ACP Terminal (in `ACPPage.tsx`)

This guide explains how to use the “Terminal” controls inside `src/webview/react-frontend/src/pages/ACPPage.tsx`, how it differs from the dedicated terminal pages (`TerminalPage.tsx` / `ChatTerminalPage.tsx`), and which one to choose for common use cases like `npm run dev`, `npm run build`, Docker, or `node ace` commands.

Related source files referenced below:
- `src/webview/react-frontend/src/pages/ACPPage.tsx` (Terminal UI within ACP page)
- `src/acp/ACPConnection.ts` (implements `terminal/*` RPC used by ACP page terminal)
- `src/webview/react-frontend/src/pages/TerminalPage.tsx` (interactive terminal with xterm.js)
- `src/webview/react-frontend/src/pages/ChatTerminalPage.tsx` (chat-style terminal)
- `src/server/TerminalService.ts` and `src/cli/services/TerminalService.ts` (terminal server engines)

---

## What the ACP Terminal is

The ACP page includes a small “Terminal” panel intended for programmatic, non-interactive process execution. It uses the ACP adapter’s RPC endpoints implemented in `ACPConnection.ts`:

- `terminal/create` → spawns a process via `spawn(...)` (no stdin is wired; this is not an interactive PTY)
- `terminal/output` → returns the process’ combined output buffered in memory
- `terminal/kill` → kills the spawned process
- `terminal/release` → detaches and forgets the process (does not kill it)
- `terminal/wait_for_exit` → resolves when process exits, returns exit status

In `ACPPage.tsx` look at the functions around the “Terminal (optional)” section:
- `handleCreateTerminal()`
- `handleReadTerminal()`
- `handleKillTerminal()`
- `handleReleaseTerminal()`
- `handleWaitExitTerminal()`

These are bound to the buttons you see in the UI: “Start”, “Refresh”, “Kill”, “Release”, “Wait Exit”.

Key behavior to understand (from `src/acp/ACPConnection.ts`):
- Processes are spawned with `stdio: ['ignore','pipe','pipe']`. There is no stdin after start; i.e., no interactivity.
- On Windows, processes are spawned with `shell: true`. You can enter commands like `npm run build` the same way you would in a shell.
- Output is buffered in memory. `terminal/output` returns the full buffered text each time (not a PTY stream). For very long-running commands with massive logs, this can grow large.

---

## How to use the ACP Terminal (step-by-step)

The Terminal panel in ACP shows two inputs and several buttons:

- Command: the program to run, e.g. `npm`, `node`, `docker`
- Args (space-separated): flags/arguments, e.g. `run build` or `compose up -d`
- Start: create the terminal (spawn the process)
- Refresh: fetch current output and exit status
- Kill: terminate the process
- Release: untrack the process (does not kill)
- Wait Exit: wait until the process exits, then fetch exit code

The current working directory (CWD) comes from the “Connect” area’s `cwd` input on the ACP page (`ACPPage.tsx`). Set it before you run commands if needed.

Example workflows:

- npm build
  - Command: `npm`
  - Args: `run build`
  - Click Start, then Refresh to see logs; when it finishes, Wait Exit to see the exit code.

- npm dev (long-running)
  - Command: `npm`
  - Args: `run dev`
  - Click Start. It will keep running. Use Refresh to fetch accumulated logs. Use Kill to stop.
  - Note: Because output is buffered in memory by the adapter, let it run with caution (see “Pros/Cons”). For truly long and chatty dev servers, consider using `TerminalPage` instead.

- Docker build
  - Command: `docker`
  - Args: `build -t myimage .`
  - Start, then Refresh. Wait Exit to get the exit code.

- Docker compose (detached)
  - Command: `docker`
  - Args: `compose up -d`
  - Start, then Refresh a few times to see logs from the create step; afterwards the containers run in the background.
  - To stop: run another process `docker compose down`.

- Adonis (node ace)
  - Command: `node`
  - Args: `ace serve --watch`
  - Start, Refresh to see logs. It runs indefinitely (watch mode). Kill to stop.

Tips:
- If the command needs quoting, put quoted segments into Args (e.g. `--flag "value with spaces"`). The ACP page splits args using a simple shell-like regex.
- If you see “command not found”, verify PATH for the selected CWD. On Windows, `shell: true` helps resolve commands like `npm` and `docker` from PATH.
- “Release” detaches tracking while the process continues in the OS. Use “Kill” when you actually want to stop it.

---

## When to use ACP Terminal vs TerminalPage

There are two terminal experiences in the app:

- ACP Terminal (this guide)
  - Location: embedded in `ACPPage.tsx`
  - Backend: `ACPConnection` RPC (`terminal/create`, `terminal/output`, ...)
  - Mode: non-interactive process execution (no stdin after start)
  - Output: buffered read via `terminal/output` (whole buffer each time)
  - Controls: Start/Refresh/Kill/Release/Wait Exit

- TerminalPage (interactive)
  - Location: `src/webview/react-frontend/src/pages/TerminalPage.tsx`
  - Components: `TerminalXterm.tsx` (xterm.js), `TerminalActionBar`
  - Backend: `src/server/TerminalService.ts` (pseudo-terminal shell engine: `line` or `pipe`), also `src/cli/services/TerminalService.ts`
  - Mode: interactive shell with keystrokes, resize, multiple sessions, keepalive
  - Output: continuous streaming to xterm.js (not buffered in a single growing string)

There is also a chat-first variant:
- ChatTerminalPage: `src/webview/react-frontend/src/pages/ChatTerminalPage.tsx` gives a conversational UI for commands and outputs.

---

## Pros and Cons

ACP Terminal (in `ACPPage.tsx`)
- Pros
  - Simple fire-and-forget for scripts and CI-like tasks.
  - Great for non-interactive, long-running processes you don’t need to type into (builds, docker compose up -d, one-off scripts).
  - Minimal UI footprint inside the ACP workflow.
- Cons
  - Not interactive (no stdin after start). Tools that prompt for input will hang.
  - Output is buffered in-memory by the adapter (`ACPConnection.ts`). Very chatty or never-ending processes can cause memory growth and slow refreshes.
  - Single terminal panel in the UI (you can create multiple processes over time, but the UI holds one active `terminalId`).

TerminalPage (interactive xterm)
- Pros
  - Real interactive experience (type commands, handle prompts, run TUIs).
  - Better for indefinite processes with lots of output (streamed incrementally to the terminal screen rather than a single growing buffer).
  - Multiple persistent sessions, resize support, keepalive pings.
- Cons
  - Heavier UI (xterm) and requires focusing the terminal for input.
  - For purely non-interactive one-shot tasks, ACP Terminal can be simpler.

ChatTerminalPage (chat UX)
- Pros
  - Command history and outputs are organized as messages; nice on mobile.
  - Still uses the same terminal backend; can create a persistent session.
- Cons
  - Not a full PTY replacement for TUIs; think of it as a guided command runner.

---

## Recommendations by Use Case

- npm run build
  - Use ACP Terminal. It’s a finite, non-interactive job. Start → Refresh → Wait Exit.

- npm run dev (long-running server)
  - Prefer TerminalPage or ChatTerminalPage. The process is unbounded and chatty; ACP Terminal’s buffer will grow over time.
  - If you still use ACP Terminal, periodically Kill/Restart to avoid runaway memory, or keep Refresh usage moderate.

- docker build / docker compose up -d
  - Use ACP Terminal. These are non-interactive, finite commands (or detached). Start → Refresh → Wait Exit as needed.

- node ace serve --watch
  - Prefer TerminalPage (interactive) or ChatTerminalPage for long-running watchers. Use ACP Terminal only if you won’t interact and you accept buffered logs.

---

## Troubleshooting

- Nothing appears in output after Start
  - Click Refresh. The ACP terminal fetches output on demand, not as a live streaming terminal screen.

- Command asks for input or shows an interactive prompt
  - Use TerminalPage (interactive). The ACP terminal cannot send keystrokes after start.

- Exit code is missing
  - Click Wait Exit, then Refresh. `terminal/wait_for_exit` resolves when the process exits; subsequent `terminal/output` includes `exitStatus` in `ACPPage.tsx` state.

- The process keeps running in the background after “Release”
  - That’s expected. “Release” only forgets the process; use “Kill” to stop it.

- Windows-specific quoting
  - Put the executable in Command (e.g., `npm`) and its parameters in Args (e.g., `run build`). The adapter uses a Windows shell (`shell: true`) so typical command resolution works.

---

## Can ACP Terminal replace TerminalPage?

Not entirely. They serve different needs:
- If you mainly run one-off or detached, non-interactive commands from within your ACP workflow, the ACP Terminal is ideal and avoids switching pages.
- If you need an actual shell (typing, prompts, TUIs, or very long-running streams), keep using `TerminalPage.tsx` or `ChatTerminalPage.tsx`.

In many projects, teams use both: ACP Terminal for scripted jobs and TerminalPage/ChatTerminal for development servers and interactive workflows.
