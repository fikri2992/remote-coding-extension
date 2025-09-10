# Files Navigation — Problems, Root Causes, and Robust Fix Plan

## Summary
User-reported issues when navigating folders/files:
1) Breadcrumb sometimes missing parents until a second visit.
2) Inconsistent Back buttons (icon-only in Files vs text button in File Viewer).
3) "+ New" button unused — should be removed.
4) Refresh causes flicker; cached indicator feels noisy.
5) Random refreshes / top progress bar lingering.

Below are root causes, diagnosis, and a correction plan focusing on robustness and clarity.

## Observations (code-level)
- FilesPage renders crumbs via a local `buildCrumbs(path)` on "current path", then relies on async WebSocket "tree" response to update state + cache.
- `loadDirectory()` tries view-state, then `peekDirectory`, then requests `tree`. However, pending navigation and UI state are finished in multiple places, sometimes before the actual path variable updates that the rest of the page logic depends on.
- Breadcrumbs component is stateless and depends entirely on `crumbs` supplied by FilesPage. If `crumbs` is built from a stale path while `location.search` changes, it may briefly show an incomplete breadcrumb.
- PendingNav top bar finishes on message delivery (id-matched) — good — but we also finish on cached paint; if we don’t keep the currentPath in sync with the `navigate` target when starting the request, we can desync pending state from UI.
- There are two Back patterns: Files uses icon (mobile-only visible, we later added desktop text Back); File Viewer uses a text "Back".
- Refresh uses a visible spinner and a "Refreshing" chip which may flicker when the response is fast and we’re already painted from cache.
- WebSocket addMessageListener is per-page effect; if not unsubscribed correctly or IDs aren’t scoped, listeners can cause double processing.

## Root Causes
1) Breadcrumb lag/mismatch
- currentPath and crumbs derive from a mix of `location.search`, local `_currentPath` state, and cached/view-state restore.
- On navigating to a child directory, we start pending and navigate, but we may render based on previous `crumbs` until `useEffect` runs, reads the new `location.search`, and sets new crumbs. Because we also "finish" pending early when painting from cache, the top bar can stop even if crumbs haven’t updated yet.

2) Back inconsistency
- FilesPage uses an icon back (mobile) and text back (desktop); File Viewer uses a text "Back" with spinner. Style not unified.

3) "+ New" unused
- Present but no handler.

4) Refresh flicker / cached indicator noise
- We show both a top bar and an in-header "Refreshing" chip while we’re already rendering cached content; the chip can flicker for fast responses. The button spinner also appears quickly.

5) Random refresh / lingering top bar
- Finishing pending early (on cached paint) without a path guard + triggering `requestTree` in background allows a new pending start/finish sequence to interleave with the prior one (especially when quickly clicking around), making top bar feel stuck or “randomly” active.
- Breadcrumb clicks to the same path weren’t ignored earlier (now guarded, but timing needs to be centralized).

## Robust Fix Plan

### A) Single Source of Truth for Path + Crumbs
- Derive `currentPath` strictly from `location.search.path` and update a single `currentPath` state only in response to navigation changes.
- Compute `crumbs` directly from `currentPath` synchronously (not from cache responses). Never build crumbs from `_currentPath` that might lag the route.
- When navigating (open dir / crumb / back), optimistically set `currentPath` state immediately in sync with `navigate()` before any network calls, so crumbs update at once.

Implementation notes:
- In FilesPage, replace `_currentPath` with `currentPath` derived from router:
-   - `const routePath = ((location.search as any)?.path as string) || '/'`
-   - `const [currentPath, setCurrentPath] = useState(routePath)`
-   - `useEffect(() => { setCurrentPath(routePath); setCrumbs(buildCrumbs(routePath)); }, [routePath])`
-   - On `openNode` and breadcrumb clicks: call `setCurrentPath(nextPath)` immediately and `navigate({ to:'/files', search:{ path: nextPath } })`.

### B) Pending Lifecycle Centralization
- Create a `useRoutePending` effect (or hook) that ties pending state to `currentPath` changes:
  - Start pending when `currentPath` changes to a new path.
  - Finish pending on the first of: (a) cached/view-state paint OR (b) server tree response.
  - Guard against finishing with a mismatched path.
- Eliminate manual `pendingNav.start` calls sprinkled in handlers; rely on a single effect that watches `currentPath` changes and starts pending there. Handlers should just navigate.

### C) Data Fetch Normalization (SWR-like)
- On mount/path change:
  1) Try view-state (instant paint, finish pending for this path).
  2) Else try `peekDirectory(path, allowStale=true)` (instant paint, finish pending for this path).
  3) Kick off `requestTree(path)` in background.
- The message listener should check both the id and the `path` context; only update nodes/finish pending if it matches `currentPath`.
- Cancel any obsolete in-flight requests when `currentPath` changes.

### D) UI Consistency
- Back buttons: use the same component and styling across Files and File Viewer:
  - Icon + label "Back" on md+; icon-only on mobile.
- Remove "+ New".
- Refresh: keep a small delayed spinner in the button (no extra chip), skip the header "Refreshing" chip to reduce flicker.

### E) Event Hygiene
- Ensure WebSocket listener unsubscribes are reliable.
- Ensure only one active pending request per page; track by `currentPath` and `pendingIdRef`.

### F) Optional Enhancements
- Route transition prefetch: prefetch next directories/files on hover/focus, but do not mark pending until `currentPath` actually changes.
- Conservative UI signals: top bar only after 250–300ms delay; button spinners delayed by 150ms; no extra chips when cache paints immediately.

## Proposed Code Changes (incremental)

1) FilesPage refactor (src/webview/react-frontend/src/pages/FilesPage.tsx)
- Replace `_currentPath` with `currentPath` derived from router:
  - `const routePath = ((location.search as any)?.path as string) || '/'`
  - `const [currentPath, setCurrentPath] = useState(routePath)`
  - `useEffect(() => { setCurrentPath(routePath); setCrumbs(buildCrumbs(routePath)); }, [routePath])`
- Compute crumbs from `currentPath` only; remove ad-hoc building elsewhere.
- Centralize pending:
  - An effect watching `currentPath` starts pending (navigation handlers just call `navigate`).
  - On view-state or peek cache hit: paint, finish pending; then call `requestTree(currentPath, background)`.
  - On tree response: verify this response corresponds to the path we asked for before applying.
- Remove header "Refreshing" chip; keep only button spinner + top bar (delayed).
- Remove the "+ New" button.

2) Breadcrumbs (src/webview/react-frontend/src/components/files/Breadcrumbs.tsx)
- Stateless: keep as-is; ensure `onNavigate` simply calls `navigate`; FilesPage handles pending.

3) File Viewer (src/webview/react-frontend/src/pages/FileViewerPage.tsx)
- Back button style aligned with Files (icon + label on md+, icon-only on mobile).
- No change to `from` param logic; ensure `from` is passed everywhere in Files.
- Remove the header "Refreshing" chip; show spinner only inside the Refresh button (with a small delay), same as FilesPage.

4) Stability
- In `requestTree`, add a guard so that if `currentPath` changes, late messages are ignored.
- In message handler, verify both id and `contextPath` (see below) match.

## UX Impact
- Crumbs update instantly on navigation intent.
- Top bar starts/stops predictably tied to route changes.
- Refresh doesn’t flicker and doesn’t show extra chips while cache is visible.
- Back is consistent in both views.
- No random refresh; pending requests are scoped and ignored on path change.

## Rollout Plan
1) Implement FilesPage refactor for path/crumb/pending centralization.
2) Unify Back buttons and remove "+ New".
3) Simplify refresh cues; remove header chip.
4) Add request cancellation/guards.
5) QA: navigate root → src → src/cli → src/cli/sub; test back/crumb clicks; test refresh; verify no sticky top bar.

## Notes
- This plan intentionally reduces moving parts in FilesPage (fewer state fields, single source of truth) and uses conservative UI cues to reduce flicker.
- It builds on the existing cache/view-state design without introducing heavy libraries.

---

## Concrete Implementation Notes (based on current code)

This section maps the plan to the current components and highlights exact places to change.

1) Centralize path and crumbs in FilesPage
- File: `src/webview/react-frontend/src/pages/FilesPage.tsx`
- Replace the `_currentPath` state with a router-derived `currentPath`:

```tsx
const routePath = ((location.search as any)?.path as string) || '/'
const [currentPath, setCurrentPath] = React.useState<string>(routePath)

// Keep local state and crumbs in sync with route
React.useEffect(() => {
  setCurrentPath(routePath)
  setCrumbs(buildCrumbs(routePath))
}, [routePath])
```

- In handlers (`openNode`, breadcrumb `onNavigate`, Back), remove manual `pendingNav.start(...)` and only call `navigate`. A single effect will manage pending.

```tsx
// Start pending when routePath changes (after a small delay for smoother UX)
const prevPathRef = React.useRef<string | null>(null)
React.useEffect(() => {
  if (prevPathRef.current !== routePath) {
    pendingNav.start({ type: 'directory', path: routePath })
    prevPathRef.current = routePath
  }
}, [routePath])
```

2) Guard request/response by path
- Keep `pendingIdRef`, and also track the `pendingPathRef` when calling `requestTree(path, ...)`:

```tsx
const pendingPathRef = React.useRef<string | null>(null)

const requestTree = async (path: string, retryCount = 0, background = false) => {
  const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
  pendingIdRef.current = id
  pendingPathRef.current = path
  // ... send
}

// When handling the message:
if (!pendingIdRef.current || msg.id !== pendingIdRef.current) return
if (pendingPathRef.current !== currentPath) {
  // Path changed since request; ignore late response
  return
}
```

3) Remove header “Refreshing” chip and "+ New" button
- FilesPage: delete the `Refreshing…` header chip block and the `+ New` button.
- FileViewerPage: delete the small `Refreshing.` text in the header; show spinner only inside the Refresh button (with a 150ms delay as already implemented).

4) Unify Back button styling
- Prefer: icon + label on md+; icon-only on mobile. Extract to a small shared component if desired:

```tsx
// components/navigation/BackButton.tsx (optional)
export const BackButton = ({ onClick, pending }: { onClick: () => void; pending?: boolean }) => (
  <button onClick={onClick} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px]">
    <span className="inline-flex items-center gap-2">
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M11.78 15.22a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L7.56 9H16a.75.75 0 010 1.5H7.56l4.22 4.22a.75.75 0 010 1.06z"/></svg>
      <span className="hidden md:inline">Back</span>
    </span>
  </button>
)
```

5) Delay visual signals to reduce flicker
- Top bar: already wrapped in `useDelayedFlag(pendingNav.isActive, 200)`.
- Refresh button spinner: already delayed by 150ms; keep that and remove extra header chips.

---

## Implementation Checklist

- [ ] FilesPage derives `currentPath` from router and computes `crumbs` from it only
- [ ] Remove manual `pendingNav.start(...)` calls from handlers; start pending in an effect on `currentPath` change
- [ ] Track and guard responses by `pendingPathRef` in addition to id
- [ ] Remove header "Refreshing" chips in Files and File Viewer
- [ ] Remove "+ New" button from Files header
- [ ] Unify Back button across Files and File Viewer (icon-only on mobile; icon + label on md+)
- [ ] QA navigation/back/crumbs/refresh for no flicker and correct pending bar lifecycle

