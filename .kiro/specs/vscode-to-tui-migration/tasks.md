# Implementation Plan

- [ ] 1. Project Structure and Dependencies Setup
  - Create new CLI application structure with proper entry points
  - Remove VS Code extension dependencies and add TUI dependencies (Ink, Chalk, Commander, node-pty)
  - Update package.json to reflect CLI application instead of VS Code extension
  - _Requirements: 1.1, 10.1, 10.2_

- [ ] 2. Configuration System Migration
  - [ ] 2.1 Create file-based configuration manager
    - Implement ConfigManager class to read/write JSON configuration files
    - Add configuration schema validation using AJV
    - Support both global (~/.kiro-tunnel/) and project-local (.kiro-tunnel/) configuration
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ] 2.2 Implement VS Code configuration migration
    - Create migration utility to detect and convert VS Code extension settings
    - Map VS Code configuration keys to new TUI configuration format
    - Preserve existing tunnel configurations and credentials during migration
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 2.3 Add CLI argument parsing and configuration override
    - Implement Commander.js CLI interface with configuration options
    - Support CLI arguments that override file-based configuration
    - Add validation for CLI arguments and provide helpful error messages
    - _Requirements: 3.2, 3.4_

- [ ] 3. Server Core Migration (Remove VS Code Dependencies)
  - [ ] 3.1 Migrate ServerManager to ServerCore
    - Remove all VS Code API imports and dependencies from ServerManager
    - Replace vscode.window.showInformationMessage with custom notification system
    - Replace vscode.workspace.getConfiguration with ConfigManager integration
    - _Requirements: 1.1, 1.3_

  - [ ] 3.2 Update HTTP and WebSocket servers for standalone operation
    - Modify HttpServer to work without VS Code context
    - Update WebSocketServer to remove VS Code-specific error handling
    - Ensure all server functionality works independently of VS Code
    - _Requirements: 1.3, 7.1, 7.2_

  - [ ] 3.3 Migrate error handling and logging systems
    - Replace VS Code notification system with TUI-compatible error display
    - Update ErrorHandler to work with file-based logging instead of VS Code output
    - Implement structured logging with configurable levels (debug, info, warn, error)
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 4. Terminal System Migration (Replace VS Code PseudoTerminal)
  - [ ] 4.1 Implement node-pty integration
    - Create PTYManager class using node-pty instead of VS Code PseudoTerminal
    - Implement terminal session creation, management, and cleanup
    - Handle cross-platform terminal differences (Windows cmd/PowerShell, Unix shells)
    - _Requirements: 4.1, 4.4, 11.1, 11.2, 11.3_

  - [ ] 4.2 Create terminal session management
    - Implement SessionManager for multiple terminal sessions
    - Add session persistence and recovery capabilities
    - Support terminal resizing and input/output streaming
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ] 4.3 Migrate SessionEngine to work without VS Code
    - Update SessionEngine to use node-pty instead of VS Code APIs
    - Maintain existing terminal modes (line, pipe) and functionality
    - Ensure terminal output redaction and security features work correctly
    - _Requirements: 4.1, 4.2_

- [ ] 5. TUI Framework Implementation
  - [ ] 5.1 Create main TUI application structure
    - Implement main App component using Ink framework
    - Set up React component structure for terminal UI
    - Create navigation system and keyboard shortcut handling
    - _Requirements: 2.1, 2.3, 5.2_

  - [ ] 5.2 Implement core TUI components
    - Create Dashboard component showing server and tunnel status
    - Build ServerManager component for server control and monitoring
    - Implement TunnelManager component for tunnel creation and management
    - _Requirements: 2.2, 7.1, 7.4, 8.1, 8.3_

  - [ ] 5.3 Add terminal interface components
    - Create TerminalManager component for terminal session display
    - Implement terminal output rendering and input handling in TUI
    - Add support for multiple terminal tabs and session switching
    - _Requirements: 2.4, 4.3, 8.5_

- [ ] 6. Command System Migration
  - [ ] 6.1 Create custom command registry
    - Implement CommandRegistry to replace VS Code command system
    - Map existing VS Code commands to TUI actions
    - Add keyboard shortcut binding and command execution
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 6.2 Implement TUI-specific command handlers
    - Create handlers for server start/stop, tunnel management, configuration
    - Add interactive prompts for commands requiring user input
    - Implement command validation and error handling in TUI context
    - _Requirements: 5.4, 5.5_

- [ ] 7. File System Operations Migration
  - [ ] 7.1 Replace VS Code workspace APIs with Node.js equivalents
    - Update FileSystemService to use Node.js fs APIs instead of VS Code workspace
    - Implement working directory detection using process.cwd() and user configuration
    - Add file watching using chokidar instead of VS Code file system watcher
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 7.2 Update path resolution and file operations
    - Ensure proper handling of absolute and relative paths across platforms
    - Update file operation error handling for TUI display
    - Maintain existing file security and validation features
    - _Requirements: 6.4, 6.5, 11.4_

- [ ] 8. User Interface Integration
  - [ ] 8.1 Implement real-time status updates in TUI
    - Create reactive state management for server and tunnel status
    - Implement automatic UI refresh and real-time data binding
    - Add visual indicators for loading states and operations in progress
    - _Requirements: 2.2, 7.2, 8.2_

  - [ ] 8.2 Create interactive forms and dialogs
    - Implement tunnel creation forms with input validation
    - Add configuration editor with schema-based validation
    - Create confirmation dialogs for destructive operations
    - _Requirements: 7.3, 8.1, 8.5_

  - [ ] 8.3 Add comprehensive error display and handling
    - Create error modal components for TUI
    - Implement error categorization and user-friendly error messages
    - Add retry mechanisms and suggested actions for common errors
    - _Requirements: 2.5, 7.3, 9.2_

- [ ] 9. Logging and Debugging System
  - [ ] 9.1 Implement file-based logging system
    - Create Logger class with configurable log levels and file rotation
    - Add structured logging with JSON format for machine readability
    - Implement log file management and cleanup policies
    - _Requirements: 9.1, 9.4_

  - [ ] 9.2 Add debug mode and real-time log viewing
    - Create LogViewer TUI component for real-time log streaming
    - Implement debug mode with verbose operation logging
    - Add log filtering and search capabilities in TUI
    - _Requirements: 9.2, 9.5_

- [ ] 10. Cross-Platform Compatibility
  - [ ] 10.1 Handle platform-specific differences
    - Implement Windows-specific path and command handling
    - Add Unix-specific shell and terminal features
    - Ensure proper handling of different terminal environments
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 10.2 Test and validate cross-platform functionality
    - Test terminal operations on Windows (cmd, PowerShell), macOS, and Linux
    - Validate file system operations across different platforms
    - Ensure TUI rendering works correctly in various terminal emulators
    - _Requirements: 11.4, 11.5_

- [ ] 11. Package and Distribution Setup
  - [ ] 11.1 Update build system for CLI application
    - Modify build scripts to create CLI executable instead of VS Code extension
    - Add TypeScript compilation for standalone Node.js application
    - Create distribution packages for different platforms
    - _Requirements: 10.3, 10.4, 11.5_

  - [ ] 11.2 Implement installation and setup process
    - Create installation scripts and documentation
    - Add self-update mechanism for the CLI application
    - Implement first-run setup and configuration wizard
    - _Requirements: 10.4, 10.5_

- [ ] 12. Testing and Validation
  - [ ] 12.1 Create comprehensive unit tests
    - Write unit tests for ConfigManager, PTYManager, and ServerCore
    - Test TUI components with React Testing Library for Ink
    - Add tests for cross-platform compatibility and error handling
    - _Requirements: All requirements validation_

  - [ ] 12.2 Implement integration testing
    - Test complete application startup and shutdown sequences
    - Validate server and tunnel management through TUI interface
    - Test configuration migration from VS Code extension
    - _Requirements: 1.1, 7.1, 8.1, 12.1_

  - [ ] 12.3 Perform manual testing and validation
    - Test keyboard navigation and TUI interactions across platforms
    - Validate real-time status updates and error handling
    - Test terminal functionality and session management
    - _Requirements: 2.3, 4.3, 7.2, 8.2_

- [ ] 13. Documentation and Migration Guide
  - [ ] 13.1 Create user documentation
    - Write comprehensive CLI usage documentation
    - Create TUI navigation and feature guide
    - Document configuration options and file formats
    - _Requirements: 10.4, 12.4_

  - [ ] 13.2 Create migration guide from VS Code extension
    - Document step-by-step migration process from VS Code extension
    - Provide troubleshooting guide for common migration issues
    - Create comparison guide showing feature parity between versions
    - _Requirements: 12.4, 12.5_