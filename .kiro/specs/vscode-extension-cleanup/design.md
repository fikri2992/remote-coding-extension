# Design Document

## Overview

This design outlines the systematic removal of VSCode extension dependencies and code from the cotg-cli project, transforming it into a streamlined CLI-focused tool. The cleanup will preserve all core CLI functionality, web server capabilities, and ACP integration while eliminating unnecessary VSCode extension components.

The current project contains legacy VSCode extension code in `src/extension.ts`, VSCode-specific webview providers, command handlers, and pseudo-terminal implementations that are no longer needed. The CLI functionality is already well-established in `src/cli/` and the web server components in `src/server/` can operate independently.

## Architecture

### Current Architecture Issues
- Mixed VSCode extension and CLI code in the same project
- VSCode-specific webview provider that duplicates web server functionality  
- Extension commands that wrap CLI functionality unnecessarily
- Build process that attempts to compile both extension and CLI code
- Package.json with mixed VSCode and CLI dependencies

### Target Architecture
- Pure CLI application with web server and WebSocket backend
- React frontend served directly by the web server (no VSCode webview)
- Streamlined build process focusing only on CLI and web components
- Clean separation between CLI commands, server services, and web frontend
- Simplified dependency tree without VSCode APIs

### Component Relationships
```
CLI Entry Point (src/cli/index.ts)
├── CLI Commands (src/cli/commands/)
├── Server Services (src/cli/services/)
└── Web Server (src/server/WebServer.ts)
    ├── HTTP Server (src/server/HttpServer.ts)
    ├── WebSocket Server (src/server/WebSocketServer.ts)
    └── React Frontend (src/webview/react-frontend/)
```

## Components and Interfaces

### Files to Remove
1. **VSCode Extension Entry Point**
   - `src/extension.ts` - Main VSCode extension activation/deactivation
   - Contains all VSCode-specific command registrations and webview setup

2. **VSCode Extension Commands**
   - `src/commands/buttonCommands.ts` - VSCode command palette commands
   - `src/commands/diagnosePTY.ts` - VSCode-specific terminal diagnostics
   - `src/integration-test.ts` - VSCode extension integration tests

3. **VSCode Webview Provider**
   - `src/webview/provider.ts` - VSCode webview panel provider
   - `src/webview/panel.html` - VSCode webview HTML template
   - `src/webview/script.js` - VSCode webview JavaScript
   - `src/webview/styles.css` - VSCode webview styles

4. **VSCode Pseudo Terminal**
   - `src/server/pseudo/KiroPseudoTerminal.ts` - VSCode pseudo terminal implementation
   - `src/server/pseudo/SessionEngine.ts` - VSCode terminal session management

### Files to Preserve and Clean
1. **CLI Components** (Keep as-is)
   - `src/cli/index.ts` - CLI entry point
   - `src/cli/commands/` - All CLI command implementations
   - `src/cli/services/` - All CLI service implementations
   - `src/cli/server.ts` - CLI server management
   - `src/cli/controller.ts` - CLI controller logic

2. **Server Components** (Clean VSCode references)
   - `src/server/WebServer.ts` - Remove VSCode configuration dependencies
   - `src/server/WebSocketServer.ts` - Keep core WebSocket functionality
   - `src/server/ServerManager.ts` - Remove VSCode context dependencies
   - `src/server/HttpServer.ts` - Keep HTTP server functionality
   - All other server services (FileSystem, Git, Terminal, etc.)

3. **React Frontend** (Keep as-is)
   - `src/webview/react-frontend/` - Entire React application
   - This serves as the web UI for the CLI tool

### Interface Changes

#### ServerManager Interface Updates
```typescript
// Remove VSCode context dependency
class ServerManager {
  // Before: constructor(context?: vscode.ExtensionContext)
  // After: constructor(configPath?: string)
  
  // Remove VSCode-specific methods
  // - resetConfigurationToDefaults() with VSCode settings
  // - VSCode event emitters
  
  // Keep core server management
  // - startServer(), stopServer()
  // - getServerStatus(), getTunnelStatus()
  // - Tunnel management methods
}
```

#### Configuration Management Updates
```typescript
// Replace VSCode workspace configuration with file-based config
interface ServerConfig {
  httpPort: number;
  enableCors: boolean;
  allowedOrigins: string[];
  // Remove VSCode-specific settings
}
```

## Data Models

### Configuration Model
```typescript
interface KiroRemoteConfig {
  server: {
    httpPort: number;
    enableCors: boolean;
    allowedOrigins: string[];
  };
  terminal: {
    engineMode: 'auto' | 'pipe' | 'line';
    promptEnabled: boolean;
    hiddenEchoEnabled: boolean;
  };
  tunnel: {
    autoStart: boolean;
    defaultName?: string;
  };
}
```

### Build Configuration Model
```typescript
interface BuildConfig {
  entry: string; // 'src/cli/index.ts'
  output: string; // 'out/cli/'
  target: 'node';
  externals: string[]; // Exclude VSCode APIs
}
```

## Error Handling

### VSCode Dependency Removal
- **Issue**: Code that imports VSCode APIs will fail to compile
- **Solution**: Remove all `import * as vscode` statements and replace with appropriate alternatives
- **Fallback**: Use Node.js native APIs for file system, process management, etc.

### Configuration Migration
- **Issue**: Existing VSCode workspace settings will be lost
- **Solution**: Create migration utility to convert VSCode settings to file-based config
- **Fallback**: Use sensible defaults if migration fails

### Build Process Updates
- **Issue**: Build scripts reference VSCode extension compilation
- **Solution**: Update package.json scripts to only build CLI and web components
- **Fallback**: Maintain separate build commands for different components

### Webview to Web Server Migration
- **Issue**: VSCode webview provider needs to be replaced with direct web server
- **Solution**: The React frontend already builds to static files that can be served by HttpServer
- **Fallback**: Ensure React frontend works independently of VSCode context

## Testing Strategy

### Manual Testing Approach
Following the project's preference for manual testing over automated tests:

1. **CLI Functionality Testing**
   - Test all CLI commands: `start`, `stop`, `status`, `init`
   - Verify server starts and serves web interface
   - Test WebSocket connections for terminal, filesystem, and git operations
   - Validate ACP integration continues to work

2. **Web Interface Testing**
   - Access web interface at `http://localhost:3900`
   - Test all frontend functionality through browser
   - Verify WebSocket communication works
   - Test file operations, terminal sessions, and git operations

3. **Build Process Testing**
   - Run `npm run build` and verify clean compilation
   - Test CLI binary execution: `./out/cli/index.js start`
   - Verify React frontend builds and serves correctly
   - Test cross-platform build process

4. **Configuration Testing**
   - Test configuration file creation and loading
   - Verify default settings work correctly
   - Test configuration migration from VSCode settings (if applicable)

### Integration Testing
- **Server + Frontend**: Verify web server serves React frontend correctly
- **CLI + Server**: Ensure CLI commands properly manage server lifecycle
- **WebSocket + Services**: Test real-time communication between frontend and backend services
- **ACP Integration**: Verify ACP functionality remains intact after cleanup

### Regression Testing
- **Core Features**: Ensure all existing CLI functionality continues to work
- **Performance**: Verify build times improve after removing VSCode dependencies
- **Compatibility**: Test on different platforms (Windows, macOS, Linux)

## Implementation Phases

### Phase 1: Remove VSCode Extension Files
- Delete `src/extension.ts` and VSCode command files
- Remove VSCode webview provider and related files
- Clean up VSCode pseudo terminal implementation

### Phase 2: Update Server Components
- Remove VSCode dependencies from ServerManager
- Update configuration management to use file-based config
- Clean up any remaining VSCode API references

### Phase 3: Update Build Configuration
- Update `tsconfig.json` to exclude VSCode extension files
- Clean up `package.json` scripts and dependencies
- Update build process to focus on CLI and web components

### Phase 4: Testing and Validation
- Manual testing of all CLI functionality
- Web interface testing through browser
- Build process validation
- Documentation updates