# Project Structure

## Root Directory Organization
```
├── src/                    # Source code
├── out/                    # Compiled JavaScript output
├── node_modules/           # Dependencies
├── .kiro/                  # Kiro configuration and steering
├── .vscode/                # VS Code workspace settings
├── .git/                   # Git repository
├── package.json            # Extension manifest and dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md              # Project documentation
```

## Source Code Structure (`src/`)
```
src/
├── extension.ts            # Main extension entry point and activation
├── integration-test.ts     # Integration test runner
├── assets/                 # Static assets (icons, images)
│   └── icon.svg           # Extension activity bar icon
├── commands/              # VS Code command implementations
│   └── buttonCommands.ts  # Button-related command handlers
├── server/                # HTTP and WebSocket server logic
│   ├── index.ts           # Server module exports
│   ├── interfaces.ts      # TypeScript interfaces and types
│   ├── ServerManager.ts   # Main server orchestration
│   ├── HttpServer.ts      # HTTP server implementation
│   ├── WebSocketServer.ts # WebSocket server implementation
│   ├── ConfigurationManager.ts    # VS Code settings management
│   ├── ConnectionRecoveryManager.ts # WebSocket reconnection logic
│   ├── CommandHandler.ts  # Command processing and routing
│   ├── ErrorHandler.ts    # Centralized error handling
│   ├── GitService.ts      # Git integration utilities
│   ├── RemoteRCService.ts # Remote control service
│   └── integration-test.ts # Server integration tests
└── webview/               # VS Code webview implementation
    ├── provider.ts        # Webview provider and lifecycle management
    ├── panel.html         # Basic HTML webview template
    ├── frontend/          # Legacy frontend (TailwindCSS)
    └── vue-frontend/      # Modern Vue.js frontend
        ├── package.json   # Vue project dependencies
        ├── vite.config.ts # Vite build configuration
        ├── src/           # Vue application source
        └── dist/          # Built Vue application
```

## Key Architecture Patterns

### Extension Entry Point
- `src/extension.ts` handles VS Code extension lifecycle
- Registers webview providers, commands, and event handlers
- Manages extension activation and deactivation

### Server Architecture
- `ServerManager.ts` orchestrates HTTP and WebSocket servers
- Modular design with separate concerns for each server type
- Configuration management through VS Code settings API
- Error handling and connection recovery built-in

### Webview Implementation
- Dual frontend approach: legacy HTML/CSS and modern Vue.js
- `provider.ts` manages webview lifecycle and message passing
- Vue frontend provides enhanced chat-like interface
- Configuration toggle between UI modes

### Command Structure
- Commands registered in `extension.ts` with proper error handling
- Separate command modules for different functionality areas
- Integration with VS Code command palette and activity bar

## Build Output Structure (`out/`)
```
out/
├── extension.js           # Compiled main extension
├── commands/              # Compiled command handlers
├── server/                # Compiled server modules
└── webview/               # Webview assets and compiled Vue app
    ├── panel.html         # Basic webview template
    ├── frontend/          # Legacy frontend assets
    └── vue-frontend/      # Built Vue application
```

## Configuration Files
- **package.json**: Extension manifest, commands, settings schema, and build scripts
- **tsconfig.json**: Strict TypeScript configuration with ES2020 target
- **.eslintrc.json**: Linting rules for TypeScript and Vue
- **tailwind.config.js**: TailwindCSS utility configuration
- **postcss.config.js**: CSS processing pipeline

## Development Workflow
1. Main extension development in `src/` with TypeScript
2. Vue frontend development in `src/webview/vue-frontend/`
3. Server logic in `src/server/` with modular architecture
4. Build process compiles everything to `out/` directory
5. VSIX packaging includes compiled code and assets