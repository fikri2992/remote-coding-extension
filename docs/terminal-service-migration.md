# CLI Terminal Service Migration

## Overview

This document describes the migration of the Terminal Service from the VS Code extension to a standalone CLI implementation. The migration provides a robust, secure, and feature-rich terminal service that can be used independently of VS Code.

## Architecture

### Core Components

1. **TerminalConfigManager** (`src/cli/services/TerminalConfig.ts`)
   - Manages terminal service configuration
   - Handles environment variables and config files
   - Provides command validation and safety checks
   - Supports platform-specific shell detection

2. **TerminalSafetyManager** (`src/cli/services/TerminalSafety.ts`)
   - Validates commands for security
   - Implements command allowlist/denylist
   - Sanitizes environment variables
   - Provides safe command execution with timeouts

3. **TerminalSession** (`src/cli/services/TerminalSession.ts`)
   - Wraps terminal session lifecycle
   - Integrates with pseudo-terminal engine
   - Handles input/output buffering
   - Manages session persistence and idle timeouts

4. **TerminalSessionManager** (`src/cli/services/TerminalService.ts`)
   - Manages multiple terminal sessions
   - Handles session lifecycle (create, input, resize, kill)
   - Implements idle session reaping
   - Provides session statistics and monitoring

5. **TerminalService** (`src/cli/services/TerminalService.ts`)
   - Main service interface for WebSocket operations
   - Handles incoming terminal messages
   - Coordinates with session manager
   - Provides client disconnect handling

### Integration Points

- **WebSocket Server**: Terminal service integrates with the existing WebSocket server
- **CLI Commands**: Provides rich CLI interface for terminal operations
- **Server Integration**: Integrated into the main CLI server for web interface support

## Features

### Security & Safety

- **Command Allowlist**: Only safe commands are allowed by default
- **Pattern Detection**: Blocks dangerous command patterns (e.g., `rm -rf /`)
- **Path Validation**: Prevents directory traversal attacks
- **Environment Sanitization**: Removes dangerous environment variables
- **Timeout Protection**: Commands have configurable timeouts
- **Sensitive Data Redaction**: Automatically redacts API keys and secrets

### Session Management

- **Multiple Sessions**: Support for concurrent terminal sessions
- **Persistent Sessions**: Sessions can survive client disconnects
- **Idle Timeout**: Automatic cleanup of idle sessions
- **Session Statistics**: Real-time monitoring of session state
- **Buffer Management**: Output buffering for disconnected clients

### Terminal Engines

- **Line Mode**: Command-by-command execution with local echo
- **Pipe Mode**: Full shell session with continuous I/O
- **Auto Detection**: Automatically selects appropriate engine
- **Platform Support**: Works on Windows, macOS, and Linux

### AI Integration

- **Credential Injection**: Automatically injects AI API keys
- **Provider Support**: Supports OpenAI, Anthropic, Google, and others
- **Configurable**: Can be enabled/disabled via configuration
- **Environment Enhancement**: Enhances terminal environment with AI credentials

## CLI Usage

### Basic Commands

```bash
# Show terminal configuration
kiro-cli terminal config

# Create a terminal session
kiro-cli terminal session --cols 120 --rows 40 --cwd /tmp

# Execute a command safely
kiro-cli terminal exec "ls -la" --cwd /tmp

# List active sessions
kiro-cli terminal list

# Test command safety
kiro-cli terminal test-safety "rm -rf /"

# Start interactive terminal
kiro-cli terminal interactive --engine line
```

### Configuration

The terminal service can be configured via:

1. **Environment Variables**:
   ```bash
   export KIRO_DEBUG_TERMINAL=1          # Enable debug logging
   export KIRO_EXEC_ALLOW_UNSAFE=1       # Allow unsafe commands
   export KIRO_INJECT_AI_CREDS=1         # Inject AI credentials
   export KIRO_TERMINAL_ENGINE=pipe      # Force pipe mode
   ```

2. **Configuration File**:
   ```json
   {
     "engineMode": "auto",
     "defaultShell": "/bin/bash",
     "idleTimeoutEphemeral": 900000,
     "idleTimeoutPersistent": 1800000,
     "commandAllowlist": ["ls", "echo", "git", "npm"],
     "allowUnsafeCommands": false,
     "enableRedaction": true,
     "injectAICredentials": true,
     "enableDebug": false
   }
   ```

### Interactive Mode

```bash
kiro-cli terminal interactive
```

Features:
- Real-time command execution
- Safety validation
- Output streaming
- Command history
- Exit with `exit` or `Ctrl+C`

## API Reference

### TerminalSessionManager

```typescript
class TerminalSessionManager {
  async createSession(options: TerminalCommandOptions, clientId?: string): Promise<{sessionId: string, cwd: string}>
  async executeCommand(command: string, options: TerminalCommandOptions, sendToClient: SendToClientFunction): Promise<void>
  inputToSession(sessionId: string, data: string): boolean
  resizeSession(sessionId: string, cols: number, rows: number): boolean
  killSession(sessionId: string): boolean
  listSessions(): TerminalSessionInfo[]
  handleClientDisconnect(clientId: string): void
  getStats(): SessionStats
}
```

### TerminalService

```typescript
class TerminalService {
  constructor(sendToClient: SendToClientFunction)
  async handle(clientId: string, message: any): Promise<void>
  onClientDisconnect(clientId: string): void
  dispose(): void
  getStats(): SessionStats
}
```

### Message Protocol

#### Create Session
```json
{
  "type": "terminal",
  "id": "msg-123",
  "data": {
    "op": "create",
    "cols": 80,
    "rows": 24,
    "cwd": "/tmp",
    "persistent": false,
    "engineMode": "auto"
  }
}
```

#### Execute Command
```json
{
  "type": "terminal",
  "id": "msg-124",
  "data": {
    "op": "exec",
    "command": "ls -la",
    "cwd": "/tmp"
  }
}
```

#### Terminal Input
```json
{
  "type": "terminal",
  "id": "msg-125",
  "data": {
    "op": "input",
    "sessionId": "term_123456",
    "data": "echo hello\n"
  }
}
```

## Testing

### Unit Tests

Run the test suite:
```bash
npm test -- --testPathPattern=terminal-service
```

### Integration Tests

Test CLI commands:
```bash
# Test configuration
kiro-cli terminal config --json

# Test session creation
kiro-cli terminal session --persistent

# Test command execution
kiro-cli terminal exec "echo 'test'"

# Test safety validation
kiro-cli terminal test-safety "echo safe"
kiro-cli terminal test-safety "rm -rf /"
```

### Manual Testing

1. **Interactive Mode**:
   ```bash
   kiro-cli terminal interactive
   ```
   - Try various commands
   - Test safety features
   - Verify output formatting

2. **Server Integration**:
   ```bash
   kiro-cli start
   ```
   - Connect via web interface
   - Create terminal sessions
   - Test WebSocket communication

## Migration Checklist

- [x] Analyze current TerminalService implementation
- [x] Set up CLI terminal service structure
- [x] Create CLI Terminal Configuration Manager
- [x] Create CLI Terminal Session Wrapper
- [x] Implement Command Safety and Execution
- [x] Create Enhanced Session Management
- [x] Implement CLI Integration
- [x] Add Testing and Validation
- [x] Update server integration
- [x] Document the migration

## Security Considerations

1. **Command Allowlist**: Default allowlist prevents dangerous commands
2. **Environment Sanitization**: Removes potentially dangerous variables
3. **Path Validation**: Prevents directory traversal attacks
4. **Timeout Protection**: Prevents hanging commands
5. **Sensitive Data Redaction**: Automatically redacts secrets in output
6. **Session Isolation**: Sessions are isolated from each other

## Performance Considerations

1. **Session Reaping**: Idle sessions are automatically cleaned up
2. **Buffer Limits**: Output buffers are size-limited to prevent memory issues
3. **Concurrent Sessions**: Efficient handling of multiple sessions
4. **Resource Management**: Proper cleanup of child processes and resources

## Troubleshooting

### Common Issues

1. **Command Not Allowed**:
   ```
   Error: Command not in allowlist
   ```
   - Check if command is in the allowlist
   - Use `KIRO_EXEC_ALLOW_UNSAFE=1` to override (not recommended)

2. **Session Creation Fails**:
   ```
   Error: Failed to create session
   ```
   - Check working directory permissions
   - Verify shell path in configuration

3. **Command Timeout**:
   ```
   Error: Command timed out
   ```
   - Increase timeout value
   - Check if command is hanging

4. **WebSocket Connection Issues**:
   ```
   Error: WebSocket connection failed
   ```
   - Verify server is running
   - Check port and firewall settings

### Debug Mode

Enable debug logging:
```bash
export KIRO_DEBUG_TERMINAL=1
kiro-cli terminal config
```

### Log Files

Check server logs for detailed error information:
```bash
kiro-cli start --debug
```

## Future Enhancements

1. **Additional Terminal Engines**: Support for more terminal emulators
2. **Session Persistence**: Save and restore sessions across restarts
3. **Advanced Security**: Sandboxing, user permissions, resource limits
4. **Performance Monitoring**: Metrics, profiling, optimization
5. **Plugin System**: Extensible architecture for custom features
6. **Multi-User Support**: User isolation, authentication, authorization

## Conclusion

The CLI Terminal Service migration provides a robust, secure, and feature-rich terminal implementation that can be used independently of VS Code. The migration maintains compatibility with the existing WebSocket protocol while adding new features and improvements for CLI usage.

The implementation focuses on security, performance, and usability, making it suitable for both development and production environments.
