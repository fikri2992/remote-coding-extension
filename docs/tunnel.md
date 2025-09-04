# Cloudflare Tunnel Usage

## Quick Tunnel (default)
- No prior Cloudflare setup required.
- Command used: `cloudflared --no-autoupdate tunnel --url http://localhost:<port>`.
- The extension parses the public URL from stdout/stderr patterns like:
  - `https://<hash>.trycloudflare.com`
  - `https://<hash>.cloudflaretunnel.com`

Start from palette: “Start Cloudflare Tunnel” and leave Tunnel Name empty.

## Named Tunnel
Requires a Cloudflare account and prior setup on your machine.

Typical one-time setup (CLI):
```bash
cloudflared tunnel login
cloudflared tunnel create <NAME>
# optional DNS mapping
cloudflared tunnel route dns <NAME> <host.example.com>
```
Run via extension (set Tunnel Name):
- Command: `cloudflared --no-autoupdate tunnel run <NAME>`
- The extension switches to Named Tunnel when `tunnelName` is a non-empty string.

## Binary resolution
`ensureCloudflared()` in `src/server/CloudflaredManager.ts`:
- Uses PATH if `cloudflared version` works.
- Otherwise downloads the correct asset for your OS/arch.
- On Windows:
  - Detects true OS architecture via `PROCESSOR_ARCHITECTURE` and `PROCESSOR_ARCHITEW6432`.
  - Follows redirects and sets a User-Agent.
  - Validates the PE header (`MZ`) and file size, then executes `version`.
  - If run fails, retries with the alternate arch (ARM64/AMD64).

## Process execution
`LocalTunnel.start()` in `src/server/LocalTunnel.ts`:
- Builds args based on `tunnelName` presence.
- Spawns `cloudflared` with `{ shell: false, windowsHide: true }`.
- Streams stdout/stderr, detects the public URL, and sets `TunnelStatus`.
- Adds `--no-autoupdate` to keep runtime stable inside the extension.

## Integration with the extension (lifecycle)
`ServerManager` in `src/server/ServerManager.ts` orchestrates tunnel start/stop:
- Requires server running: `startTunnel()` throws "Server must be running before starting tunnel".
- Single instance: throws "Tunnel is already running" if a tunnel exists.
- Prepares binary: calls `ensureCloudflared(context)` and injects the returned path into `TunnelConfig.binaryPath`.
- Starts process: creates `new LocalTunnel(config)` and awaits `start()`.
- Emits status: on success, fires `_onTunnelStatusChanged` with `TunnelStatus` and refreshes `_onServerStatusChanged` so UI shows `publicUrl`.
- Error handling: on failure, shows VS Code error, fires `_onTunnelStatusChanged(null)`, refreshes server status, and clears the tunnel reference to allow retry.
- Stop: `stopTunnel()` calls `LocalTunnel.stop()`, nulls the instance, emits tunnel/server status, and notifies the user.

Auto-start behavior:
- On server start, reads `webAutomationTunnel.autoStartTunnel` (default `true`) and invokes `startTunnel()`.

## Commands and settings
From `package.json` → `contributes.commands` and `contributes.configuration`:
- Command IDs
  - `webAutomationTunnel.startTunnel` — Start Cloudflare Tunnel
  - `webAutomationTunnel.stopTunnel` — Stop Cloudflare Tunnel
  - `webAutomationTunnel.installCloudflared` — Install/prepare `cloudflared`
  - `webAutomationTunnel.tunnelStatus` — Check Tunnel Status
  - Related server controls: `webAutomationTunnel.startServer`, `webAutomationTunnel.stopServer`
- Settings
  - `webAutomationTunnel.autoStartTunnel` (boolean, default `true`) — auto-start tunnel when server starts
  - See `docs/configuration.md` for full server settings

Notes:
- The tunnel mode is determined by whether `TunnelConfig.tunnelName` is provided to `ServerManager.startTunnel()`.
- Commands use the manager’s default behavior (Quick Tunnel unless a name is supplied by the caller/UI).

## Tunnel configuration structure
`TunnelConfig` (defined in `src/server/LocalTunnel.ts`):
- `localPort: number` — required; server port to expose.
- `tunnelName?: string` — when set, uses Named Tunnel (`cloudflared tunnel run <NAME>`).
- `cloudflareToken?: string` — if provided, `authenticateCloudflare()` runs `cloudflared tunnel token <TOKEN>` before starting.
- `binaryPath?: string` — resolved path to `cloudflared` (set by `ServerManager` via `ensureCloudflared`).
- `subdomain?: string`, `host?: string` — optional fields reserved for future use.

## Eventing and status propagation
- `ServerManager.onTunnelStatusChanged: Event<TunnelStatus | null>` — fires on start/stop/error.
- `ServerManager.getServerStatus()` merges `TunnelStatus.publicUrl` when a tunnel is running so the UI can surface it.

## Timeout and error handling
- URL detection watches both stdout and stderr, scanning patterns:
  - `https://<hash>.trycloudflare.com`
  - `https://<hash>.cloudflaretunnel.com`
  - `https://<hash>.cfargotunnel.com`
  - `tunnel ... started ... https://<url>`
  - `https://<hash>.tunnel.cloudflare.com`
- If the process exits non-zero before a URL is found, `start()` rejects with the captured error output.
- Startup timeout is configurable via setting `webAutomationTunnel.tunnelStartTimeoutMs` (default 60000 ms). If no URL is discovered within this window, the process is killed and `lastError` is set.
- `stop()` sends SIGTERM, then SIGKILL after 5s if needed, and awaits process exit.

## Binary preparation details
`ensureCloudflared()` (`src/server/CloudflaredManager.ts`) ensures a working `cloudflared`:
- PATH first: uses system `cloudflared` if `cloudflared version` succeeds.
- Storage: downloads to extension storage (`context.globalStorageUri.fsPath`) or `~/.vscode-cloudflared` fallback.
- macOS: downloads `.tgz`, extracts with `tar`, applies `chmod 755`.
- Linux: downloads the binary, applies `chmod 755`.
- Windows:
  - Detects true OS arch via `PROCESSOR_ARCHITECTURE` and `PROCESSOR_ARCHITEW6432` to choose AMD64 vs ARM64.
  - Validates PE header (`MZ`) and reasonable file size before use.
  - Falls back to the alternate Windows arch asset if the first choice cannot run.
- All platforms: verifies the binary by running `cloudflared version` before returning its path.

## Typical flows
- Quick Tunnel
  1) Start server → (optional) auto-start tunnel.
  2) `ensureCloudflared` resolves binary → `LocalTunnel` runs `cloudflared --no-autoupdate tunnel --url http://localhost:<port>`.
  3) URL is parsed from output and emitted through server/tunnel status.
- Named Tunnel
  1) Ensure Cloudflare setup on the machine (login/create/route as needed).
  2) Call `startTunnel({ tunnelName: '<NAME>' })` so `LocalTunnel` runs `cloudflared --no-autoupdate tunnel run <NAME>`.
  3) URL is parsed from output and emitted through server/tunnel status.

## Manage tunnels from the web UI
When you open the server in a browser (locally or via its Cloudflare public URL), you can manage additional tunnels directly from the web UI. The HTTP server exposes JSON endpoints:

- GET /api/tunnels — list active tunnels started via the web server
- GET /api/tunnels/status — installation + summary
- POST /api/tunnels/create — body: { localPort, name?, token? } (quick if no name/token)
- POST /api/tunnels/stop — body: { id } or { pid }
- POST /api/tunnels/stopAll — stop all web‑managed tunnels
- POST /api/cloudflared/install — prepare/install cloudflared

Notes:
- These endpoints are separate from the single tunnel managed inside VS Code by ServerManager (LocalTunnel).
- WebSocket upgrades now allow same‑origin connections over tunnel domains, so the browser UI can connect to /ws when accessed via a Cloudflare URL.

## See also
- `docs/configuration.md` — all available settings, including `webAutomationTunnel.autoStartTunnel`.
- `docs/troubleshooting.md` — common issues (arch mismatch, timeouts, ports in use) and fixes.
- `docs/setup.md` — quick start, building, and getting a Quick Tunnel running.
- `docs/architecture.md` — where tunnel responsibilities live (`ServerManager`, `LocalTunnel`, `CloudflaredManager`).
- `docs/commands.md` — palette commands and what they trigger.

