# VS Code to TUI Migration Implementation Plan

## Current Implementation Status

✅ **Already Implemented:**
- CLI infrastructure (`src/cli/index.ts`, `src/cli/controller.ts`)
- Configuration management (`src/config/ConfigManager.ts`)
- PTY manager (`src/terminal/PTYManager.ts`)
- Logger with Chalk (`src/utils/logger.ts`)
- Package.json CLI binary entry point

❌ **Still Needed:**
- TUI components (no `src/tui` directory exists)
- Ink/React dependencies in package.json
- VS Code dependency removal from server components
- Extension file cleanup

## Phase 1: Dependencies and Core Infrastructure
- [ ] 1 Add TUI Dependencies
  - Add ink, react, @types/react to package.json dependencies
  - Add chokidar, ajv for file watching and validation
  - Update build scripts to include TUI compilation
  - _Requirements: 1.1, 10.1, 10.2, 10.3_

- [ ] 1.1 Remove VS Code Dependencies from ServerManager
  - Replace vscode.EventEmitter with Node.js EventEmitter in `src/server/ServerManager.ts`
  - Remove vscode.window.showInformationMessage calls, use logger instead
  - Remove VS Code configuration dependency, use ConfigManager
  - Remove status bar and quick pick functionality
  - _Requirements: 1.3, 1.4, 7.1, 7.2_

- [ ] 1.2 Remove VS Code Dependencies from TerminalService
  - Update `src/server/TerminalService.ts` to work without VS Code configuration
  - Enhance workspace root detection for CLI environment
  - Remove VS Code-specific error handling
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 1.3 Remove VS Code Dependencies from CloudflaredManager
  - Update `src/server/CloudflaredManager.ts` to remove VS Code configuration access
  - Implement file-based credential storage instead of VS Code secrets
  - Remove extension context usage
  - _Requirements: 8.1, 8.2, 8.3_

## Phase 2: TUI Framework Implementation

- [ ] 2 Create TUI Application Structure
  - Create `src/tui/App.tsx` main Ink application component
  - Implement `src/tui/components/Layout.tsx` responsive layout
  - Create `src/tui/components/Header.tsx` status header
  - Create `src/tui/components/Footer.tsx` shortcuts footer
  - Create `src/tui/components/TabView.tsx` tabbed navigation
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2.1 Implement State Management System
  - Create `src/tui/state/AppState.ts` global application state
  - Implement `src/tui/state/ServerState.ts` server state management
  - Implement `src/tui/state/TunnelState.ts` tunnel state management
  - Implement `src/tui/state/TerminalState.ts` terminal session state
  - Create event-driven state updates between server and TUI
  - _Requirements: 2.2, 7.1, 8.1_

- [ ] 2.2 Create Server Management TUI
  - Create `src/tui/components/ServerTab.tsx`
  - Implement real-time server status display
  - Add start/stop/restart controls
  - Create client connection monitoring
  - Add error handling and recovery UI
  - _Requirements: 2.2, 7.1, 7.2, 7.3, 7.4_

- [ ] 2.3 Create Tunnel Management TUI
  - Create `src/tui/components/TunnelTab.tsx`
  - Implement active tunnel list display
  - Add quick tunnel creation interface
  - Create named tunnel configuration form
  - Add Cloudflare token management UI
  - _Requirements: 2.2, 8.1, 8.2, 8.3, 8.4, 8.5_

## Phase 3: Advanced TUI Features

- [ ] 3 Implement Terminal Session TUI
  - Create `src/tui/components/TerminalTab.tsx`
  - Implement terminal session list and management
  - Create terminal output display component
  - Add input handling and terminal resizing
  - Implement session persistence and multi-session support
  - _Requirements: 2.4, 4.3, 4.5, 8.5_

- [ ] 3.1 Create Log Viewer TUI
  - Create `src/tui/components/LogsTab.tsx`
  - Implement real-time log streaming from logger
  - Add log level filtering and search functionality
  - Create log export functionality
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 3.2 Create Configuration Editor TUI
  - Create `src/tui/components/ConfigTab.tsx`
  - Implement configuration editing interface
  - Add validation and error display using ajv
  - Create configuration reset functionality
  - _Requirements: 3.1, 3.4, 3.5_

- [ ] 3.3 Implement Keyboard Navigation System
  - Add tab navigation with keyboard shortcuts
  - Implement quick action keys for common operations
  - Create help system and shortcut reference
  - Add accessibility features for keyboard-only navigation
  - _Requirements: 2.3, 5.2, 5.3_

## Phase 4: CLI Integration and Polish

- [ ] 4 Integrate TUI with CLI
  - Add TUI mode to `src/cli/index.ts` (new `tui` command)
  - Connect TUI state management to existing server controller
  - Implement graceful shutdown handling
  - Add CLI flags for TUI customization
  - _Requirements: 1.1, 1.2, 2.1_

- [ ] 4.1 Create Configuration Migration Utility
  - Create `src/utils/configMigrator.ts`
  - Detect existing VS Code extension configuration
  - Convert VS Code settings to TUI configuration format
  - Preserve tunnel configurations and credentials
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 4.2 Implement Error Handling and User Experience
  - Add comprehensive error handling in TUI components
  - Implement user-friendly error messages and recovery suggestions
  - Create graceful degradation for missing dependencies
  - Add debug mode and troubleshooting UI
  - _Requirements: 2.5, 7.3, 9.2, 9.3_

- [ ] 4.3 Cross-Platform Validation and Testing
  - Test TUI functionality on Windows (cmd/PowerShell)
  - Test TUI functionality on macOS/Linux
  - Validate terminal resizing and keyboard handling
  - Test configuration migration across platforms
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

## Phase 5: Extension Cleanup and Distribution

- [ ] 5 Clean Up VS Code Extension Files
  - Remove `src/extension.ts` and VS Code activation code
  - Remove `src/commands/buttonCommands.ts` and `src/commands/diagnosePTY.ts`
  - Remove `src/webview/provider.ts` and webview assets
  - Remove `src/integration-test.ts`
  - _Requirements: 1.1, 10.1_

- [ ] 5.1 Update Package.json for CLI Distribution
  - Remove VS Code extension metadata (engines, activationEvents, contributes)
  - Update main entry point to CLI
  - Add proper CLI binary configuration
  - Update build scripts for standalone distribution
  - _Requirements: 10.3, 10.4, 10.5_

- [ ] 5.2 Performance Optimization
  - Optimize TUI rendering and state updates
  - Implement efficient log streaming and filtering
  - Add memory management for long-running sessions
  - Optimize startup time and resource usage
  - _Requirements: 2.2, 7.2, 8.2_

- [ ] 5.3 Documentation and User Guide
  - Create comprehensive CLI usage documentation
  - Write TUI navigation and feature guide
  - Document configuration options and file formats
  - Create migration guide from VS Code extension
  - _Requirements: 10.4, 12.4, 12.5_