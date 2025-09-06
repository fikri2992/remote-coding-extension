# Mobile-First Code & Diff Viewer Plan

## Overview
This plan rethinks the code viewer, diff viewer, and file explorer with a mobile‑first lens. It focuses on fast load, large tap targets, thumb‑reachable controls, simplified UIs, and responsive behavior that scales gracefully to desktop. It also includes an improved file/folder icon system optimized for small screens.

## Current State (Mobile Audit)
- Code viewer (FileViewerPage)
  - Top toolbar; secondary status bar; CodeMirror viewer; large-file fallback.
  - Controls are dense; small tap targets; controls are top‑only.
  - Search/go-to via prompt or CM panel; not thumb‑friendly.
- Diff viewer (DiffFile/CodeDiffViewer)
  - Inline and side‑by‑side; hunk headers; word-level diff highlighting.
  - Controls live inside file card; some items are small for touch.
- File explorer (FileTree/FileNodeItem)
  - Icons exist but lack strong differentiation on small screens.
  - Row density high; selection targets small; context not obvious.

## Mobile UX Principles
- Tap targets ≥ 44px height; spacing ≥ 8–12px.
- Primary actions in thumb zone (bottom); secondary actions in a bottom sheet.
- Progressive disclose: show essentials first; advanced in a sheet.
- Clear affordances: sticky headers/footers; scroll hints; skeletons.
- Avoid jank: limit heavy visual effects; favor CSS over JS when possible.

## Code Viewer (Mobile Design)
- Layout
  - Sticky top breadcrumb/title; sticky bottom action bar.
  - Bottom sheet (modal) for viewer options (wrap, line #, font size, theme, whitespace, language override).
  - Status area integrated into bottom bar (sel length, line count), collapsible.
- Controls (bottom bar)
  - Primary buttons: Find, Go, Wrap, More (opens sheet), Copy.
  - Large segmented control in sheet for S/M/L font and themes.
  - Toggle groups: Wrap, Line #, Indent guides, Whitespace.
  - Language override: dropdown with search.
- Gestures
  - Double tap toggles wrap.
  - Long press opens selection/copy popover.
  - Horizontal scroll hint chip on overflow.
- Readability
  - Default font-size +2px on mobile; comfortable line-height.
  - Soft wrap indent guides for wrapped lines.
  - Option to clamp content width (wrap column) for readability.
- Performance
  - Dynamic language imports (done). Defer one-dark theme import until used.
  - Disable expensive decorations for files > N lines. Switch to fallback earlier on mobile.
  - Recycle CM instance across navigation to cut TTFR (optional).

## Diff Viewer (Mobile Design)
- Default to Inline view on mobile; SxS only in landscape or ≥ 768px.
- Hunk headers: sticky within viewport; big Collapse/Expand target.
- Toolbar (inside diff file card):
  - Primary: Inline/SxS (disabled if width small), Wrap, Ignore WS, Find.
  - Secondary (sheet): font size, expand/collapse all hunks, word-level toggle.
- Readability
  - Larger paddings; clear color coding; compact gutters.
  - Sticky horizontal scroll hint chip when overflowed.
- Performance
  - Virtualize long diffs (windowing per-hunk) when over threshold.

## File Explorer (Mobile Design)
- Rows
  - Min height 48–52px; left‑aligned prominent icon; bold filename.
  - Secondary line: file size/date or “N items” for folders.
  - Long-press opens bottom sheet with actions.
- Navigation
  - Sticky header with breadcrumbs; swipe back support (if host allows webview gestures).
- Search and filters
  - Top search field; type filters (code, config, images) as chips.

## Improved Icon System (Mobile Optimized)
- Goals
  - Strong differentiation at 16–20px icons on small screens.
  - Minimal cognitive load: consistent color families per language/domain.
- Strategy
  - Smart folder icons (node_modules, .git, src, test, dist, public, assets).
  - File type icons with color map; fallback to monograms for uncommon types.
  - Optional small badge (two-letter) for unrecognized types (e.g., “tf”, “lock”).
- Implementation Outline
  - Central icon map util: `getFileIcon(name, type)` returns React node and color class.
  - Sizes: 20px (default), 18px (dense). Hit area expanded via padding, not just icon size.
  - Color tokens aligned to theme variables; ensure contrast in dark/light.
- Suggested Mapping (examples)
  - JS/TS: yellow/blue; JSON: blue; YAML: purple; MD: indigo; HTML: orange; CSS: cyan.
  - Env/dotfiles: gray with accent; Git: red; Docker: blue; Config: slate.

## Accessibility
- ARIA roles for code/diff regions; announce hunk toggle and counts.
- Ensure color is not sole indicator (add markers/labels).
- Respect prefers-reduced-motion; minimize animations.
- Support large text (system font scale) without layout breakage.

## Phased Implementation Plan
- Phase 1: Foundations
  - Add bottom action bar component; wire primary actions.
  - Move viewer options to bottom sheet; persist across sessions.
  - Increase default font-size and line-height on mobile (media query).
  - Add scroll hint chip for horizontal overflow.
- Phase 2: Diff UX on Mobile
  - Make Inline default; gate SxS to landscape/≥768px; sticky hunk headers.
  - Expand/Collapse all hunks; word-level toggle; wrap column in sheet.
  - Optional: hunk virtualization for long diffs.
- Phase 3: File Explorer
  - Implement new icon system util; update FileNodeItem/FileTree.
  - Increase row height; dual-line metadata; long‑press sheet.
  - Type filter chips and mobile search flow.
- Phase 4: Performance & Polish
  - Defer heavy imports (theme, markdown) behind interactions.
  - Prune decorations for large files/diffs on mobile.
  - Audit tap targets and spacing across light/dark/neo themes.

## Detailed TODOs
1) Code viewer mobile bar + sheet
- Add `CodeBottomBar.tsx` with primary buttons (Find, Go, Wrap, More, Copy).
- Use `bottom-sheet` component for options; regroup toggles/size/theme/language.
- Hook gestures: double tap to toggle wrap.
2) Diff mobile UX
- Sticky hunk headers; expand/collapse all in sheet; Inline default on narrow.
- Gate side-by-side by media query; fallback gracefully.
3) Icons upgrade
- Add `getFileIcon.tsx` with mapping and monogram fallback.
- Update `FileNodeItem.tsx` to use new util; adjust size/padding.
- Add subtle color families with theme-aware classes.
4) Performance
- Lazy-load one-dark theme and react-markdown only on selection/use.
- Earlier fallback thresholds on mobile.

## Success Metrics (Mobile)
- TTFR ≤ 800ms for typical files (< 500KB) on mid-range device.
- 60fps scrolling; no frame drops on standard diffs.
- 100% tap targets ≥ 44px; toolbar actions reachable by thumb.
- Bundle: main chunk < 400KB gzip after split (excluding terminal deps).

## Risks & Mitigations
- Bottom bar may overlap content → use safe area insets and content padding.
- Extra UI chrome may add clutter → keep bottom sheet for advanced options.
- Icon color conflicts in dark mode → use tested token palette & WCAG contrast.

## Rollout
- Ship viewer bottom bar + sheet behind setting; enable by default on mobile.
- Update diff viewer next; then file explorer icons; then remaining polish.

---

This mobile-first plan emphasizes bigger, fewer, clearer controls with responsive layouts, iconography fitted for small screens, and performance choices that keep interactions smooth on mobile.

## Simplification Strategy (v2)

Goal: reduce visible chrome, avoid overlapping overlays, and make one clear place for primary actions. Design for thumb use first; keep advanced options one tap away.

Principles
- One focus at a time: Only one overlay may be open (Search OR Options OR Selection). Opening one closes the others.
- Bottom-first: Primary actions live in the bottom bar. All auxiliary controls live in a bottom sheet or a slim row docked above the bar.
- Reserve space: Content container always includes bottom padding equal to the height of visible chrome (bar + row). Nothing overlaps code.
- Progressive disclosure: Keep the default state minimal — show only Search, Copy, More. Show Copy Selection row only when selection exists. Wrap/Line#/Theme/Language live in the sheet.
- 8px rhythm: Standardize paddings and tap-targets (≥44px height).

Composition
- Bottom Bar (persistent): Search, Go, Copy, More. Icon-only on phones; labels show on long-press or tooltip.
- Search Row (transient): small input + Prev/Next; options (case/regex/word) in a compact popover — not inline checkboxes. Appears docked above the bar. Dismisses on Esc/scroll/tap outside.
- Selection Row (contextual): shows Copy Selection and Clear Selection when selection exists. Docked above the bar; mutually exclusive with Search Row.
- Options Sheet (on demand): Wrap, Line #, Indent, Whitespace, Font size, Theme, Language, Download. Remove Copy/Copy Selection from the header; keep only in row/sheet to reduce clutter.
- Header: Back/breadcrumb + filename and tiny metadata chips (lines, size). No primary actions in the header on mobile.

Diff Specific
- Default Inline on mobile. Side-by-Side gated to landscape/≥768px with an informational note in the sheet. Keep only Wrap quick-toggle inline; everything else in sheet. Hunk headers sticky; Expand/Collapse all in sheet.

Interaction Rules
- Search opens via bottom bar Search or Ctrl/Cmd+F; closes when Options opens, selection row appears, or when user scrolls/escapes.
- Selection Row shows when CodeMirror selection length > 0; closes when cleared or editor loses selection.
- Options Sheet blocks Search/Selection; closing sheet restores previous context bar if still relevant.

Accessibility
- Use aria-live to announce search result navigation (e.g., “3 of 12”).
- Ensure focus order: bar → row input → results (prev/next) → sheet controls.
- Respect safe-area insets.

## Concrete Changes
1) BottomChromeLayout
- A small controller hook/component that tracks which chrome is open (bar/search/selection/sheet) and computes required bottom padding for the content. Exposes `openSearch`, `openSelection`, `openSheet`, `closeAll`.

2) SearchRow
- Compact row (56px): input, prev/next arrows, a button that opens a tiny options popover (case/regex/word). No checkboxes spanning two lines.
- On mobile, dock above bar; on tablet/desktop, dock below header.

3) SelectionRow
- Appears only if `selection.chars > 0`. Buttons: Copy Selection, Clear. High contrast; docked above bar.

4) Bottom Bar
- Icons: Search, Go, Copy, More. Remove Wrap from the bar; keep in sheet. Align icons to center with equal spacing.

5) Options Sheet (tidy)
- Two groups: View (Wrap, Line #, Indent, Whitespace) and Appearance (Size, Theme). Advanced: Language override, Download. Remove redundant actions from header.

6) Header (tidy)
- Keep Back + Breadcrumb + filename. Move Copy/Download to sheet; status chips (lines, size, truncated) below the header in a single line.

7) Mobile Breadcrumb Navigation
- Make path segments tappable: `/src/code/example.js` → `/` `src` `code` `example.js`.
- Tapping a segment navigates to that folder in Files (preserving query param `path`).
- Horizontal scroll for long paths; long-press to copy full path.

7) Diff Viewer (tidy)
- File card header: filename and type chip only. Inline Wrap toggle; all else in Diff Options Sheet. Add note when SxS disabled due to width.

## Implementation Plan (Iteration)
- Iteration A: Introduce BottomChromeLayout; convert Search to SearchRow (popover options); SelectionRow; adjust content padding.
- Iteration B: Trim FileViewer header; move Copy/Download into Options Sheet; ensure only one chrome is visible at a time.
- Iteration C: Diff tidy — move most controls into sheet; leave Wrap as inline toggle; add width note for SxS.
- Iteration D: Accessibility polish — focus order, announce position (x of y), keyboard shortcuts mapping.

## Large File Strategy (Mobile)
- Early fallback: Switch to static rendering sooner on mobile (e.g., > 500KB or > 10k lines), with a “load in chunks” option.
- Chunked view: Paginate large files into N-line chunks (e.g., 2k lines) with “Next/Prev chunk” controls docked near the bottom bar.
- Disable heavy features automatically: Hide word-level highlights and whitespace markers for very large files; keep selection and copy efficient.
- Streaming indicator: Show a lightweight progress state while loading next chunk.
- Crash prevention: Guard against unbounded DOM nodes; cap rendered lines; avoid `dangerouslySetInnerHTML` for huge payloads.

## Navigation Improvements (Mobile)
- Tappable breadcrumbs (above): fast path to parent folders.
- Quick actions in bar: Go-to-line remains via quick prompt; add a “jump to top/bottom” double-tap on the status line.
- Optional command palette: bottom-anchored list of actions searchable by keyboard.

## Alternate Approaches (Consider)
- Command Palette: Replace More sheet with a command palette (bottom‑anchored) that lists actions (Wrap, Line #, Theme, Download). Searchable and scalable.
- Floating Action Button (FAB): One FAB that toggles between Copy / Copy Selection depending on context (risks discoverability tradeoffs).
- Single-Row Bar with Search Field: Replace SearchRow with an expandable field in the bar (keeps a single chrome element at the expense of tighter spacing).

## QA Checklist
- Bottom padding updates correctly when Search/Selection/Sheet shows.
- Only one chrome visible at any time.
- No overlap with soft keyboard on Android/iOS.
- Tap targets ≥44px; consistent spacing.
- Search navigation performant on 10k+ lines; options apply instantly.

## Update: Search UI Integration (Mobile)
- Replace CodeMirror’s default search panel with a custom, responsive `CodeSearchBar` overlay.
- Open from the bottom action bar; anchor above the bar to avoid overlap.
- Options: match case, regexp, whole word; Prev/Next navigation; Close.
- Implementation: wire to CodeMirror using `setSearchQuery` and `findNext/Previous`.
- Outcome: No overlapping UI, thumb‑friendly controls, consistent styling.
