# Chat UI — AI Bubble Cleanup Plan

Purpose: make assistant/tool/system message bubbles cleaner, easier to scan, and mobile‑friendly while staying consistent with the neo brutalist theme and existing shadcn primitives.

## Current Pain Points
- Visual density: long assistant answers (markdown, code, diffs, terminal) feel heavy and uneven.
- Inconsistent chrome: borders/shadows differ between user vs. assistant vs. tool bubbles.
- Mixed content styles: code, diffs, terminal output, and tool call frames look similar; hard to distinguish.
- Action buttons (e.g., Apply diff) look small on mobile and blend into content.
- Poor vertical rhythm: variable spacing between blocks, especially around code and lists.
- Context chips/links inside bubbles don’t read like attachments.
- Streaming states (chunks) not visually differentiated from final.
- Long outputs stretch width; scanning across >80ch is tiring.

## Design Principles
- Typography first: 14–15px base with 1.6 line-height; code at 13px.
- Limit readable width for assistant/tool bubbles (≈70–80ch), allow full‑bleed for special blocks (code/diff/terminal) with subtle container.
- Clear hierarchy: title/meta → content → actions.
- Minimal chrome: a single border style, strong left accent for assistant; subtle background for tool/system.
- Mobile first: touch targets ≥44px, avoid horizontal scrolling; wrap long tokens gracefully.
- Accessibility: role landmarks, aria labels on actions, focus outlines, high contrast.

## Components To Touch
- `src/webview/react-frontend/src/components/chat/MessageBubble.tsx`
- `src/webview/react-frontend/src/components/chat/Markdown.tsx`
- `src/webview/react-frontend/src/pages/ChatPage.tsx` (render helpers for parts)
- Code/diff/terminal blocks:
  - `components/code/CodeViewer.tsx`, `components/code/CodeDiffViewer.tsx`
  - `components/terminal/MessageBubble.tsx`

## Visual System
- Widths
  - User bubble: max 70ch; right aligned.
  - Assistant bubble: max 80ch; left aligned; left accent bar 2–3px.
  - Full‑bleed blocks (code/diff/terminal): stretch to container width with own border and background.
- Chrome
  - Border: 2px in neo mode; 1px otherwise; rounded 8 (neo → 0).
  - Assistant accent (dark): use the refined amber (see theme doc) at 80% opacity for the left bar; background stays surface.
  - Tool bubble: subtle muted background; small “Tool” label + icon.
  - System bubble: minimal; small caption text.
- Spacing
  - Bubble outer margin: 8px between bubbles, 16px between roles.
  - Inner padding: 12–16px; 8px for system.
  - Block spacing inside: 8px; code/terminal 12px.
- Typography
  - Base: text-sm (14px) with leading-relaxed.
  - Headings: clamp down h1–h3 to h3 size inside bubbles.
  - Code: mono 13px; wrap long lines; horizontal scroll only when needed.

## Content Treatments
- Markdown
  - Restrict heading sizes; tighten margins; better list spacing.
  - Link style consistent with app links.
- Code Blocks
  - Use existing highlighters; place inside bordered container with header row (file name/copy action optional).
  - Soft background (muted); overflow-x auto; max-height with collapse toggle for very long output.
- Diffs
  - Use `CodeDiffViewer`; include file path header and “Apply”/“Copy” actions in a top toolbar (sticky within the block on mobile).
- Terminal Output
  - Fixed-width, subtle stripes or corner tag “terminal”; preserve whitespace; optional collapse when >N lines.
- Tool Calls
  - Compact header chip with name/status; details collapsible; show path/locations as list.
- Attachments (resource/resource_link)
  - Render as attachment cards with file name, size, link; preview for small text.

## Interaction Patterns
- Streaming
  - Show animated caret at end of assistant streaming; fade once final frame arrives.
- Actions
  - Buttons: primary ≥44px height, icon+label; group top‑right of block content.
- Long Content
  - Collapsible sections: “Show more” for >600px blocks; remember per‑session preference.

## Accessibility
- Every bubble has role and aria-label including role and timestamp.
- Focusable actions, ESC to close any in‑bubble menus; keyboard nav through code blocks.

## Implementation Plan (Phased)
1) Bubble Shell
   - Update `MessageBubble.tsx` to support variants: user | assistant | tool | system.
   - Add left accent bar for assistant; consistent border/padding.
   - Constrain content width; allow full‑bleed slots for heavy blocks.
2) Markdown Refinement
   - Adjust `Markdown.tsx` prose classes: heading clamp, margin scale, link styling.
3) Block Components
   - Create lightweight wrappers for code/diff/terminal with a common header area for actions and labels.
   - Integrate into `ChatPage` render helpers.
4) Tool Call Presentation
   - Convert tool call meta into header chips + collapsible details.
5) Collapsible Long Blocks
   - Utility to measure block height and wrap with “Show more”.
6) Mobile Polishing
   - Touch target audit; ensure horizontal scroll for code only; sticky action bars for diffs.
7) Theming Pass
   - Use new dark‑mode amber; verify contrast ratios; ensure neo borders.
8) A11y Pass
   - Labels, landmarks, focus rings, tab order, reduced motion.

## Acceptance Criteria
- Assistant bubbles have a visible but subtle left accent and clean border.
- Code/diff/terminal blocks are clearly distinct with headers and actions; collapse works.
- Tool calls are scannable and compact by default.
- No horizontal scroll in text content on mobile; actions ≥44px height.
- Streaming indicator appears during generation and disappears when complete.
- All interactive elements are keyboard accessible and have visible focus.

## Risks / Constraints
- Don’t break existing code/diff viewers’ APIs.
- Keep rendering performant for very long transcripts (virtualization deferred).

## Follow‑ups (Out of Scope for First Pass)
- Virtualized message list.
- Persistent per‑block expand/collapse across reloads.
- Theming tokens for warning/info chips.

