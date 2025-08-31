# Commands

Command IDs are declared in `package.json` and registered in `src/extension.ts`.

- `webAutomationTunnel.startServer`
  Start the local HTTP/WebSocket server via `ServerManager.startServer()`.

- `webAutomationTunnel.stopServer`
  Stop the server.

- `webAutomationTunnel.openConfiguration`
  Opens the VS Code settings for this extension.

- `webAutomationTunnel.resetConfiguration`
  Resets settings to defaults using `ServerManager.resetConfigurationToDefaults()`.

- `webAutomationTunnel.toggleUI`
  Toggle enhanced vs basic UI. Prompts to refresh the webview.

- `webAutomationTunnel.startTunnel`
  Prompts for tunnel name (optional) and API token (optional), then calls `ServerManager.startTunnel()`.

- `webAutomationTunnel.stopTunnel`
  Stops the tunnel via `ServerManager.stopTunnel()`.

- `webAutomationTunnel.installCloudflared`
  Calls `ServerManager.installCloudflared()` which ensures/installs the binary.

- `webAutomationTunnel.tunnelStatus`
  Shows a modal with current tunnel and server status; offers to copy the public URL.
