# Web Automation Tunnel - VS Code Extension

A modern VS Code extension that provides a web automation tunnel with HTTP and WebSocket server capabilities for browser automation and testing workflows. Features a modern Vue.js frontend interface for enhanced user experience and maintainability.

## Features

- **Modern Vue.js Frontend**: Responsive, component-based user interface built with Vue 3
- **Activity Bar Integration**: Custom activity bar panel for easy access
- **HTTP Server**: Configurable HTTP server for web automation endpoints
- **WebSocket Server**: Real-time communication with browser automation tools
- **Configuration Management**: Flexible settings for ports, CORS, and connection limits
- **Server Management**: Start/stop servers directly from VS Code
- **Connection Recovery**: Automatic reconnection handling for WebSocket connections
- **State Synchronization**: Real-time state sync between server and clients
- **File Management**: Integrated file explorer with CRUD operations
- **Git Integration**: Built-in Git operations and repository management
- **Terminal Interface**: Multiple terminal sessions with command execution
- **Chat & Messaging**: Real-time messaging with file sharing capabilities

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd vscode-extension-basic
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Package the extension:
   ```bash
   npm run package
   ```

5. Install the generated `.vsix` file in VS Code:
   - Open VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Extensions: Install from VSIX"
   - Select the generated `.vsix` file

## Configuration

The extension provides several configuration options accessible through VS Code settings:

### Settings

- **HTTP Port** (`webAutomationTunnel.httpPort`): Port for HTTP server (default: 8080)
- **WebSocket Port** (`webAutomationTunnel.websocketPort`): Port for WebSocket server (defaults to HTTP port + 1)
- **Allowed Origins** (`webAutomationTunnel.allowedOrigins`): CORS allowed origins (default: ["*"])
- **Max Connections** (`webAutomationTunnel.maxConnections`): Maximum WebSocket connections (default: 10)
- **Enable CORS** (`webAutomationTunnel.enableCors`): Enable CORS support (default: true)

### Accessing Settings

1. Open VS Code settings (`Ctrl+,` or `Cmd+,`)
2. Search for "Web Automation Tunnel"
3. Modify settings as needed

Or use the command palette:
- `Ctrl+Shift+P` → "Web Automation Tunnel: Open Configuration"

## Usage

### Starting the Server

1. **Via Activity Bar**:
   - Click the "Basic Extension" icon in the activity bar
   - Use the webview interface to start the server

2. **Via Command Palette**:
   - Press `Ctrl+Shift+P`
   - Type "Web Automation Tunnel: Start Web Automation Server"

3. **Via Commands**:
   - `webAutomationTunnel.startServer`
   - `webAutomationTunnel.stopServer`

### Available Commands

- `Web Automation Tunnel: Start Web Automation Server` - Start the HTTP and WebSocket servers
- `Web Automation Tunnel: Stop Web Automation Server` - Stop all servers
- `Web Automation Tunnel: Open Configuration` - Open extension settings
- `Web Automation Tunnel: Reset Configuration to Defaults` - Reset all settings
- `Basic Extension: Execute Action` - Execute custom actions
- `Basic Extension: Focus Auxiliary Bar` - Focus the auxiliary bar

## Development

### Prerequisites

- Node.js 18.x or higher
- VS Code 1.75.0 or higher
- TypeScript 4.9.4 or higher

### Setup

1. Clone and install dependencies:
   ```bash
   git clone <repository-url>
   cd vscode-extension-basic
   npm install
   ```

2. Install Vue.js frontend dependencies:
   ```bash
   cd src/webview/vue-frontend
   npm install
   cd ../../..
   ```

3. Open in VS Code:
   ```bash
   code .
   ```

### Vue.js Frontend Development

The extension includes a modern Vue.js frontend located in `src/webview/vue-frontend/`. 

#### Frontend Development Server
```bash
# Start Vue.js development server with hot reload
npm run dev:vue

# Build Vue.js frontend for development
npm run build:vue:dev

# Build Vue.js frontend for production
npm run build:vue:prod
```

#### Frontend Architecture
- **Framework**: Vue.js 3 with Composition API
- **Build Tool**: Vite for fast development and optimized builds
- **State Management**: Pinia for centralized state management
- **Styling**: Tailwind CSS for utility-first styling
- **UI Components**: PrimeVue for rich component library
- **Language**: TypeScript for type safety

### Build Scripts

- `npm run compile` - Compile TypeScript to JavaScript
- `npm run compile:watch` - Watch mode compilation
- `npm run build` - Clean, compile, and build Vue.js frontend
- `npm run build:vue` - Build Vue.js frontend only
- `npm run build:vue:dev` - Build Vue.js frontend for development
- `npm run build:vue:prod` - Build Vue.js frontend for production
- `npm run dev:vue` - Start Vue.js development server
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:vue` - Run ESLint on Vue.js frontend
- `npm run clean` - Remove output directory
- `npm run clean:vue` - Clean Vue.js build artifacts
- `npm run package` - Create VSIX package

### Testing

#### Unit Tests

Run individual test files:
```bash
# Test configuration manager
npx ts-node src/server/ConfigurationManager.test.ts

# Test command handler
npx ts-node src/server/CommandHandler.test.ts

# Test state synchronization
npx ts-node src/server/StateSynchronization.test.ts
```

#### Integration Tests

Run the integration test suite:
```bash
npx ts-node src/server/integration-test.ts
```

#### Manual Testing

1. **Extension Host Testing**:
   - Press `F5` in VS Code to launch Extension Development Host
   - Test all commands and functionality in the new window

2. **Server Testing**:
   - Start the server via command palette
   - Test HTTP endpoints: `http://localhost:8080`
   - Test WebSocket connections: `ws://localhost:8081`

3. **Configuration Testing**:
   - Modify settings and verify server behavior
   - Test configuration reset functionality

#### Test Scenarios

1. **Basic Functionality**:
   - Extension activation
   - Activity bar panel display
   - Command registration and execution

2. **Server Operations**:
   - Start/stop HTTP server
   - Start/stop WebSocket server
   - Port configuration changes
   - CORS functionality

3. **WebSocket Features**:
   - Connection establishment
   - Message handling
   - Connection recovery
   - State synchronization

4. **Error Handling**:
   - Invalid port configurations
   - Server startup failures
   - WebSocket connection errors

### Project Structure

```
├── src/
│   ├── assets/           # Extension assets (icons, etc.)
│   ├── commands/         # Command implementations
│   ├── server/           # HTTP and WebSocket server logic
│   │   ├── CommandHandler.ts
│   │   ├── ConfigurationManager.ts
│   │   ├── ConnectionRecoveryManager.ts
│   │   ├── HttpServer.ts
│   │   ├── ServerManager.ts
│   │   ├── WebSocketServer.ts
│   │   └── *.test.ts     # Test files
│   ├── webview/          # Webview provider and Vue.js frontend
│   │   ├── provider.ts   # Webview provider
│   │   └── vue-frontend/ # Vue.js application
│   │       ├── src/      # Vue.js source code
│   │       ├── dist/     # Built Vue.js assets
│   │       ├── package.json
│   │       └── vite.config.ts
│   └── extension.ts      # Main extension entry point
├── out/                  # Compiled JavaScript output
├── docs/                 # Documentation
│   ├── DEVELOPER_GUIDE.md
│   ├── USER_GUIDE.md
│   └── MIGRATION_GUIDE.md
├── package.json          # Extension manifest and dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

### Git Workflow

This project follows a structured Git workflow:

#### Branch Strategy
- `main`: Production-ready code
- `dev`: Integration branch for development
- `feature/*`: Feature development branches
- `hotfix/*`: Critical fixes

#### Development Process
1. Create feature branch from `dev`:
   ```bash
   git checkout dev
   git pull
   git checkout -b feature/your-feature-name
   ```

2. Make focused commits:
   ```bash
   git add .
   git commit -m "Add WebSocket authentication feature"
   ```

3. Rebase regularly:
   ```bash
   git fetch
   git rebase origin/dev
   ```

4. Create pull request to `dev` branch

#### Quality Gates
Before submitting PRs, ensure:
- All tests pass: `npm test`
- No lint errors: `npm run lint`
- TypeScript compiles: `npm run compile`
- Extension activates successfully

## API Reference

### HTTP Endpoints

The HTTP server provides RESTful endpoints for automation control:

- `GET /status` - Server status and configuration
- `POST /execute` - Execute automation commands
- `GET /connections` - List active WebSocket connections

### WebSocket Protocol

WebSocket messages use JSON format:

```json
{
  "type": "command|response|event",
  "id": "unique-message-id",
  "data": { /* command-specific data */ }
}
```

### Configuration API

Access configuration programmatically:

```typescript
import { ConfigurationManager } from './server/ConfigurationManager';

const config = new ConfigurationManager();
const httpPort = config.getHttpPort();
const wsPort = config.getWebSocketPort();
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**:
   - Change the HTTP/WebSocket port in settings
   - Check for other applications using the same ports

2. **Extension Not Activating**:
   - Check VS Code version compatibility (requires 1.75.0+)
   - Verify extension is properly installed
   - Check VS Code developer console for errors

3. **WebSocket Connection Failures**:
   - Verify WebSocket port configuration
   - Check firewall settings
   - Ensure allowed origins are configured correctly

4. **Build Errors**:
   - Run `npm install` to ensure dependencies are installed
   - Install Vue.js frontend dependencies: `cd src/webview/vue-frontend && npm install`
   - Check TypeScript version compatibility
   - Clear output directory: `npm run clean`
   - Clear Vue.js build artifacts: `npm run clean:vue`

### Debug Mode

Enable debug logging by setting VS Code log level to "Debug":
1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Developer: Set Log Level"
3. Select "Debug"

### Support

For issues and feature requests:
1. Check existing issues in the repository
2. Create detailed bug reports with:
   - VS Code version
   - Extension version
   - Steps to reproduce
   - Error messages/logs

## Contributing

1. Fork the repository
2. Create a feature branch from `dev`
3. Make your changes with tests
4. Ensure all quality gates pass
5. Submit a pull request to `dev`

## License

[Add your license information here]

## Changelog

### 0.0.1
- Initial release with modern Vue.js frontend
- Vue.js 3 with Composition API and TypeScript
- Pinia state management and Vue Router
- Tailwind CSS styling and PrimeVue components
- HTTP and WebSocket server functionality
- VS Code activity bar integration
- Configuration management
- Connection recovery and state synchronization
- File management with integrated explorer
- Git operations and repository management
- Terminal interface with multiple sessions
- Real-time chat and messaging capabilities
- Responsive design for desktop, tablet, and mobile
- Accessibility compliance (WCAG 2.1 AA)
- Comprehensive error handling and debugging
- Performance optimizations and monitoring