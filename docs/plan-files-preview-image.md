# Files Image Preview + Code Tabs

Add first-class image viewing to the Files UI while preserving the existing viewer shell (breadcrumbs, Back, Refresh, Download). For image files, show a two-tab toggle: Preview | Code.

## Goals
- Detect common image types: `png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `ico`, `svg`.
- Default to Preview for images, with a tab to switch to Code.
- Keep `FileViewerPage` layout and controls consistent; hide code-only actions when in image Preview.
- Support Refresh and Download for images, same as existing files.
- Cap inline payload sizes over WebSocket and provide clear fallback messaging.

## Non-Goals (initial)
- No in-browser editing of SVG.
- No EXIF extraction or advanced metadata panels.
- No dedicated HTTP endpoint for workspace files (continue using WS for now). Consider HTTP streaming later for large binaries.

## UX Overview
- Files list behavior unchanged; clicking an image opens `FileViewerPage`.
- Header retains: breadcrumbs, Back, Refresh, Download.
- Tabs (right-aligned under header controls or inline near filename):
  - Preview (active by default for images)
  - Code
- SVG
  - Preview: render the SVG via `<img src="data:...">` or a Blob URL derived from text.
  - Code: show SVG XML in the existing code viewer with syntax highlighting.
- Raster (png/jpg/jpeg/gif/webp/bmp/ico)
  - Preview: display the image within a max viewport height, `object-contain`, centered.
  - Code: show a compact message: “Binary image (N bytes). Use Download to inspect.”

## Server (FileSystemService)
- Enhance `open` to return a union for text vs. binary, decided primarily by extension:
  - Text (default): `{ path, content, encoding: 'utf8', truncated, size }`
  - Binary image (raster): `{ path, base64, encoding: 'base64', contentType, size }`
  - SVG: treat as text to keep Code tab simple; Preview will derive a data URL or Blob URL from text.
- Add `options?: { format?: 'auto' | 'text' | 'binary' }` to `fileSystemData` (optional), default `'auto'`.
- Limits and errors:
  - Keep `maxTextBytes` for text.
  - Add `maxBinaryBytes` (e.g., 10–20 MB) for inline base64; if exceeded, return an error with an actionable message.
- Detection strategy:
  - By extension (fast and predictable). Optionally add magic-byte sniffing later for robustness.
- Error shape (consistent across text/binary):
  - `{ ok: false, errorCode: 'TOO_LARGE' | 'NOT_FOUND' | 'UNSUPPORTED' | 'UNKNOWN', message, size? }`

### Protocol Examples
Text:
```
{
  type: 'fileSystem',
  id: '...',
  data: { operation: 'open', ok: true, result: {
    path: '/assets/logo.svg',
    content: '<svg ...>...</svg>',
    encoding: 'utf8',
    truncated: false,
    size: 1234
  }}
}
```

Binary image:
```
{
  type: 'fileSystem',
  id: '...',
  data: { operation: 'open', ok: true, result: {
    path: '/images/photo.jpg',
    base64: '...base64...',
    encoding: 'base64',
    contentType: 'image/jpeg',
    size: 345678
  }}
}
```

## Frontend (FileViewerPage.tsx)
- Image detection: determine `isImage` and `isSvg` by extension from `filePath`.
- Local state: `mediaView: 'preview' | 'code'` (only when `isImage`).
- Loading logic:
  - SVG: reuse existing text `open`. For Preview, create a Blob URL (`URL.createObjectURL`) or `data:image/svg+xml;charset=utf-8,` URL.
  - Raster: call `open` (auto) and branch on `encoding === 'base64'` to obtain `base64` and `contentType` for Preview.
- UI updates:
  - Add a small segmented control (Preview | Code) alongside action buttons when `isImage`.
  - Hide code-only controls (find, goto, wrap, language) when in image Preview.
  - Code tab behavior:
    - SVG: render the existing CodeViewer with the SVG text.
    - Raster: render a slim placeholder panel with file info and a size-aware “Copy data URL” action (optional, default off).
- Download:
  - SVG: Blob from text; raster: Blob from base64.
- Refresh:
  - Reissue the `open` request (respecting textual vs. base64 path) and update the preview.
- Accessibility:
  - Provide `alt` from filename, announce tab changes over a live region, ensure the tablist is keyboard navigable.
- Performance/cleanup:
  - Prefer Blob URLs for large content; revoke via `URL.revokeObjectURL` on unmount or when switching files.
  - Avoid redundant requests when toggling tabs (SVG reuses text already fetched).
  - Consider `AbortController` to cancel stale requests on quick navigation.

## CSP / Security
- Current CSP (HttpServer) allows `img-src 'self' data: blob:` which covers `<img>` data URLs and Blob URLs; no changes required.
- Never innerHTML-inject SVG; render via `<img>` using `data:` or `blob:` URLs.
- SVG with scripts won’t execute when loaded via `<img>`; still treat as untrusted and keep approach simple.

## Impacted Components
- Frontend:
  - `src/webview/react-frontend/src/pages/FileViewerPage.tsx`
  - Minor: `CodeBottomBar`, `CodeOptionsSheet` (conditionally hide code-only controls for images)
- Server:
  - `src/server/FileSystemService.ts` (open binary payloads, size cap)
  - `src/server/interfaces.ts` (union return type, optional `options.format`)

## Edge Cases & Handling
- Very large images: show a friendly error state with a Download button.
- Unknown or mis-labeled extension: fallback to text path; if decoding fails, show a clear fallback message.
- Truncated text payloads (SVG > `maxTextBytes`): show truncation notice in Code and encourage Download.
- Animated GIF/WebP: allow Preview to render animations; no animation controls initially.
- ICO files with multiple sizes: render as-is; no size picker.

## Testing Plan
- Dev/manual runs:
  - SVG small (Preview/Code toggle works, Download works)
  - SVG large but < text limit (still fine)
  - PNG/JPG/WebP small (Preview renders, Code shows binary notice)
  - GIF animated (renders)
  - Oversized raster (> `maxBinaryBytes`): receives error, shows Download prompt
  - Non-image files unaffected
- Validate CSP: images display with `data:`/`blob:`.
- Validate Refresh/Back navigations and breadcrumbs unchanged.
- Optional: unit tests for detection by extension and server size gating.

## Incremental Implementation Steps
1) Server: extend `open` union response for images; add `maxBinaryBytes` and consistent error shape.
2) Frontend: add image detection + Preview/Code tabs; wire Blob/data URL image preview.
3) Conditionally hide code-only controls in image Preview; keep Download always available.
4) Error states for oversize/unavailable payloads; ensure refresh retries work.
5) Polishing: alt text, dimension fit (`onLoad`), optional copy data URL action, revoke Blob URLs.

## Open Questions
- Separate `openBinary` operation vs. overloading `open`? (Cleaner API vs. slightly more plumbing.)
- Raster “Code” view: only show a minimal notice (preferred) vs. actual base64 text? (Prefer minimal notice.)
- Size caps: 10 MB vs. 20 MB for base64 payloads? (Base64 adds ~33% overhead.)

## Acceptance Criteria
- Image files open with the Preview tab by default; Preview renders the image under the existing header.
- SVG files can switch to Code to view raw XML in the code viewer.
- Raster images’ Code tab shows a clear binary notice and still provides Download.
- Refresh and Back continue to work; counts and toasts behave as before.
- A11y: tabs are keyboard accessible, image has `alt`, tab changes are announced.
- Performance: Blob URLs are revoked on unmount; no memory leaks after repeated navigation.

## Backlog / Future Considerations
- Serve large files via HTTP with range requests (streaming) to avoid WS/base64 overhead.
- Thumbnails or low-res placeholders for very large images.
- Zoom, pan, background checkerboard for transparency.
- EXIF extraction and orientation handling.
- “Open externally” / “View original in new tab” where applicable.
- Magic-byte sniffing when extension is misleading.

---

This plan keeps the initial scope tight while adding clarity on API shape, a11y, performance, and error handling. Decisions needed: `openBinary` vs `open` overload, and the exact `maxBinaryBytes` cap.

