# Files — Mobile‑First File Explorer and Viewer

Outcome: Browse workspace folders, view files with syntax highlighting, basic create/rename/delete, and resilient refresh on mobile.

Related server code to review/extend

- `src/server/interfaces.ts`: `FileNode` and WS message unions.
- `src/server/CommandHandler.ts`: command whitelist and state events.
- `src/server/ServerManager.ts`: WS/HTTP orchestration and status broadcasting.
- `src/server/HttpServer.ts`: static assets and `/api/*` routing (add fs streaming endpoint if needed).

Related frontend code to review/extend

- `src/webview/react-frontend/src/pages/FilesPage.tsx` (placeholder, build UI here).
- `src/webview/react-frontend/src/components/WebSocketProvider.tsx` (send/receive envelopes).
- `src/webview/react-frontend/src/layouts/RootLayout.tsx` (navigation, small screens).

Protocol (WS v1)

- Envelope: `{ type: 'fileSystem', id?, data: { fileSystemData: { operation, path?, content?, options? }}}`
- Operations:
  - `tree`: Return a directory tree for root or `path`.
  - `open`: Return file metadata + text content (UTF‑8) or a hint to download.
  - `watch`: Start a watcher for a subtree; server emits incremental updates.
  - `create` | `delete` | `rename`: Mutations with success/error.

Backend tasks

- Service: Add `FileSystemService.ts` (server).
  - Build tree using `vscode.workspace.fs` (workspace‑scoped only).
  - Map to `FileNode` with size/mtime; mark folders `expanded: false` by default.
  - Large files: For files > N MB or binary detection, omit `content`; advise HTTP download.
  - Watchers: `vscode.workspace.createFileSystemWatcher` per subtree; batch updates for WS.
- Router: In `WebSocketServer.ts`, route `type === 'fileSystem'` to the service.
- Optional HTTP: `GET /api/fs/download?path=` streaming for large files via `HttpServer.ts`.
- Validation and security:
  - Deny paths outside workspace; normalize and resolve symlinks.
  - Limit tree depth and node count to avoid OOM on monorepos; support paging.
  - Rate limit mutation ops; log audit records.

Frontend tasks

- Tree UI: Mobile‑optimized collapsible list with virtualization for large folders.
  - First render: root only; lazy‑load children when expanding.
  - Pull‑to‑refresh; “Try again” cards on failures; skeleton loaders.
  - Breadcrumbs with horizontal scroll; long‑press on nodes to open actions sheet.
- Viewer: Syntax highlighting for text (Prism or Shiki on client); raw view toggle.
- Actions: Create file/folder, rename, delete, refresh current folder.
- Search: Client‑side filter within current folder; phase 2 add server search.
- Offline: Cache last tree; queue mutations until WS online with conflict warnings.

Checklists

- Server
  - [ ] Create `FileSystemService.ts` with `tree/open/watch/create/delete/rename`.
  - [ ] Add path normalization and workspace boundary checks.
  - [ ] Add optional `/api/fs/download` in `HttpServer.ts` with content‑type and range.
  - [ ] Wire `WebSocketServer` dispatch for `fileSystem` envelopes.
  - [ ] Emit watcher events as batched diffs every 300–500ms.
- Frontend
  - [ ] Build `FilesPage.tsx` with adaptive list, skeletons, and lazy nodes.
  - [ ] Implement `useFiles()` hook for WS requests and caching.
  - [ ] Add bread‑crumbs and bottom action sheet (create/rename/delete).
  - [ ] Add code viewer with syntax highlight and raw toggle.
  - [ ] Track offline state; queue ops and reconcile on reconnect.
- QA
  - [ ] Monorepo: root with 50k+ nodes doesn’t lock UI (virtualization tested).
  - [ ] Binary file handling: no accidental decode; download works.
  - [ ] Permission errors: clear, actionable messages.
  - [ ] iOS/Android: tap targets ≥ 44px, scroll/expand gestures conflict‑free.

Acceptance criteria

- Open root and navigate 5 levels deep under 1.5s on average machine.
- Open a 500KB text file under 300ms after fetch.
- No path traversal outside workspace; logged and denied.
- Works one‑handed on 390–430px width devices.

