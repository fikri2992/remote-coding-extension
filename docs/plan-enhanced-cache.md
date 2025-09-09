# Enhanced Files/Folder Cache Plan

## Goal
Make navigation between folders and files feel instant during normal back/forward usage, while still fetching fresh data on demand (manual refresh) or when the cache is stale. Avoid full-screen loading spinners when data is already available locally.

## Quick Summary
- Adopt a cache-first, stale-while-revalidate (SWR) flow for both directories and files.
- Preserve page view state (list items, crumbs, scroll) across route changes to eliminate UI jitter on back.
- Add explicit refresh controls that bypass cache and fetch new data.
- Keep current custom cache, enhance its API to support peek/sync reads and policies.

## Current Behavior & Gaps
- FilesPage and FileViewerPage write to cache after server responses, but do not read from cache before fetching. This causes loading on back even when data exists in cache.
  - FilesPage.tsx: uses `setDirectory` only (no `getDirectory` before `requestTree`).
  - FileViewerPage.tsx: uses `setFile` only (no `getFile` before `open`).
- Route transitions unmount pages (Files and FileViewer are sibling routes). Without view-state preservation, the UI re-renders from scratch on back.

## Strategy Overview
1) Data: SWR cache policy
   - Cache-first render if any cached data exists (even if stale), then kick off background revalidation.
   - Show a small “Refreshing…” indicator during revalidation instead of full-page spinner.
   - Manual “Refresh” triggers a network-first fetch that bypasses cache.

2) UI State: View-state caching
   - Persist FilesPage view state per-path: nodes, crumbs, selection, and scroll position.
   - Restore these instantly on back without waiting for any network.

3) Navigation polish
   - Prefetch likely-next items on intent (hover, focus, or when opening a directory/file).
   - Restore scroll position on back.

4) Invalidation
   - Keep existing TTLs and invalidation events, but do not block UI when stale — only revalidate in background.
   - Manual refresh always re-fetches and updates cache.

## Design Details

### A. Cache API Enhancements
Augment `FileCache` and Context to support policies and instant reads.

- New APIs (non-breaking additions):
  - `peek(path, type)` → returns a non-expired memory entry synchronously if present (no IndexedDB read), else `null`.
  - `getWithPolicy(path, type, { policy })` where `policy` ∈ `"cache-first" | "network-first" | "stale-while-revalidate" | "cache-only"`.
  - `revalidate(path, type, fetcher)` → runs fetcher and updates cache, returning fresh data.
  - Optional: `allowStale` flag for `peek`/`get` to return stale for immediate paint, while separately revalidating.

Notes:
- Keep IndexedDB for persistence, but `peek` should be memory-only for speed on back/forward.
- Maintain TTL logic; for SWR we can still render stale and then refresh.

### B. View-State Cache (UI)
Add a simple, in-memory ViewStateContext to retain per-path state across route unmounts.

- Shape (example):
  - FilesPage state per `directoryPath`:
    - `nodes: FileNodeLike[]`
    - `crumbs: { name: string; path: string }[]`
    - `scrollY: number`
    - `lastLoadedAt: number`
  - FileViewerPage state per `filePath`:
    - `content: string`
    - `meta: { path?: string; size?: number; truncated?: boolean }`
    - `scrollY: number`

- Provide hooks:
  - `useFilesViewState(path)` to read/write the above.
  - `useFileViewState(path)` to read/write file viewer state.

### C. Page Integration (SWR + State)

1) FilesPage.tsx
   - On mount:
     - Try `peekDirectory(path)`; if present, set `nodes`/`crumbs` immediately and restore scroll; show subtle “Refreshing…” instead of blocking spinner.
     - Kick off background `requestTree(path)` to revalidate and update cache + UI when done.
     - If nothing cached, show current loading flow as fallback.
   - On open directory:
     - Save current scroll position into view-state for the current path; then navigate / fetch next directory.
   - Add a “Refresh” button:
     - Performs `invalidate(path, 'directory')` then executes `requestTree(path)`; keep current UI until new data arrives.

2) FileViewerPage.tsx
   - On mount:
     - Try `peekFile(path)`; if present, set `content`/`meta` immediately and restore scroll; show subtle “Refreshing…” instead of full loader.
     - Kick off background `open(path)` to revalidate. If no cache, use existing loading flow.
   - Add a “Refresh” action in the toolbar menu to force a fresh fetch.
   - When opening a file from FilesPage, prefetch parent directory (and optionally first N sibling files) to improve perceived speed upon back.

### D. Prefetching (Intent-driven)
- Keep router `defaultPreload: 'intent'`. Add tiny helpers to prefetch:
  - Directory prefetch on hover/focus of a folder.
  - File prefetch on hover/focus of a file item.
- For websocket fetches, expose a `prefetchDirectory(path)` / `prefetchFile(path)` that fire `sendJson` with a short-lived listener keyed by ID.

### E. Refresh Semantics
- “Refresh” UI action:
  - Directory: `invalidate(path,'directory')` → `requestTree(path)`.
  - File: `invalidate(path,'file')` → `open(path)`.
- Show a non-blocking “Refreshing…” chip near the item count or file meta.
- Optional: `Shift+R` shortcut to force refresh current view.

### F. Instrumentation
- Track: cache hits/misses, SWR revalidations, average revalidation time, render-from-cache count.
- Add a tiny, unobtrusive indicator when view is from cache and revalidating.

## Implementation Plan (Surgical Changes)

1) Cache API
   - Update `src/webview/react-frontend/src/lib/cache/FileCache.ts`:
     - Add `peek(path, type)` (memory-only, sync) and `getWithPolicy(...)` helpers.
   - Update `src/webview/react-frontend/src/contexts/FileCacheContext.tsx`:
     - Expose `peekFile`, `peekDirectory`, and `revalidate`/`getWithPolicy` helpers.

2) View-State Context
   - Add `src/webview/react-frontend/src/contexts/ViewStateContext.tsx` with the per-path state and hooks.

3) FilesPage integration
   - `src/webview/react-frontend/src/pages/FilesPage.tsx`:
     - On mount and `openNode`:
       - Use `peekDirectory` to render immediately if present.
       - Start background `requestTree` for SWR.
     - Save/restore scroll with `ViewStateContext`.
     - Add a “Refresh” button that bypasses cache.

4) FileViewerPage integration
   - `src/webview/react-frontend/src/pages/FileViewerPage.tsx`:
     - Use `peekFile` on mount for instant render if present.
     - Start background `open` for SWR.
     - Add a “Refresh” action to force fresh fetch.

5) Prefetch helpers
   - Add small, cancel-safe prefetch functions:
     - `src/webview/react-frontend/src/lib/files/prefetch.ts` with `prefetchDirectory(path)` and `prefetchFile(path)`.
   - Wire optional hover/focus prefetching in FileTree and file links.

6) UX polish
   - Replace blocking spinners with subtle “Refreshing…” when rendering from cache.
   - Keep blocking spinner only when there is absolutely no cached data.

## Acceptance Criteria
- Back from a file to its directory renders instantly (no full-screen loading) if directory was visited before.
- Opening a recently viewed file renders instantly from cache when available, with a small “Refreshing…” indicator.
- Manual Refresh updates content from the server, ignoring cache, and the UI reflects the latest data.
- Scroll position is restored on back for both Files and File Viewer.
- No regressions in invalidation: watcher events and TTL still cause background revalidation or cache refresh.

## Risks & Mitigations
- Stale view on long-lived tabs: mitigate with visible “Refreshing…” and periodic revalidation (existing watcher/TTL).
- Complexity of websocket prefetch: keep prefetch optional; focus first on SWR + view-state to deliver most gains.
- Memory growth from view-state: bound per-path entries (LRU cleanup) and clear on major git operations.

## Rollout
1) Implement API + view-state hooks.
2) Integrate FilesPage with SWR + state restore.
3) Integrate FileViewerPage with SWR + state restore.
4) Add explicit Refresh controls.
5) Optional: add prefetch-on-intent.
6) Measure and tune TTLs and indicators.

## Notes
- We intentionally avoid migrating to React Query/SWR libraries to minimize churn. If desired later, the above policy hooks map cleanly to TanStack Query (`staleTime`, `cacheTime`, `prefetchQuery`, `invalidateQueries`).

