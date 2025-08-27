# Product Overview

## Web Automation Tunnel VS Code Extension

A VS Code extension that provides a web automation tunnel with HTTP and WebSocket server capabilities for browser automation and testing workflows.

### Core Features
- **Activity Bar Integration**: Custom activity bar panel for easy access to automation tools
- **HTTP Server**: Configurable HTTP server for web automation endpoints and RESTful API
- **WebSocket Server**: Real-time bidirectional communication with browser automation tools
- **Configuration Management**: Flexible settings for ports, CORS, connection limits, and UI preferences
- **Server Management**: Start/stop servers directly from VS Code command palette or webview
- **Connection Recovery**: Automatic reconnection handling for WebSocket connections
- **State Synchronization**: Real-time state sync between server and connected clients
- **Dual UI Modes**: Enhanced chat-like UI and basic interface options

### Target Use Cases
- Browser automation and testing workflows
- Real-time communication between VS Code and web applications
- Development tooling for web automation scripts
- Integration testing and debugging of web applications
- Remote control and monitoring of web-based processes

### Extension Architecture
- Extension host handles VS Code integration and server management
- Webview provides user interface with Vue.js frontend
- HTTP/WebSocket servers enable external tool communication
- Configuration system allows flexible deployment scenarios