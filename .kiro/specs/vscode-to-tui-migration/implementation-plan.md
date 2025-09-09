# VS Code to TUI Migration Implementation Plan

## Executive Summary

This document outlines the complete migration strategy for transforming the VS Code extension-based "Web Automation Tunnel" into a standalone CLI/TUI application. The migration preserves all core functionality while removing VS Code API dependencies and enhancing the user experience with a terminal-based interface.

## Current State Analysis

### VS Code API Dependencies Found

1. **Extension Activation (`src/extension.ts`)**
   - 387 lines of VS Code-specific code
   - Command registrations for all functionality
   - WebView provider setup
   - Status bar integration
   - Quick pick dialogs and input boxes
   - Secret storage for Cloudflare tokens

2. **Server Management (`src/server/ServerManager.ts`)**
   - VS Code EventEmitters for state changes
   - Configuration management via VS Code settings
   - UI notifications and error displays
   - Progress indicators and status updates

3. **Terminal Service (`src/server/TerminalService.ts`)**
   - Already has optional VS Code support via `getVSCode()` function
   - Workspace root detection fallbacks
   - Configuration reading with graceful degradation

4. **WebSocket Provider (`src/webview/provider.ts`)**
   - WebView integration for React frontend
   - Message handling between webview and extension
   - HTML content generation

5. **Command System (`src/commands/`)**
   - VS Code command palette integration
   - Button command implementations
   - PTY diagnostics

## Migration Strategy

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 Package.json Restructuring
```json
{
  "name": "kiro-remote",
  "description": "Web Automation Tunnel CLI/TUI",
  "bin": {
    "kiro-remote": "./out/cli/index.js"
  },
  "main": "./out/cli/index.js",
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^11.1.0",
    "ink": "^4.4.1",
    "react": "^18.2.0",
    "chokidar": "^3.5.3",
    "ajv": "^8.12.0",
    "node-pty": "^1.0.0",
    "ws": "^8.18.3",
    "@types/uuid": "^10.0.0",
    "uuid": "^11.1.0"
  }
}
```

#### 1.2 Configuration System Migration
- **From**: VS Code workspace settings
- **To**: File-based configuration with CLI overrides
- **Implementation**: Enhance existing `src/config/ConfigManager.ts`
- **Locations**: `~/.kiro-remote/config.json` and `./.kiro-remote/config.json`

#### 1.3 Server Core Refactoring
Create `src/server/ServerCore.ts` to replace VS Code-dependent `ServerManager`:

```typescript
export class ServerCore {
  private serverStatusEmitter = new EventEmitter<ServerStatus>();
  private tunnelStatusEmitter = new EventEmitter<TunnelStatus | null>();
  
  constructor(private configManager: ConfigManager) {}
  
  async start(config?: ServerConfig): Promise<void> {
    // VS Code-free server startup
  }
  
  // Remove all VS Code UI dependencies
  // Keep core HTTP/WebSocket/tunnel functionality
}
```

### Phase 2: Terminal System Migration (Week 2-3)

#### 2.1 PTY Manager Enhancement
Enhance existing `src/terminal/PTYManager.ts`:
- Improve node-pty detection and fallback
- Add cross-platform shell detection
- Implement session persistence

#### 2.2 Configuration Migration Utility
Create `src/utils/configMigrator.ts`:
```typescript
export class ConfigMigrator {
  static async migrateFromVSCode(): Promise<void> {
    // Detect VS Code extension settings
    // Convert to TUI configuration format
    // Preserve tunnel configurations and credentials
  }
}
```

### Phase 3: TUI Framework Implementation (Week 3-5)

#### 3.1 Ink Application Structure
```
src/tui/
├── App.tsx                 # Main application
├── components/
│   ├── Layout.tsx          # Responsive layout
│   ├── Header.tsx          # Status/actions
│   ├── Footer.tsx          # Help/shortcuts
│   ├── TabView.tsx         # Navigation
│   ├── ServerTab.tsx       # Server management
│   ├── TunnelTab.tsx       # Tunnel management
│   ├── TerminalTab.tsx     # Terminal sessions
│   ├── LogsTab.tsx         # Log viewer
│   └── ConfigTab.tsx       # Configuration
├── state/
│   ├── AppState.ts         # Global state
│   ├── ServerState.ts      # Server state
│   ├── TunnelState.ts      # Tunnel state
│   └── TerminalState.ts    # Terminal state
└── hooks/
    ├── useServerState.ts   # Server state hook
    ├── useTunnelState.ts   # Tunnel state hook
    └── useTerminalState.ts # Terminal state hook
```

#### 3.2 State Management Architecture
```typescript
// Global application state
interface AppState {
  server: ServerState;
  tunnel: TunnelState;
  terminal: TerminalState;
  logs: LogEntry[];
  config: TUIConfig;
  activeTab: 'server' | 'tunnel' | 'terminal' | 'logs' | 'config';
}

// Event-driven updates
class StateManager {
  private state: AppState;
  private emitter: EventEmitter<AppState>;
  
  updateServerStatus(status: ServerStatus): void {
    this.state.server = { ...this.state.server, ...status };
    this.emitter.emit('stateChange', this.state);
  }
}
```

### Phase 4: Feature Implementation (Week 5-7)

#### 4.1 Server Management TUI
- Real-time status display
- Start/stop/restart controls
- Port configuration
- Client connection monitoring
- Error handling and recovery

#### 4.2 Tunnel Management TUI
- Active tunnel list
- Quick tunnel creation
- Named tunnel configuration
- Cloudflare token management
- URL copying and sharing

#### 4.3 Terminal Session TUI
- Session list and management
- Terminal output display
- Input handling and resizing
- Session persistence
- Multi-session support

#### 4.4 Log Viewer TUI
- Real-time log streaming
- Log level filtering
- Search functionality
- Export capabilities

### Phase 5: Polish and Distribution (Week 7-8)

#### 5.1 Keyboard Navigation
- Tab navigation
- Shortcut keys
- Quick actions
- Help system

#### 5.2 Error Handling
- Graceful degradation
- User-friendly error messages
- Recovery suggestions
- Debug mode

#### 5.3 Packaging and Distribution
- NPM package preparation
- Binary compilation options
- Installation scripts
- Documentation

## File Migration Matrix

### Files to Remove
| File | Reason | Replacement |
|------|--------|-------------|
| `src/extension.ts` | VS Code entry point | `src/cli/index.ts` |
| `src/commands/buttonCommands.ts` | VS Code command palette | TUI actions |
| `src/commands/diagnosePTY.ts` | VS Code diagnostics | CLI diagnostics |
| `src/webview/provider.ts` | WebView provider | HTTP server serves React app |
| `src/integration-test.ts` | Extension tests | CLI/TUI tests |

### Files to Refactor
| File | Changes Required | Priority |
|------|------------------|----------|
| `src/server/ServerManager.ts` | Remove VS Code EventEmitters, notifications | High |
| `src/server/TerminalService.ts` | Enhance CLI mode, remove VS Code fallbacks | High |
| `src/server/CloudflaredManager.ts` | Remove secret storage, file-based credentials | High |
| `src/server/ConfigurationManager.ts` | Remove VS Code config, file-based only | Medium |
| `src/server/ErrorHandler.ts` | Remove VS Code notifications, TUI errors | Medium |
| `src/server/WebSocketServer.ts` | Remove VS Code command dependencies | Medium |
| `src/server/pseudo/KiroPseudoTerminal.ts` | Keep for extension compatibility | Low |

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/server/ServerCore.ts` | VS Code-free server management | 200 |
| `src/tui/App.tsx` | Main TUI application | 150 |
| `src/tui/components/` | TUI component library | 800 |
| `src/tui/state/` | State management | 300 |
| `src/tui/hooks/` | Custom React hooks | 200 |
| `src/utils/configMigrator.ts` | Configuration migration | 150 |

## Implementation Timeline

### Week 1-2: Core Infrastructure
- [ ] Package.json restructuring
- [ ] Configuration system migration
- [ ] ServerCore implementation
- [ ] Basic CLI functionality testing

### Week 2-3: Terminal System
- [ ] PTY Manager enhancement
- [ ] Configuration migration utility
- [ ] Terminal system testing
- [ ] Cross-platform validation

### Week 3-5: TUI Framework
- [ ] Ink application structure
- [ ] State management system
- [ ] Basic TUI components
- [ ] Navigation and layout

### Week 5-7: Feature Implementation
- [ ] Server management TUI
- [ ] Tunnel management TUI
- [ ] Terminal session TUI
- [ ] Log viewer TUI

### Week 7-8: Polish and Distribution
- [ ] Keyboard navigation
- [ ] Error handling
- [ ] Packaging and distribution
- [ ] Documentation

## Risk Assessment

### High Risk
1. **VS Code API Dependencies**: Deep integration in core server components
2. **Configuration Migration**: User data preservation during transition
3. **Terminal System**: node-pty compatibility across platforms

### Medium Risk
1. **TUI Performance**: React-based TUI with real-time updates
2. **State Management**: Complex state synchronization
3. **Cross-Platform Compatibility**: Windows/macOS/Linux differences

### Low Risk
1. **WebSocket Communication**: Already platform-independent
2. **HTTP Server**: Already uses Node.js APIs
3. **File System Operations**: Already uses Node.js APIs

## Testing Strategy

### Unit Testing
- ServerCore functionality
- Configuration management
- PTY operations
- State management

### Integration Testing
- CLI to server communication
- TUI to state synchronization
- Terminal session management
- Configuration migration

### End-to-End Testing
- Complete workflow testing
- Cross-platform validation
- Performance testing
- User acceptance testing

## Success Criteria

### Functional Requirements
- [ ] All VS Code extension features available in TUI
- [ ] Seamless configuration migration
- [ ] Cross-platform compatibility
- [ ] Real-time status updates
- [ ] Terminal session management

### Non-Functional Requirements
- [ ] Responsive TUI interface
- [ ] Intuitive keyboard navigation
- [ ] Robust error handling
- [ ] Comprehensive logging
- [ ] Easy installation and setup

## Rollback Strategy

1. **Branch Strategy**: Maintain separate `vscode-extension` and `tui-migration` branches
2. **Feature Flags**: Implement runtime detection for VS Code vs TUI mode
3. **Gradual Migration**: Support both interfaces during transition period
4. **Data Backup**: Automatic backup of configuration before migration

## Conclusion

This migration plan provides a comprehensive roadmap for transforming the VS Code extension into a standalone CLI/TUI application. The phased approach ensures minimal disruption to existing users while enabling modern terminal-based workflow enhancements. The preserved core functionality combined with the new TUI interface will provide a more versatile and accessible user experience.