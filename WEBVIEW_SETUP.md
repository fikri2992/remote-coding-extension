# Webview Setup Guide

This extension now uses a dual-interface approach:

## Architecture

1. **VS Code Panel**: Simple HTML panel (`panel.html`) embedded in VS Code
2. **Vue.js Web Interface**: Full-featured Vue.js application running on localhost:5173

## Usage

### 1. Start the Vue.js Development Server

```bash
npm run start:vue
```

This starts the Vue.js frontend on `http://localhost:5173`

### 2. Start the Extension Server

In VS Code, use the panel to start the Web Automation Server, or run:
- Command Palette: "Web Automation Tunnel: Start Server"

This starts:
- HTTP server on `http://localhost:8080`
- WebSocket server on `ws://localhost:8081`

### 3. Access the Web Interface

From the VS Code panel, click "Open Web Interface" or navigate directly to:
`http://localhost:5173`

## Benefits

- **No CSP Issues**: The Vue.js app runs in a regular browser, avoiding VS Code webview CSP restrictions
- **Full Browser Features**: Access to all modern browser APIs and developer tools
- **Better Performance**: No webview overhead
- **Easier Development**: Hot reload and full Vue.js development experience
- **Simple Panel**: Clean, fast VS Code panel for basic controls

## Development Workflow

1. Start Vue dev server: `npm run start:vue`
2. Open VS Code and load the extension
3. Use the panel for basic server control
4. Use the web interface for advanced features
5. Both interfaces connect to the same WebSocket server for real-time updates

## Configuration

The Vue.js frontend automatically detects if it's running in:
- **Browser mode**: Connects to `ws://localhost:8081`
- **VS Code webview mode**: Uses VS Code API (not used in current setup)

Environment variables in `.env.development`:
- `VITE_API_BASE_URL=http://localhost:8080/api`
- `VITE_WS_BASE_URL=ws://localhost:8081/ws`