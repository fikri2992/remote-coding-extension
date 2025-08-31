# Setup and Quick Start

## Prerequisites
- VS Code 1.75+
- Node.js 18+ (recommended)
- Internet access to fetch `cloudflared` from GitHub (or install via package manager)

## Build the extension
```bash
npm install
npm run build
```
This compiles TypeScript and builds the React webview, copying artifacts into `out/`.

## Run in VS Code
- Press F5 to launch the Extension Development Host.
- In the activity bar, open “Web Automation Tunnel”.
- Click “Start Server”.

## Start a tunnel (Quick Tunnel)
Use the command palette:
- Web Automation Tunnel: Start Cloudflare Tunnel
- Leave Tunnel Name empty to use a Quick (ephemeral) Tunnel.

The extension runs:
- `cloudflared --no-autoupdate tunnel --url http://localhost:<httpPort>`
- The public URL is parsed from `cloudflared` output and shown in the UI and logs.

## Install cloudflared
The extension auto-prepares `cloudflared` via `ensureCloudflared()` in `src/server/CloudflaredManager.ts`:
- Detects Windows OS arch (ARM64 vs AMD64) using `PROCESSOR_ARCHITECTURE` and `PROCESSOR_ARCHITEW6432`.
- Downloads from GitHub Releases with redirect handling and a custom User-Agent.
- Validates Windows PE header (`MZ`) and file size, then tests with `"cloudflared.exe" version`.
- If the first asset can’t run, it retries the alternate Windows arch automatically.

Alternatively install system-wide and rely on PATH:
- Windows: `winget install --id Cloudflare.cloudflared`
- macOS: `brew install cloudflared`
- Linux: download the binary from GitHub Releases and place it on PATH, chmod +x.

When `cloudflared` is on PATH, the extension uses it directly and skips download.
