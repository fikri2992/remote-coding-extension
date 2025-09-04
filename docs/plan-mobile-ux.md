# Mobile UX — Patterns, Layout, and Performance

Outcome: A remote‑control UI that feels natural on phones: uncluttered, predictable, single‑thumb friendly, performant on low‑end devices.

Navigation and layout

- Header: Compact status (online/offline, client count) and hamburger on small screens.
- Sidebar: Overlay on mobile with tap‑outside to dismiss; fixed on desktop.
- Content: Cards with generous spacing; tap targets ≥ 44px; readable typography.
- Actions: Bottom sheets for context actions (file node actions, git commit, terminal controls).
- Orientation: Support portrait first; ensure landscape degrades well for terminals.

Interaction patterns

- Pull‑to‑refresh for Files and Git pages.
- Long‑press opens action sheets; swipe‑to‑close sheets.
- Optimistic UI: show expected results early but reconcile on server response.
- Offline banners with retry affordances; queued operations listed inline.

Performance

- Virtualize long lists (files, diffs, logs); incremental WS updates (batch every 300–500ms).
- Lazy route loading; defer heavy libs (syntax highlighter, xterm) until first use.
- Reduce reflows: isolate animated areas; use will‑change sparingly; avoid large shadow trees.

Accessibility

- High‑contrast colors for status and git chips; respect prefers‑color‑scheme.
- Labels for all controls; semantic headings; focus traps in bottom sheets.
- Keyboard support for iPad; screen reader hints for live regions (terminal output, chat).

Cross‑page polish tasks

- [ ] Standardize Card, List, BottomSheet components in `components/ui`.
- [ ] Add `useOnlineStatus`, `usePullToRefresh`, and `useListVirtualization` hooks.
- [ ] Introduce `Toast` patterns for errors/success across pages.
- [ ] Ensure `WebSocketProvider` exposes minimal connection telemetry to UI.

Additions based on current implementation

- Layout integration
  - Keep mobile header inside `RootLayout` and desktop header via `AppHeader`.
    - Files: `src/webview/react-frontend/src/layouts/RootLayout.tsx:1`
    - Desktop header: `src/webview/react-frontend/src/components/AppHeader.tsx:1`
  - Use `AppSidebar` for navigation (router-aware). Remove legacy `Sidebar/Menu` pair to avoid duplication.
    - Preferred: `src/webview/react-frontend/src/components/AppSidebar.tsx:1`
    - Legacy (remove or refactor into AppSidebar):
      - `src/webview/react-frontend/src/components/Sidebar.tsx:1`
      - `src/webview/react-frontend/src/components/Menu.tsx:1`

- Iconography and quick actions
  - Replace garbled glyphs on `HomePage` “Quick Actions” with lucide icons and real navigation.
    - `src/webview/react-frontend/src/pages/HomePage.tsx:1`
  - Establish a single Icon source: `lucide-react` across all pages.

- Bottom sheet actions (new)
  - Add `BottomSheet` component (reusing `Dialog` styles) in `components/ui` for:
    - File item actions (Open, Rename, Delete, New folder, Share).
    - Git commit and stash actions.
    - Terminal: keyboard helpers (Ctrl, Alt, Tab, Esc) and session actions.

- Virtualized lists (new)
  - Create `VirtualList` wrapper (react-virtual or react-window) for large trees/diffs/logs.
  - Use in Files tree, Git status, and Git diff views.

- Pull to refresh (new)
  - Hook `usePullToRefresh` that triggers a refresh callback when the user drags down at scrollTop=0.
  - Use on Files and Git pages.

- Offline/connection UX
  - Show a consistent banner for offline state sourced from `WebSocketProvider`.
    - Provider: `src/webview/react-frontend/src/components/WebSocketProvider.tsx:1`
  - Queue user actions when offline with clear “will send when online” indicators.

Page-specific mobile layouts and components

- Files
  - Header row: Breadcrumbs + search + “+” action (open BottomSheet).
  - Content: Virtualized expandable list; long-press to open actions.
  - Components to add:
    - `components/files/Breadcrumbs.tsx`
    - `components/files/FileTree.tsx` and `FileNodeItem.tsx`
    - `components/common/EmptyState.tsx`, `ErrorState.tsx`, `RetryButton.tsx`
  - Use WS envelopes from plan-files; defer syntax highlighting until needed.

- Terminal
  - Stage 1: Command Runner view with output card and input at bottom.
  - Stage 2: Interactive `xterm.js` terminal with sticky Action Row (Ctrl/Alt/Tab/Esc, arrows).
  - Components to add:
    - `components/terminal/TerminalView.tsx`
    - `components/terminal/TerminalActionBar.tsx`
  - Lazy-load xterm on first visit; keep font-size slider for accessibility.

- Git
  - Header chips: Branch, ahead/behind, repo root.
  - Tabs or sections: Status | Commits | Diff. Each list is virtualized.
  - Commit composer at bottom with large inputs and Submit button.
  - Components to add:
    - `components/git/GitStatusList.tsx`
    - `components/git/CommitComposer.tsx`
    - `components/git/DiffView.tsx`

- Chat
  - Current base is good; add delivery status and retry UI.
  - Optional: channel selector as a top dropdown for future.
  - Page: `src/webview/react-frontend/src/pages/ChatPage.tsx:1`

- Settings
  - Card-based form with large inputs; schema-driven (from WS `config` ops).
  - Components to add:
    - `components/settings/ConfigForm.tsx` with field components (NumberField with min/max UI).

Refactors and removals

- Consolidate navigation components
  - Prefer `AppSidebar` and remove `Sidebar.tsx` and `Menu.tsx` to reduce duplication and confusion.
- Consistent headers
  - Keep `AppHeader` desktop-only. For mobile, use the minimal header inside `RootLayout` and add Theme toggle into its action area.
- Replace placeholder content
  - HomePage “Quick Actions” should link to routes and use consistent iconography.

Performance and loading strategy

- Route-level code splitting for heavy pages (Terminal and Files viewer with syntax highlighting).
- Preload light pages on intent; lazy load heavy libs after a small idle timeout when on Wi‑Fi.
- Batch WS-driven updates into 300–500ms intervals before rendering to avoid jank.

Testing checklist (mobile focus)

- Navigation overlay: open/close on tap outside; no body scroll lock issues.
- Long lists: no dropped frames while scrolling at 60Hz on mid‑range Android.
- Keyboard interactions: terminal input not blocked; textareas grow up to a cap.
- Orientation: Terminal and Files remain usable in landscape; no clipped content.
