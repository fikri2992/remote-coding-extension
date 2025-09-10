# Files Menu: Cache Removal Implementation Summary

## Overview
- Goal: Remove all caching and view-state mechanisms from the Files menu to simplify data flow. The Files view now always fetches fresh directory listings, with performance aided by server-side .gitignore filtering.

## Files Affected
- `src/webview/react-frontend/src/pages/FilesPage.tsx`

## Changes
- Removed usage of client-side directory cache and view-state:
  - Deleted imports and usage of `useFileCache` (peek/set) and `useViewState` (get/set).
  - Removed pre-paint from cache or view-state; no more "instant" cached render.
  - Removed caching of responses and saving view-state after load.
- Simplified data flow:
  - `loadDirectory(path)` now always calls `requestTree(path, background=false)`.
  - Initial load effect always calls `loadDirectory(initialPath)` (no cache/view-state branches).
  - Message handler updates `nodes` directly and finishes pending; no cache/view-state writes.
- Kept UX signals minimal:
  - Removed CacheStatusIndicator from Files header.
  - Header "Refreshing" chip was removed earlier; only the Refresh button shows a delayed spinner.
  - TopProgressBar remains tied to pending navigation.
- Filter toggles remain functional and server-backed:
  - "Show hidden" toggles `allowHiddenFiles`.
  - "Show ignored" toggles `useGitIgnore` (inverted: show ignored = disable ignore filter).
  - Requests include these options; results are not cached client-side.

## Rationale
- With server-side .gitignore filtering, directory listings are significantly leaner, reducing the need for complex client caching.
- Eliminating cache/view-state in FilesPage reduces UI flicker, state desync, and simplifies pending lifecycle.

## Impact
- Files view always reflects current filesystem based on filters.
- No stale results from cache; consistent navigation and refresh.
- Other parts of the app remain unaffected; only FilesPage stops using FileCache/ViewState.

## Validation
- Navigate across directories (root → src → nested) verifying:
  - Breadcrumbs update immediately.
  - Back and crumb clicks fetch fresh data.
  - Show hidden/ignored toggles affect results instantly.
  - Refresh uses only the button spinner; no header chip.
