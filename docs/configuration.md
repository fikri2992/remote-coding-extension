# Configuration Reference

VS Code settings namespace: `webAutomationTunnel` (see `package.json` > `contributes.configuration`).

- `webAutomationTunnel.httpPort` (number, default 3900)
  Port for the HTTP server.

- `webAutomationTunnel.websocketPort` (number, default 3901)
  Deprecated: WebSocket now upgrades on path `/ws` via the HTTP server. This setting is ignored at runtime.

- `webAutomationTunnel.allowedOrigins` (array<string>, default ["*"])
  CORS and WebSocket allowed origins.

- `webAutomationTunnel.maxConnections` (number, default 10)
  Maximum concurrent WebSocket clients.

- `webAutomationTunnel.enableCors` (boolean, default true)
  Enable CORS.

- `webAutomationTunnel.useEnhancedUI` (boolean, default true)
  Toggle React-based enhanced UI.

- `webAutomationTunnel.autoStartTunnel` (boolean, default true)
  Auto-start Cloudflare Tunnel when the server starts.

Programmatic tunnel options (`TunnelConfig` in `src/server/LocalTunnel.ts`):
- `localPort` (required): Local HTTP port to expose.
- `tunnelName?`: Name/ID for a Named Tunnel. If omitted/empty, Quick Tunnel is used.
- `cloudflareToken?`: API token used by `authenticateCloudflare()` when provided.
- `binaryPath?`: Resolved path to cloudflared; if not provided, PATH is used.
