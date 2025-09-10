# Files Image Preview – Implementation Checklist

Use this checklist to verify the image Preview/Code experience matches the plan and acceptance criteria.

## Essentials
- [ ] Image files open with Preview selected by default.
- [ ] Tabs visible: Preview and Code (for all images).
- [ ] SVG: Preview renders the image; Code shows the raw XML in the code viewer.
- [ ] Raster (png/jpg/jpeg/gif/webp/bmp/ico): Code tab shows a short binary notice (no huge base64 dump).
- [ ] Back, Refresh, breadcrumbs, and counts behave exactly as before.
- [ ] Download works for SVG (Blob from text) and raster (Blob from base64).
- [ ] No console errors on open, tab toggle, refresh, or download.

## Server/API
- [ ] `open` returns a union shape for text vs. binary:
      Text: `{ path, content, encoding: 'utf8', truncated, size }`
      Binary image: `{ path, base64, encoding: 'base64', contentType, size }`
- [ ] SVG is treated as text (not base64).
- [ ] `contentType` is correct for raster images (e.g., `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/x-icon`).
- [ ] `maxBinaryBytes` enforced; large images return a clear error (not a truncated base64 payload).
- [ ] Error shape consistent and actionable: `{ ok: false, errorCode, message, size? }`.
- [ ] `options.format` supported (`'auto' | 'text' | 'binary'`), default `'auto'`.
- [ ] Primary detection by extension; behavior remains predictable for common image types.

## Frontend/UI
- [ ] `isImage` and `isSvg` determined from the file extension.
- [ ] Local state `mediaView` defaults to `'preview'` for images.
- [ ] Preview/Code segmented control appears only for images and is keyboard accessible.
- [ ] Code-only controls (find, goto, wrap, language) are hidden in Preview and visible in Code.
- [ ] Toggling tabs does not refetch unnecessarily (SVG reuses text already fetched).

## Rendering
- [ ] SVG renders via `<img src="data:...">` or Blob URL (never injected via `innerHTML`).
- [ ] Raster preview uses a data/Blob URL; image is centered, `object-contain`, with a sane max height.
- [ ] Animated GIF/WebP animate as expected; no special controls required.

## Error Handling
- [ ] Oversized raster (> `maxBinaryBytes`) shows a friendly error with a Download option.
- [ ] Unknown or mislabeled extension degrades gracefully (fallback message, no crashes).
- [ ] Truncated SVG (text over `maxTextBytes`) shows a truncation notice in Code and suggests Download.

## Accessibility
- [ ] Tabs implement correct roles/aria (`role="tablist"`, `role="tab"`, `aria-selected`).
- [ ] Arrow keys move focus between tabs; Enter/Space activates.
- [ ] Tab changes are announced (aria-live or equivalent).
- [ ] `<img>` has an `alt` derived from the filename.
- [ ] Sufficient contrast and focus rings for tab controls.

## Performance & Cleanup
- [ ] Blob URLs are revoked on unmount/file change (`URL.revokeObjectURL`).
- [ ] No memory growth after repeatedly opening/closing image files.
- [ ] Avoids large text rendering for raster images (no base64 dump in Code view).
- [ ] Optional: `AbortController` cancels stale requests on quick navigation.

## CSP/Security
- [ ] Works under CSP allowing `img-src 'self' data: blob:` (no additional relaxations needed).
- [ ] No inline script injection; SVGs are not executed as DOM nodes (rendered via `<img>`).

## Edge Formats
- [ ] ICO renders (as-is); no size picker required.
- [ ] Very large dimensions still render within container constraints without layout shifts.

## Manual Test Scenarios
- [ ] Small SVG: Preview renders; Code shows XML; Download works.
- [ ] Large-but-allowed SVG: behaves as above; no truncation.
- [ ] Small PNG/JPG/WebP: Preview renders; Code shows binary notice; Download works.
- [ ] Animated GIF: Preview animates; Code shows binary notice.
- [ ] Oversized raster (> `maxBinaryBytes`): error state + Download option.
- [ ] Non-image file: behavior unchanged; no image tabs shown.
- [ ] Refresh after edits/replacements: latest content appears; no stale previews.
- [ ] Back/forward navigation preserves state; no console errors.

## Acceptance Criteria Alignment
- [ ] Preview default for images with tabs present.
- [ ] SVG supports Preview and Code; raster Code shows binary notice.
- [ ] Refresh and Back work unchanged; toasts/counters behave as before.
- [ ] A11y and performance expectations met (tabs accessible; Blob URLs revoked).

---

Tip: If everything above passes without console errors or regressions in non-image files, you’ve nailed it.
