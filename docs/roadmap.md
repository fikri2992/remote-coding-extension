# Kiro Remote — Roadmap and Milestones

This roadmap turns the high‑level vision into actionable phases focused on a great, mobile‑first remote control experience for VS Code.

Guiding principles

- Mobile‑first: Large hit‑targets, minimal chrome, one‑hand workflows.
- Robust over flashy: Favor reliability, latency tolerance, and clear error states.
- Security by default: Workspace‑scoped access, origin checks, auditability.
- Progressive enhancement: Ship MVPs fast, then iterate with depth and polish.

Milestones

1) MVP (Core Remote Control)

- Files: Browse workspace tree, open and read files; pull‑to‑refresh and basic search.
- Chat: Simple real‑time chat across connected clients (already scaffolded), offline queue.
- Git: Read‑only status + recent commits summary.
- Settings: Read current config and update `httpPort` safely.
- Transport: WS protocol v1 and health; unify message envelopes.

2) Productivity (Interactive Workflows)

- Files: Open, view with syntax highlighting, quick share links; basic create/rename/delete.
- Terminal: Command Runner (non‑interactive) with output capture; then full TTY via `node-pty`.
- Git: Stage/unstage, commit, push/pull; diff previews.
- Settings: Serve schema, apply changes, and reflect live.
- Observability: Structured logs, client counters, and error toasts.

3) Power Features (Team and Automations)

- Files: Edit + save; diffs in UI; file watchers and live refresh.
- Terminal: Multiple sessions; resize, persist history; mobile keyboard helpers.
- Chat: Optional bot connectors; inline commands (`/git status`, `/open file`).
- Git: Branch switch/create; commit templates; conflict helpers.
- Security: Optional token handshake for WS; scoped claims; audit trail.

4) Polish and Scale

- Access control: Ephemeral links, PIN, device trust prompts.
- Network hardening: CSP, stricter origin, TLS via tunnel; rate limits.
- Performance: Virtualized lists, batched WS updates, lazy routes.
- QA: E2E regression suite for file/terminal/git, mobile viewport matrix.

Cross‑Cutting Tasks

- Protocol v1: Typed WS envelopes for `fileSystem`, `terminal`, `git`, `config`, `chat`.
- Error taxonomy: Server and client map to consistent user messages.
- State sync: New client → send minimal “ready + hints”, fetch as needed.
- Docs: Feature plans per area (see below) + living TODO in `docs/todo.md`.

Feature Plans

- Files: see `docs/plan-files.md`
- Terminal: see `docs/plan-terminal.md`
- Chat: see `docs/plan-chat.md`
- Git: see `docs/plan-git.md`
- Settings: see `docs/plan-settings.md`
- Mobile UX: see `docs/plan-mobile-ux.md`

