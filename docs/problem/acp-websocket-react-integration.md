# ACP + WebSocket + React Integration

## Summary

- Error at runtime: `TypeError: this.webServer.setAcpController is not a function` when starting the CLI server.
- Goal: run the React frontend, WebSocket backend, and ACP controller from a single command/process for development and production.

## Root Cause

- `CliServer` instantiates `WebServer` and then calls `setAcpController` on it, but `WebServer` does not implement that method.
- `HttpServer` is the implementation that supports ACP REST wiring and exposing the underlying Node `http.Server` for WebSocket upgrades.

Key references:

- Call site: `src/cli/server.ts:160` — `(this.webServer as any).setAcpController(this.acpController);`
- Minimal web server: `src/server/WebServer.ts:23` — class without ACP or upgrade support.
- HTTP server with ACP support and upgrade handle:
  - `src/server/HttpServer.ts:21` — `export class HttpServer {`
  - `src/server/HttpServer.ts:43` — `public setAcpController(controller: AcpHttpController): void { ... }`
  - `src/server/HttpServer.ts:843` — `public get nodeServer(): http.Server | null { ... }`

Because `CliServer` currently imports `WebServer` instead of `HttpServer`, the method is undefined at runtime.

## Current Architecture (expected)

- HTTP server serves the React build and handles `/api/*` endpoints as needed.
- WebSocket server upgrades on the same HTTP server at path `/ws`.
- ACP controller is wired to handle ACP requests (primarily via WebSocket frames; optional REST behind an env flag).

Key pieces:

- WebSocket server (attached upgrade handler): `src/server/WebSocketServer.ts`
- HTTP server (serves `dist`, CORS/security headers, `/api/*`, ACP REST optionally): `src/server/HttpServer.ts`
- ACP controller implementation: `src/acp/AcpHttpController.ts`
- Frontend connects to `ws://<origin>/ws` and speaks ACP over WS:
  - WebSocket provider builds URL relative to window origin: `src/webview/react-frontend/src/components/WebSocketProvider.tsx`
  - ACP UI uses `sendAcp(op, payload)` (WS-only): `src/webview/react-frontend/src/pages/ACPPage.tsx`
- Vite dev proxies `/ws` to the backend during HMR/dev: `src/webview/react-frontend/vite.config.ts`

## How It Fails Today

`CliServer` starts a `WebServer` (static-only server), then tries to:

- Attach WS to the underlying HTTP server via `(this.webServer as any).server` (works by accident because `server` is an instance field), and
- Attach ACP via `(this.webServer as any).setAcpController(...)` (fails because `WebServer` has no such API).

File references:

- `src/cli/server.ts:116` — `new WebSocketServer({ httpPort: port }, (this.webServer as any).server, '/ws')`
- `src/cli/server.ts:160` — `(this.webServer as any).setAcpController(this.acpController)`

## Recommended Fix (Option A — switch to HttpServer)

Replace `WebServer` with `HttpServer` in `CliServer`. This aligns with the existing `src/cli/controller.ts` which already uses `HttpServer` correctly.

High-level changes in `src/cli/server.ts`:

1) Update imports and types:

- Replace `import { WebServer, WebServerConfig } from '../server/WebServer'` with `import { HttpServer } from '../server/HttpServer'`.
- Replace `webServer: WebServer` property with `webServer: HttpServer`.

2) Build server config and start HTTP + WS:

- Construct a `ServerConfig` (httpPort, optional websocketPort, autoStartTunnel) then `new HttpServer(serverCfg)`.
- Use `this.webServer.nodeServer` when constructing `WebSocketServer` so WS upgrades attach to the same HTTP port/path.

3) Wire ACP correctly:

- Call `this.webServer.setAcpController(this.acpController)` once the controller is initialized.

4) Adjust status getters:

- `HttpServer` exposes `port` and `getDiagnostics()` rather than a `status` bag on the instance. Update usage accordingly where needed (status reporting in `getStatus()` / `printStatus()`).

This option is the least risky because it reuses the mature `HttpServer` implementation that already includes CORS/security headers, static serving of the React `dist`, ACP REST hooks, and `nodeServer` for WS upgrades.

## Alternative (Option B — extend WebServer)

If keeping `WebServer` is preferred, add the missing features:

- Add `private acpController: AcpHttpController | null` and implement `setAcpController(controller: AcpHttpController) { this.acpController = controller; }`.
- Route `/api/*` endpoints to ACP controller (and any tunnel/infra APIs needed).
- Expose `get nodeServer(): http.Server | null` to return the underlying `http.Server` so WS can attach upgrades at `/ws`.

However, this duplicates logic in `HttpServer`. Recommend consolidating on a single server implementation (`HttpServer`).

## Frontend/Dev Workflow

- Single process (prod-like):
  - `npm run start:cli` builds React and starts the integrated server.
  - The app serves static files and upgrades WS at `/ws`; ACP is driven over WS.

- Dev with HMR:
  - `npm run dev:full` runs two processes concurrently: backend (`dev:server`) and Vite dev server (`dev:frontend`).
  - Vite proxies `/ws` to the backend (`src/webview/react-frontend/vite.config.ts`).

Environment flags:

- `KIRO_ENABLE_ACP_REST=1` enables HTTP REST routes for ACP in `HttpServer` if you want to exercise them manually; the UI is WS-first.
- `KIRO_GIT_DEBUG=1` increases Git service logging.

## Validation Checklist

- Start via `npm run dev:server` (or `npm run start:cli`) and confirm logs:
  - HTTP server listening on localhost
  - `WebSocket upgrade handler attached at path /ws`
  - `connection_established` frame observed in browser console after loading the UI
- From the UI ACP page, run Connect → New Session → Prompt to verify end-to-end WS + ACP flow.

## Troubleshooting

- `TypeError: this.webServer.setAcpController is not a function`
  - Ensure `CliServer` uses `HttpServer` and not `WebServer`.
  - Verify you call `setAcpController` on `HttpServer` after `await acpController.init()`.

- WebSocket not connecting during dev
  - Confirm Vite proxy for `/ws` points to the backend port: `src/webview/react-frontend/vite.config.ts`.
  - Ensure the backend started first and printed the WS upgrade handler message.

- ACP errors
  - The UI is WS-only for ACP: ensure the WS connection is established first.
  - Check `scripts/smoke-acp.js` and `scripts/smoke-acp-ws.js` for local smoke tests.

## File References

- `src/cli/server.ts:116`
- `src/cli/server.ts:160`
- `src/cli/controller.ts:1`
- `src/server/WebServer.ts:23`
- `src/server/HttpServer.ts:21`
- `src/server/HttpServer.ts:43`
- `src/server/HttpServer.ts:843`
- `src/server/WebSocketServer.ts:1`
- `src/webview/react-frontend/src/components/WebSocketProvider.tsx:1`
- `src/webview/react-frontend/src/pages/ACPPage.tsx:1`
- `src/webview/react-frontend/vite.config.ts:1`

## One-command Setup

- Install all deps: `npm run install:all`
- Dev (backend + HMR frontend): `npm run dev:full`
- Integrated server (prod-like): `npm run start:cli`

Once `CliServer` is switched to `HttpServer`, both dev and prod flows run the frontend, WebSocket, and ACP from a single command.

