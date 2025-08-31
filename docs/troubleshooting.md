# Troubleshooting

## “This app can’t run on your PC” (Windows popup)
- Cause: Downloaded `cloudflared.exe` not compatible with your OS architecture, or Windows blocked the file, or an HTML download (redirect) was saved.
- Fix:
  - Use system install: `winget install --id Cloudflare.cloudflared`.
  - Or rely on auto-download: `ensureCloudflared()` now validates `MZ` header and retries alternate arch automatically.
  - Confirm: `"<path\\to\\cloudflared.exe>" version`.

## “Downloaded cloudflared binary cannot run on this system (arch mismatch)”
- Cause: Asset architecture mismatch.
- Fix: Auto-fallback swaps ARM64/AMD64 on Windows. If it persists, install via `winget`.

## “Tunnel error: \"cloudflared tunnel run\" requires the ID or name...”
- Cause: `run` was invoked without a name.
- Fix: `LocalTunnel` now only uses `run` when `tunnelName` is non-empty; otherwise it uses Quick Tunnel: `tunnel --url ...`.

## Port in use (HTTP 8080 / WebSocket 8081)
- Symptoms: UI warnings like “HTTP port 8080 is not available” or “WebSocket 8081 is not available”.
- Fix: Choose different ports in settings or stop the conflicting process. `ServerManager` logs the fallback port.

## No public URL appears
- Wait up to 60s; a timeout will stop the process.
- Check Output/Console for `Cloudflared stdout/stderr` logs from `LocalTunnel`.
- Corporate proxy/SSL interception can block the tunnel; try on another network or system install.

## Collect diagnostics
```powershell
node -p "process.arch + ' | ' + (process.env.PROCESSOR_ARCHITECTURE||'') + ' | ' + (process.env.PROCESSOR_ARCHITEW6432||'')"
where cloudflared
cloudflared version
```
Share error logs from the Output window: lines starting with `Cloudflared stdout/stderr` and `Failed to prepare cloudflared`.

## Related docs
- `docs/setup.md` — Quick start and building the extension.
- `docs/tunnel.md` — Detailed tunnel modes, lifecycle, commands, and binary preparation.
