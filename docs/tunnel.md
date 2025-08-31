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
