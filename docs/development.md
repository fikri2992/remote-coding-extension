# Development Guide

## Repository layout
- `src/server/` — server and tunnel orchestration
- `src/webview/` — React webview UI (`react-frontend/` build outputs to `out/webview/...`)
- `src/extension.ts` — entry point, registers webview and commands

## Scripts
```json
"build": "npm run clean && npm run compile && npm run copy-assets && npm run build:vue:prod && npm run copy-react-dist",
"compile": "tsc -p ./",
"copy-assets": "xcopy /Y \"src\\webview\\panel.html\" \"out\\webview\\\"",
"build:vue:prod": "cd src/webview/react-frontend && npm run build"
```

## Run the extension
- F5 in VS Code to open an Extension Development Host.
- View: “Web Automation Tunnel”.

## Logging
- `ServerManager` prints server and tunnel lifecycle.
- `LocalTunnel` logs `Cloudflared stdout/stderr:` and the resolved args.
- `CloudflaredManager` logs validation and error messages on failures.

## Testing tips
- Verify Quick Tunnel by starting the server and then the tunnel; ensure a public URL appears.
- Simulate arch mismatch by forcing the wrong asset URL and confirm fallback logic.
- Verify port conflicts by running another process on 8080/8081 and starting the server.

## Publishing
- Package with: `npm run package` (requires `vsce`).
- Increment `version` in `package.json` and update docs if commands/settings change.
