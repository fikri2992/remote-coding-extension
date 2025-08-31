# Internal Architecture

## Key modules (server/)
- `ServerManager.ts`
  - Orchestrates HTTP and WebSocket servers, lifecycle, retries, and emits status.
  - Exposes `startTunnel()` which calls `ensureCloudflared()` and launches `LocalTunnel`.
- `LocalTunnel.ts`
  - Spawns `cloudflared`.
  - Quick Tunnel: `--no-autoupdate tunnel --url http://localhost:<port>`.
  - Named Tunnel: `--no-autoupdate tunnel run <NAME>`. Guards against empty names.
  - Parses stdout/stderr for public URL and publishes `TunnelStatus`.
- `CloudflaredManager.ts`
  - `ensureCloudflared(context?)` resolves binary path.
  - `getAssetForPlatform()` chooses the best asset (Windows ARM64/AMD64, Linux, macOS).
  - `download()` follows redirects and sets a User-Agent; deletes partial files on errors.
  - On Windows, `isLikelyWindowsExe()` checks `MZ` header and file size; `canRun()` tests `version`.
  - If invalid or wrong arch, fetches the alternate asset automatically.
- `HttpServer.ts`, `WebSocketServer.ts`, `WebServer.ts`
  - Provide REST and WS endpoints and static UI hosting.

## Data flow
1. UI or commands call `ServerManager.startServer()`.
2. When starting a tunnel, `ServerManager.startTunnel()` creates a `TunnelConfig` and resolves `cloudflared`.
3. `LocalTunnel.start()` spawns the process and streams output; URL is extracted and returned to `ServerManager`.
4. Webview consumes status via provider events.

## Error handling
- `ServerManager` categorizes errors and retries transient failures with exponential backoff.
- `LocalTunnel` timeouts after 60s if no URL is detected.
- `CloudflaredManager` throws clear, user-facing errors for HTTP/arch/validation failures.
