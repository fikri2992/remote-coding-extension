# Code Viewer UX Improvement Plan

## Overview
This plan upgrades the code viewing experience with a focus on readability, simplicity, and performance. It delivers modern viewer essentials: reliable syntax highlighting, word wrap, fast navigation (find, go-to-line), accessible controls, and sensible defaults that stay out of the way.

## Current State (Audit)
- File viewer page: `src/webview/react-frontend/src/pages/FileViewerPage.tsx`
  - Provides header with file meta and controls for font size, theme, and line numbers.
  - Renders code with `SyntaxHighlighter` (custom, regex-based), no word wrap option.
- Syntax highlighter: `src/webview/react-frontend/src/components/code/SyntaxHighlighter.tsx`
  - Detects language by extension; highlights a small subset (js/ts/json/css/markdown) via regex + `dangerouslySetInnerHTML`.
  - No search, go-to-line, wrap, indentation guides, whitespace reveal, or keyboard shortcuts.
  - Limited patterns; many detected languages fall back to plain text.
- Diff viewer: `src/webview/react-frontend/src/components/git/DiffFile.tsx`, `DiffView.tsx`
  - Inline unified diff with a wrap toggle per file and basic per-line highlighting via `DiffLine` (from `SyntaxHighlighter`).
  - No side-by-side view, no intra-line/word diffs, no ignore-whitespace toggle, no expand/collapse of large hunks.
- Prism entry-point file exists but is empty: `src/webview/react-frontend/src/components/code/PrismHighlighter.tsx`

Summary: The viewer has a solid shell (toolbar, basic meta), but highlighting is ad‑hoc, and key reading UX (wrap, search, go-to-line, language breadth, performance fallbacks) are missing.

## Goals
- Make code effortless to read: crisp syntax highlighting, smooth wrap, readable typography, and low visual clutter.
- Add core navigation: find-in-file, go-to-line, selection summary, and copy actions.
- Keep it fast and safe for large files: smart fallbacks without freezing the UI.
- Maintain a consistent, accessible UI that follows app themes and persists user preferences.

## Non-Goals
- Full code editing (read-only viewer only for now).
- Language servers or IntelliSense.

## UX Improvements (What Users Get)
- Word wrap toggle with “wrap at column” option; soft wrap indentation.
- Reliable highlighting for 40+ languages; manual language override when needed.
- Line numbers, indent guides, whitespace reveal, highlight active line; sticky toolbar.
- Find-in-file (Ctrl/Cmd+F) with custom, non-overlapping search bar (replaces CM default panel) with options: case, regex, whole word; next/prev; go-to-line (Ctrl/Cmd+G).
- Copy all / copy selection / download raw; show selection length and line range.
- Large file safeguards: graceful fallback to plain/streamed view with a clear notice.
- Settings persistence per user: font size, theme, wrap, line numbers, language override.
- Diff upgrades: inline/side-by-side toggle, word-level diffs, hunk collapsing, ignore whitespace.

## Technical Approach
Two-tier rendering for the best of both worlds:
1) Primary viewer (recommended): CodeMirror 6 (read-only)
- Pros: Excellent performance with long lines, first-class wrap, search, go-to-line, gutters, themes, many languages via Lezer; tiny surface for us to maintain.
- Packages: `@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/search`, `@codemirror/gutter`, language packs (ts/js, json, css, html, markdown, python, shell, yaml, etc.).

2) Fallback highlighter: Shiki or Prism (for static HTML rendering)
- Use when files are extremely large or binary-ish to avoid heavy DOM updates.
- Shiki yields beautiful, consistent tokens across themes; Prism is simpler and lighter. Choose Shiki if footprint is acceptable; otherwise Prism.

Diff rendering
- Keep unified view but add word-level diffs (e.g., `diff-match-patch` or `fast-diff`).
- Optionally add side-by-side layout using two synchronized, read-only CodeMirror instances.

## Implementation Plan (Phased)

Phase 1 — Core Viewer Foundations
- Create `CodeViewer` (read-only) based on CodeMirror 6
  - File: `src/webview/react-frontend/src/components/code/CodeViewer.tsx`
  - Props: `code`, `language?`, `filename?`, `wrap?`, `lineNumbers?`, `fontSize?`, `theme?`, `indentGuides?`, `whitespace?`, `onStats?`.
  - Integrations: gutters (line numbers), indent guides, highlight active line, theme integration.
- Add Wrap + Line Numbers + Font Size + Theme controls
  - Factor a shared toolbar: `src/webview/react-frontend/src/components/code/CodeToolbar.tsx` (size S/M/L, theme, wrap, line #, whitespace, indent guides).
  - Persist with a tiny hook: `usePersistentState` in `src/webview/react-frontend/src/lib/hooks/usePersistentState.ts`.
- Language detection
  - Extend mapping from file extension; add manual override dropdown in toolbar.
  - Load on-demand language support for CodeMirror.
- Integrate in `FileViewerPage`
  - Replace `SyntaxHighlighter` with `CodeViewer` (keep `SyntaxHighlighter` as fallback for huge files).
  - Respect existing meta (size, truncated flag) to decide fallback mode.

Phase 2 — Navigation & Utilities
- Find-in-file panel and shortcuts (Ctrl/Cmd+F)
  - Replace CodeMirror’s default search panel with a custom `CodeSearchBar` to avoid UI overlap and ensure mobile compatibility. Wire via `setSearchQuery` and `findNext/Previous`.
- Go-to-line (Ctrl/Cmd+G) quick panel; support `123` or `123:45`.
- Copy actions
  - Copy file, copy selection, copy with line numbers, download raw.
  - Show selection length and selected line range in status area.
- Sticky toolbar and responsive layout
  - Ensure toolbar remains visible; compress to icon-only on narrow screens.

Phase 3 — Syntax & Theming
- Expand language support for 40+ languages
  - Install CodeMirror language packs as needed, lazy-load by extension.
- Theme integration
  - Map app themes to CodeMirror themes; add a neo-flavored CM theme variant to match the design system.
- Markdown mode
  - For `.md`, offer Rendered/Raw toggle using `react-markdown` with code block highlighting via CodeMirror (or Shiki/Prism for code blocks only).

Phase 4 — Performance & Large Files
- Large file heuristics
  - Thresholds by size and line count; display a banner when falling back from CodeMirror to static rendering.
- Virtualization strategy
  - Rely on CodeMirror’s viewport for most files; for extreme cases, switch to static `<pre>` with minimal markup and optional chunked rendering.
- Binary detection & safety
  - If binary/suspect content, show a safe preview message with a download option.

Phase 5 — Diff Viewer Enhancements
- Inline vs Side-by-Side toggle
  - Side-by-side: two `CodeViewer` instances with synchronized scroll.
- Word-level diffs
  - Compute intra-line diffs for modified lines; highlight diff tokens.
- Hunk management
  - Collapse/expand long hunks; “expand context” buttons.
- Ignore whitespace toggle, unified stats header per file.

Phase 6 — Accessibility, QA, and Polish
- A11y
  - ARIA roles for code regions; ensure line numbers are aria-hidden; logical tab order; shortcuts listed in a help modal (e.g., `?`).
- QA & Testing
  - Snapshot tests for toolbar states; unit tests for language selection, wrap toggles; performance sanity with large samples.
- Documentation
  - Update `docs/README.md` and add a short “Code Viewer Tips” section.

## Detailed Tasks
1) CodeMirror integration
- Add dependency packages (webview React project):
  - `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/search`, `@codemirror/gutter`
  - Language packs: `@codemirror/lang-javascript`, `@codemirror/lang-json`, `@codemirror/lang-xml`, `@codemirror/lang-html`, `@codemirror/lang-css`, `@codemirror/lang-markdown`, `@codemirror/lang-python`, `@codemirror/lang-java`, `@codemirror/lang-rust`, `@codemirror/lang-php`, `@codemirror/lang-sql`, `@codemirror/lang-yaml`, `@codemirror/lang-shell`, etc.
- Implement `CodeViewer.tsx` with read-only setup, dynamic language loading, and props-controlled extensions (wrap, gutters, indent guides, whitespace reveal, highlight active line).

2) Toolbar & persistence
- Implement `CodeToolbar.tsx` (wrap, line #, indent guides, whitespace, theme, font size, language override).
- Implement `usePersistentState` (localStorage-backed with schema/version key) and wire preferences in `FileViewerPage`.

3) FileViewerPage integration
- Replace `SyntaxHighlighter` usage with `CodeViewer` by default.
- Add a “Performance fallback” banner when using static mode for large files; expose a “force CodeMirror” toggle for power users.

4) Find & go-to-line
- Build a compact find panel; wire keyboard shortcuts and CM search APIs.
- Add go-to-line input and handle `line[:column]` patterns.

5) Diff enhancements
- Create `CodeDiffViewer.tsx` supporting inline and side-by-side modes.
- Compute word-level diffs for modified lines; highlight diff tokens.
- Add ignore-whitespace toggle and hunk collapse/expand.

6) Markdown rendering
- Add `react-markdown` for `.md` files with a simple toggle to switch to Raw.
- Ensure code fences inside markdown are highlighted with the same system.

7) Accessibility & polish
- Hide gutters from screen readers; ensure toolbar controls have labels and shortcuts.
- Provide a `?` shortcuts hint modal.

## Files To Add/Change
- New
  - `src/webview/react-frontend/src/components/code/CodeViewer.tsx`
  - `src/webview/react-frontend/src/components/code/CodeToolbar.tsx`
  - `src/webview/react-frontend/src/components/code/CodeDiffViewer.tsx`
  - `src/webview/react-frontend/src/lib/hooks/usePersistentState.ts`
- Update
  - `src/webview/react-frontend/src/pages/FileViewerPage.tsx` (swap in CodeViewer; add toolbar and persistence)
  - `src/webview/react-frontend/src/components/git/DiffFile.tsx` (redirect to new diff viewer; add controls)
  - `src/webview/react-frontend/src/components/code/SyntaxHighlighter.tsx` (keep as fallback; optionally expand patterns minimally)
  - `src/webview/react-frontend/src/components/code/PrismHighlighter.tsx` (implement only if Shiki is skipped and Prism is used as fallback)

## Success Metrics
- Time-to-first-render (TTFR) for < 2MB text files: < 200ms on mid-tier hardware.
- Smooth scroll and interactions with 20k+ lines; no noticeable jank.
- Search operations across 10k lines: < 50ms per query update.
- 95th percentile “copy all” action completion: < 50ms.
- Accessibility checks pass (keyboard-only usage, ARIA roles, contrast).

## Risks & Mitigations
- Bundle size growth (CodeMirror + languages)
  - Mitigation: Lazy-load languages; build split; ship critical languages by default.
- Very large files causing memory pressure
  - Mitigation: Fallback to static rendering with a clear notice; chunked display; disable heavy features.
- Keyboard shortcuts conflicts
  - Mitigation: Scope to webview; offer a help modal and toggleable bindings.

## Rollout
- Phase 1 behind a feature flag in settings; dogfood internally.
- Replace default viewer once TTFR and usability targets are met.
- Keep fallback renderer in place for edge cases.

## Quick Wins (Do Now)
- Add wrap toggle to FileViewer (pre-CM): use CSS `whitespace-pre-wrap break-words` for current `SyntaxHighlighter` rows.
- Implement copy/download buttons (already partially present: “Copy”).
- Persist font size and theme between sessions.

---

This plan prioritizes a familiar, frictionless reading experience with robust fundamentals (wrap, search, line nav) and pragmatic performance safeguards, while aligning visually with the existing neo design language.

## Update: Search UI
- Issue: The default CodeMirror search panel overlapped toolbars and bottom bar, disrupting layout.
- Resolution: Introduced a custom `CodeSearchBar` component (mobile & desktop) that integrates cleanly with the layout.
- Behavior: Ctrl/Cmd+F opens the custom bar (via the Find action hook). The bar manages query + options and uses CodeMirror’s `setSearchQuery` and next/prev commands.
- Result: Consistent theming, non-overlapping UI, and improved usability on mobile.
