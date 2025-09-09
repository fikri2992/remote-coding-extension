# Files UX Feedback – Plan v1

## Goal
Make file/folder navigation feel responsive and intentional by adding clear, lightweight feedback on press, navigation, loading, success, and error. Keep interactions fast, reduce ambiguity, and avoid heavy spinners unless truly necessary.

## Current Pain Points (observed)
- Bland presses: file/folder/crumb/back clicks don’t visibly acknowledge intent beyond default hover.
- Invisible navigation: no clear cue that we are moving to a new path until content swaps.
- Loading ambiguity: tiny indicators exist, but not tied to the specific action (e.g., which item was opened).
- Errors feel abrupt: error boxes appear without context or recovery affordances.
- Accessibility gaps: limited ARIA announcements for navigation and loading; focus cues are subtle.

## Principles
- Immediate acknowledgement within 50ms of user input.
- Delay spinners by ~200ms to avoid flicker on fast responses.
- Localize feedback to the target (item/crumb/button) and complement with a small global signal.
- Keep transitions subtle; prefer fades/opacity changes over large motion.
- Preserve performance; avoid heavyweight libs.

## Feedback Toolkit (to build once, reuse everywhere)
- Pressable: wraps buttons/list items with consistent hover/active states and optional ripple.
- PendingSpinner: 12px inline spinner for item-level pending state.
- TopProgressBar: thin animated bar under the header (NProgress-style) for route ops.
- LiveRegion: screen-reader-only announcements (aria-live="polite").
- Toast hooks: quick success/failure snackbars via existing ToastProvider.

## Design Details

### 1) FileTree and FileNodeItem
- On pointer down: immediate visual press (scale/opacity) and ripple (optional, low opacity).
- On open folder:
  - Mark that row as pending (show PendingSpinner at right, dim arrow icon).
  - Start TopProgressBar after 200ms if still pending.
  - Disable re-press of the same row until completion/cancel.
- On open file:
  - Same pending treatment on the row.
  - FileViewer shows header progress and small “Opening …” live-announcement.

### 2) Breadcrumbs
- On crumb click:
  - Brief pressed state + PendingSpinner next to the crumb label.
  - Start TopProgressBar after 200ms if still pending.
  - Toast on long-press copy: “Path copied”.

### 3) Back buttons (Files + File Viewer)
- On back press:
  - Disable the button while pending; show a small inline spinner.
  - Prefer navigating to explicit `from` directory when present.
  - Announce via LiveRegion: “Opening parent …”.

### 4) Loading vs. Refreshing
- Keep cache-first instant paint; when revalidating show subtle “Refreshing …” chip.
- For cold loads, render 6–12 skeleton rows instead of an empty area.
- Debounce indicators by ~200ms; cancel if completed sooner.

### 5) Errors
- Shake animation on the header area (or button) when a fetch fails (100–150ms).
- Inline toast: “Failed to open X. Retry”. Provide a Retry button that re-sends the request.
- LiveRegion announcement for errors.

### 6) Accessibility
- Ensure focus-visible rings on list items, crumbs, and toolbar actions.
- Add aria-busy on containers during pending states.
- LiveRegion messages: “Opening <name>…”, “Loaded <name>”, “Failed to open <name>”.

## Implementation Plan (Surgical Changes)

1) Primitives (new)
- `src/webview/react-frontend/src/components/feedback/Pressable.tsx`
- `src/webview/react-frontend/src/components/feedback/PendingSpinner.tsx`
- `src/webview/react-frontend/src/components/feedback/TopProgressBar.tsx`
- `src/webview/react-frontend/src/components/feedback/LiveRegion.tsx`
- `src/webview/react-frontend/src/contexts/PendingNavContext.tsx` (tracks current pending target/path/type)

2) Integrate File List
- `FileNodeItem.tsx`: wrap root button with Pressable; accept `pendingPath` from context; show PendingSpinner on matching node.
- `FileTree.tsx`: pass through pending state; block re-press on the same node while pending.

3) Integrate Breadcrumbs
- `Breadcrumbs.tsx`: show inline spinner on the crumb being opened; fire pendingNav.start on click; toast on long-press copy.

4) Pages glue
- `FilesPage.tsx`:
  - Call `pendingNav.start({type:'directory', path})` on open/crumb/back; call `pendingNav.finish()` on success; `pendingNav.fail(e)` on error.
  - Render TopProgressBar when pendingNav.active && delayed.
  - Replace blank state with skeleton rows during cold loads.
  - Add LiveRegion announcements for open/loaded/error.
- `FileViewerPage.tsx`:
  - On open/refresh/back: same pending lifecycle + TopProgressBar.
  - Show small spinner in Back/Refresh buttons when pending.

5) Delayed indicators
- Small utility: `useDelayedFlag(value, 200)` to prevent flicker for spinners/progress.

6) QA hooks & metrics
- Count: item clicks, pending durations, failures; log to console in dev.
- Add `data-testid` attributes to new components for UI testing later.

## Acceptance Criteria
- Clicking a folder visibly acknowledges the action within 50ms and shows an inline spinner on that row until content appears.
- Clicking a breadcrumb or Back shows localized feedback and a thin top progress bar for longer operations.
- Cold loads render skeleton items; revalidation uses a small “Refreshing …” chip without blocking.
- Errors provide a clear inline toast with Retry and an a11y announcement.
- Keyboard users see strong focus states; screen readers announce navigation/loading succinctly.

## Risks & Mitigations
- Visual noise: keep animations subtle and brief; honor reduced motion media query.
- Complexity: centralize states with PendingNavContext and re-use primitives.
- Performance: avoid heavy libs; CSS/transitions only; delay spinners to prevent flicker.

## Rollout
1) Ship primitives + context.
2) Wire into Files list + breadcrumbs.
3) Wire into File viewer header/back.
4) Add skeletons and live region.
5) Polish timings, copy, and a11y labels.

## Notes
- No external deps required; leverage existing Tailwind + small React helpers.
- Matches cache-first/SWR behavior from enhanced cache plan while improving perceived responsiveness.

