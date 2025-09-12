ACP UX Strategy (Seamless, Chat‑First)

This strategy reimagines ACP into a chat‑first, zero‑friction experience. It consolidates functionality behind a simple, delightful UI, while preserving power features via progressive disclosure and sensible defaults.


**Vision**

- Single, friendly chat surface that “just works”.
- Automatic connect and session management; settings and logs are tucked away.
- Context attachment is inline and fluid using @mentions and drag‑and‑drop.
- Tooling (diffs, terminal, permissions) appears as chat cards with clear actions.


**Principles**

- Opinionated defaults: no configuration on first run.
- Progressive disclosure: show complexity only when needed.
- Familiar patterns: mirror modern chat apps and IDE palettes.
- Speed by design: keyboard‑first, async streaming, minimal modals.
- Clear status: banners and inline states instead of separate pages.


Experience Architecture
-----------------------

- Primary surface: Chat screen (full‑bleed on desktop, responsive on mobile).
- Secondary surfaces (hidden by default):
  - Quick Settings sheet (connection, auth hints, model pick when available).
  - Debug drawer (stderr, raw events, perf metrics) behind a dev toggle.


Chat UI
-------

- Composer: One multiline input with smart helpers.
  - @files: type “@” to open a floating MentionPopover above the caret; fuzzy search workspace and changed files.
  - Drag‑and‑drop files into the composer to attach as context chips.
  - Slash commands: `/new`, `/model gpt‑...`, `/cancel`, `/help`.
  - Hotkeys: Enter send, Shift+Enter newline, Esc closes popovers.
- Message list: Streaming bubbles with lightweight header rows.
  - Assistant/tool/system/user roles rendered with subtle styles.
  - Tool results (diffs/terminal/images/audio) as specialized cards with “Apply”, “Copy”, “Open” affordances.
  - Token/latency hints shown only on hover.
- Context chips: Shadcn Badge‑like chips inline above the composer; hover to preview, click X to remove.


Connection & Settings
---------------------

- Auto‑connect on first load using safe defaults:
  - Prefer local node_modules Claude ACP; fallback to npx.
  - Proxy and CWD inferred from server; secrets never stored.
- If auth is required, show a thin inline banner atop chat with CTA “Authenticate”.
- Quick Settings sheet (Cmd+, or small gear in header) replaces full Settings page.
  - Connection status, agent path (read‑only by default), model selector (if supported), proxy text box.
  - Advanced toggles: “Show Debug Drawer”, “Prefer local agent”, “Allow any agent cmd”.


Sessions & Threads
------------------

- Implicit session: new tab loads into the last active session or auto‑creates one.
- `/new` creates a fresh session and announces it as a system message.
- Simple chip row (optional) for recent sessions; otherwise use `/switch <id>`.
- Auto‑recovery on “session not found”: transparently create and continue.


Modes & Models
--------------

- Modes (e.g., plan, apply, review, safe-run):
  - Auto mode: default smart behavior inferred from conversation (no explicit picker shown by default).
  - Mode hints: allow inline directives like `/mode plan` or `/plan` to bias behavior.
  - Plan Mode: agent shares a checklist PlanCard first; user can approve steps individually or “Run all”.
  - Apply Mode: diffs and commands stream as actionable cards; guarded by permission sheet where needed.
  - Review Mode: summarize proposed changes; show file list with quick previews and accept/reject toggles.
  - Safe‑Run Mode: terminal actions run in ephemeral shells; outputs are captured as TerminalCards.
  - UI affordance: compact ModeChip in the header shows current mode; click opens ModePicker sheet. Keep hidden unless user opts in or a mode‑specific action appears.
- Models:
  - If adapter supports listing: show current model in header; click to open ModelPicker sheet.
  - Also support `/model <id>` in composer.
  - Per‑thread model persistence; surface change via small system message.

Mode Plumbing (Technical)
-------------------------

- Set Mode API: `session.setMode` op over WS maps to `ACPConnection.setMode()`.
  - Adapter mapping handled in backend: Claude uses `{ sessionId, modeId }`; generic agents use `{ session_id, mode_id }`.
- Source of Modes: `session.new` response may include `modes` with `available_modes` and `current_mode_id`.
- Realtime Updates: handle WS updates `mode_updated` and `current_mode_update` to update UI state and emit a small system bubble.
- UI Binding:
  - Header ModeChip reflects `current_mode_id`; clicking opens ModePicker sheet populated from `available_modes`.
  - Hidden by default; appears after first mode update or when user triggers `/mode`.
- Fallback: If no modes returned, hide ModeChip and rely on Auto mode.


Permissions
-----------

- PermissionSheet: a shadcn Sheet/Modal that lists tool options with short descriptions.
- Non‑blocking: chat remains interactive; sheet dismisses after selection.
- Record last choice per tool type to preselect next time.


Terminal
--------

- Terminal cards render inside chat when tools spawn terminals.
- Controls inline: “Refresh”, “Kill”, “Release”, “Wait Exit”.
- If user needs manual terminal: `/term node -v` opens a small ephemeral terminal card.


Diffs & File Edits
------------------

- DiffCard renders path header + preview with actions: “Apply”, “Open file”, “Copy patch”.
- Apply feedback via toast; failure shows inline error with “Retry”/“Open logs”.
- In Plan Mode: DiffCards are stacked under steps; “Approve step” enables “Apply all for step”.
- In Apply Mode: DiffCards apply immediately (with undo toast); permission prompts when required.


Errors & Empty States
---------------------

- Banners: connect/auth problems, reconnection attempts, permission blocks.
- Empty state for first run: “You’re connected—try asking me anything. Tip: type @ to add files.”


Accessibility & Performance
---------------------------

- ARIA for popovers/sheets, focus traps, labels; large touch targets on mobile.
- Virtualized chat list; chunked rendering for long outputs; streaming token update batching.


Component Plan (shadcn)
------------------------

- ChatShell: Layout with header (status + actions), message list, composer.
- MessageBubble: Role‑aware bubble with streaming support.
- ContextChip: Small badge with preview tooltip.
- MentionPopover: Floating list for @files; keyboard navigable.
- PermissionSheet: Modal with option list and descriptions.
- DiffCard: Path header + preview + Apply.
- TerminalCard: Output area + small control toolbar.
- ModelPickerSheet: searchable model selector.
- DebugDrawer: Collapsible stderr + raw events + quick filters.


State & Services
----------------

- `AcpClient` hook wraps `WebSocketProvider.sendAcp` with typed ops and retry policy.
- `ChatStore` (Zustand or React context) holds messages, context chips, session id, banners.
- `ContextService` provides file listing, previews, and fuzzy search index.
- All services resilient to reconnects; idempotent ops; timeout + retry with jitter.


Data Flow
---------

- On mount: auto‑connect → if initialized, ensure session → fetch auth methods → fetch git status → prime file index.
- On input: mentions open as user types “@” → select adds ContextChip and may prefetch preview.
- On send: build prompt: text + inline resources (<=256KB) + links for larger files → send.
- On stream: map `session_update` to MessageBubbles; tool cards render specialized content and actions.
- On diff apply or terminal actions: call corresponding acp ops; show toast + inline status.


Rollout Plan
------------

1) Component scaffolding: ChatShell, MessageBubble, Composer, MentionPopover, ContextChip.
2) Service layer: AcpClient, ContextService, ChatStore; migrate ACPPage logic.
3) Auto‑connect + inline banners; remove dedicated Settings page.
4) Models, Permissions, Terminal, DiffCard as specialized message blocks.
5) DebugDrawer behind dev toggle; remove Raw Events/STDERR panels from default view.
6) Keyboard shortcuts, slash commands, a11y pass.
7) Polish: animations, empty states, microcopy, toasts.


Migration Notes
---------------

- Extract existing logic from `ACPPage.tsx` into hooks/services without changing server contracts.
- Keep ws op names identical; only refactor UI/UX.
- Maintain `resource` vs `resource_link` behavior and the 256KB inline threshold.
- Keep sessions persistence/auto‑recovery as‑is; surface with cleaner banners.


Open Ideas (Stretch)
--------------------

- Command Palette (Cmd+K): fuzzy actions (/new, /model, /connect, /files add …).
- Context Inspector: short right‑side peek panel that slides in on demand.
- Inline Code Actions: highlight code blocks and offer “Create file”, “Open in editor”, “Run snippet”.
