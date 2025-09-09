# CLI Terminal Service Migration Plan

## Goal
Migrate `TerminalService.ts` from VS Code extension to standalone CLI, removing all VS Code dependencies while maintaining full terminal functionality including pseudo-terminal sessions over WebSocket.

## Current State Analysis

### What We Have
- ✅ Complete TerminalService with WebSocket-based pseudo-terminal sessions
- ✅ Session management with idle timeout and reaping
- ✅ Multiple terminal engines (line mode, pipe mode)
- ✅ Credential injection for AI providers
- ✅ Persistent and ephemeral session types
- ✅ Workspace root detection and path resolution
- ✅ Command execution with safety allowlist
- ✅ Output redaction for sensitive information
- ✅ Session listing and management

### What Needs to Change
- ❌ VS Code workspace configuration access (`vscode.workspace.getConfiguration`)
- ❌ VS Code optional dependency pattern
- ❌ Configuration fallback to environment variables only
- ❌ Enhanced CLI-specific terminal features

## CLI Terminal Service Plan

### Phase 1: Core CLI Terminal Service (1-2 days)

#### 1.1 Create CLI Terminal Service Structure
```bash
src/
├── cli/
│   └── services/
│       ├── TerminalService.ts     # Main CLI terminal service
│       ├── TerminalConfig.ts      # Configuration management
│       ├── TerminalSession.ts     # Session wrapper
│       ├── TerminalTypes.ts       # Type definitions
│       └── TerminalSafety.ts       # Command safety validation
└── server/
    └── TerminalService.ts        # Original (keep for reference)
```

#### 1.2 CLI Terminal Configuration Manager
Create `src/cli/services/TerminalConfig.ts`:
```typescript
export interface TerminalServiceConfig {
  // Engine settings
  engineMode: 'auto' | 'line' | 'pipe';
  defaultShell: string;
  
  // Session management
  idleTimeoutEphemeral: number;  // 15 minutes
  idleTimeoutPersistent: number; // 30 minutes
  maxSessions: number;
  
  // Security and safety
  commandAllowlist: string[];
  allowUnsafeCommands: boolean;
  enableRedaction: boolean;
  
  // Features
  enablePrompt: boolean;
  promptTemplate: string;
  enableHiddenEcho: boolean;
  
  // AI credential injection
  injectAICredentials: boolean;
  aiProviderAllowlist: string[];
  
  // Debug and logging
  enableDebug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  
  // Workspace
  workspaceRoot: string;
  defaultWorkingDirectory: string;
}

export class TerminalConfigManager {
  private config: TerminalServiceConfig;

  constructor(configPath?: string, envVars: NodeJS.ProcessEnv = process.env) {
    this.config = this.loadConfig(configPath, envVars);
  }

  private loadConfig(configPath?: string, envVars: NodeJS.ProcessEnv = process.env): TerminalServiceConfig {
    const defaultConfig: TerminalServiceConfig = {
      engineMode: 'auto',
      defaultShell: this.getDefaultShell(),
      idleTimeoutEphemeral: 15 * 60 * 1000,
      idleTimeoutPersistent: 30 * 60 * 1000,
      maxSessions: 50,
      commandAllowlist: [
        'ls', 'dir', 'echo', 'git', 'npm', 'pnpm', 'yarn', 'node', 'python', 
        'pip', 'go', 'dotnet', 'cargo', 'bash', 'powershell', 'pwsh', 'cmd',
        'cat', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'grep', 'find'
      ],
      allowUnsafeCommands: envVars.KIRO_EXEC_ALLOW_UNSAFE === '1',
      enableRedaction: true,
      enablePrompt: true,
      promptTemplate: '\\e[36m${cwd}\\e[0m$ ',
      enableHiddenEcho: true,
      injectAICredentials: envVars.KIRO_INJECT_AI_CREDS === '1',
      aiProviderAllowlist: ['openai', 'anthropic', 'google', 'cohere'],
      enableDebug: envVars.KIRO_DEBUG_TERMINAL === '1',
      logLevel: 'info',
      workspaceRoot: envVars.PWD || process.cwd(),
      defaultWorkingDirectory: envVars.PWD || process.cwd()
    };

    // Load from config file if provided
    if (configPath) {
      try {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(configData);
        return { ...defaultConfig, ...userConfig };
      } catch (error) {
        console.warn(`Failed to load terminal config from ${configPath}:`, error);
      }
    }

    return defaultConfig;
  }

  private getDefaultShell(): string {
    const platform = process.platform;
    if (platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    } else if (platform === 'darwin') {
      return process.env.SHELL || '/bin/zsh';
    } else {
      return process.env.SHELL || '/bin/bash';
    }
  }

  isCommandAllowed(command: string): boolean {
    if (this.config.allowUnsafeCommands) return true;
    
    const firstWord = command.trim().split(/\s+/)[0]?.toLowerCase();
    return this.config.commandAllowlist.includes(firstWord);
  }

  getShellForPlatform(): string {
    return this.config.defaultShell;
  }

  // ... other config methods
}
```

#### 1.3 CLI Terminal Session Wrapper
Create `src/cli/services/TerminalSession.ts`:
```typescript
import { spawn } from 'child_process';
import { SessionEngine } from '../../server/pseudo/SessionEngine';
import { CredentialManager } from '../../server/CredentialManager';

export interface TerminalSessionOptions {
  sessionId: string;
  cols: number;
  rows: number;
  cwd: string;
  persistent: boolean;
  env: NodeJS.ProcessEnv;
  engineMode: 'auto' | 'line' | 'pipe';
}

export class TerminalSession {
  public sessionId: string;
  public persistent: boolean;
  public createdAt: number;
  public lastActivity: number;
  public outputBuffer: { chunk: string; timestamp: number }[];
  
  private pty: any;
  private config: TerminalServiceConfig;
  private credentialManager: CredentialManager;
  private sessionEngine: SessionEngine;

  constructor(
    private options: TerminalSessionOptions,
    config: TerminalServiceConfig,
    private sendToClient: (clientId: string, message: any) => boolean
  ) {
    this.sessionId = options.sessionId;
    this.persistent = options.persistent;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.outputBuffer = [];
    this.config = config;
    this.credentialManager = new CredentialManager();
    this.sessionEngine = new SessionEngine();
    
    this.initializeSession();
  }

  private initializeSession(): void {
    const sink = (chunk: string) => {
      const text = this.redactSensitiveData(chunk);
      this.outputBuffer.push({ chunk: text, timestamp: Date.now() });
      
      // Limit buffer size
      if (this.outputBuffer.length > 1000) {
        this.outputBuffer = this.outputBuffer.slice(-800);
      }
    };

    // Create pseudo-terminal session
    this.sessionEngine.create(this.sessionId, {
      cwd: this.options.cwd,
      env: this.getEnhancedEnvironment(),
      mode: this.getEngineMode(),
      interceptClear: true,
      promptEnabled: this.config.enablePrompt,
      hiddenEchoEnabled: this.config.enableHiddenEcho
    }, sink);

    // Start the appropriate engine
    if (this.getEngineMode() === 'pipe') {
      try {
        (this.sessionEngine as any).startPipeShell?.(this.sessionId);
      } catch (error) {
        console.error(`Failed to start pipe shell for session ${this.sessionId}:`, error);
      }
    }

    // Create PTY wrapper
    this.pty = {
      write: (data: string) => {
        try {
          this.sessionEngine.input(this.sessionId, data);
          this.lastActivity = Date.now();
        } catch (error) {
          console.error(`Failed to write to session ${this.sessionId}:`, error);
        }
      },
      resize: (cols: number, rows: number) => {
        try {
          this.sessionEngine.resize(this.sessionId, cols, rows);
          this.lastActivity = Date.now();
        } catch (error) {
          console.error(`Failed to resize session ${this.sessionId}:`, error);
        }
      },
      kill: () => {
        try {
          this.sessionEngine.dispose(this.sessionId);
        } catch (error) {
          console.error(`Failed to kill session ${this.sessionId}:`, error);
        }
      }
    };
  }

  private getEnhancedEnvironment(): NodeJS.ProcessEnv {
    const env = { ...this.options.env };
    
    // Inject AI credentials if enabled
    if (this.config.injectAICredentials) {
      Object.assign(env, this.credentialManager.getAllAICredentials());
    }
    
    // Set terminal type
    if (!env.TERM) {
      env.TERM = 'xterm-256color';
    }
    
    return env;
  }

  private getEngineMode(): 'line' | 'pipe' {
    const requestedMode = this.options.engineMode;
    const configMode = this.config.engineMode;
    
    if (requestedMode === 'pipe') return 'pipe';
    if (requestedMode === 'line') return 'line';
    if (configMode === 'pipe') return 'pipe';
    if (configMode === 'line') return 'line';
    
    return 'line'; // Default fallback
  }

  private redactSensitiveData(text: string): string {
    if (!this.config.enableRedaction) return text;

    try {
      let redacted = text;
      
      // GitHub personal access tokens
      redacted = redacted.replace(/ghp_[A-Za-z0-9]{20,}/g, '***');
      
      // OpenAI API keys
      redacted = redacted.replace(/sk-[A-Za-z0-9]{20,}/g, '***');
      
      // AWS access keys
      redacted = redacted.replace(/AKIA[0-9A-Z]{16}/g, '***');
      
      // Bearer tokens
      redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***');
      
      // JWT tokens
      redacted = redacted.replace(/eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, '***');
      
      // Long hex strings (potential secrets)
      redacted = redacted.replace(/[A-Fa-f0-9]{32,}/g, (match) => 
        match.length >= 32 ? '***' : match
      );
      
      return redacted;
    } catch (error) {
      console.warn('Failed to redact sensitive data:', error);
      return text;
    }
  }

  input(data: string): void {
    this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows);
  }

  kill(): void {
    this.pty.kill();
  }

  isIdle(timeoutMs: number): boolean {
    return (Date.now() - this.lastActivity) > timeoutMs;
  }

  getStatus(): { status: 'active' | 'idle' | 'dead'; lastActivity: number } {
    const now = Date.now();
    const idleTime = now - this.lastActivity;
    const timeoutMs = this.persistent ? 
      this.config.idleTimeoutPersistent : 
      this.config.idleTimeoutEphemeral;

    return {
      status: idleTime > timeoutMs ? 'idle' : 'active',
      lastActivity: this.lastActivity
    };
  }
}
```

### Phase 2: Enhanced CLI Terminal Features (2 days)

#### 2.1 Command Safety and Execution
Create `src/cli/services/TerminalSafety.ts`:
```typescript
export class TerminalSafetyManager {
  constructor(private config: TerminalServiceConfig) {}

  validateCommand(command: string): { valid: boolean; reason?: string } {
    if (!command || typeof command !== 'string') {
      return { valid: false, reason: 'Command must be a non-empty string' };
    }

    // Check if command is allowed
    if (!this.config.isCommandAllowed(command)) {
      return { 
        valid: false, 
        reason: `Command not in allowlist. Set KIRO_EXEC_ALLOW_UNSAFE=1 to override.` 
      };
    }

    // Additional safety checks
    const firstWord = command.trim().split(/\s+/)[0]?.toLowerCase();
    
    // Dangerous command patterns
    const dangerousPatterns = [
      /^rm\s+-rf\s+\//,           // rm -rf /
      /^dd\s+if=.*of=\/dev\/sda/,  // dd to disk
      /^chmod\s+-777/,            // chmod 777
      /^:>.*\/dev\/null/,         // Redirect to /dev/null (data loss)
      /^mv\s+.*\//,               // Move to root (potentially dangerous)
      /^cp\s+.*\//                // Copy to root (potentially dangerous)
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return { 
          valid: false, 
          reason: `Command matches dangerous pattern: ${pattern}` 
        };
      }
    }

    return { valid: true };
  }

  sanitizeEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const sanitized = { ...env };
    
    // Remove potentially dangerous environment variables
    const dangerousVars = [
      'PATH',  // Keep PATH but could be manipulated
      'HOME',   // Keep HOME
      'USER',   // Keep USER
      // Add more as needed
    ];

    // For security, we'll keep essential vars but could add more filtering
    return sanitized;
  }

  async executeCommandSafely(
    command: string, 
    options: {
      cwd: string;
      timeout?: number;
      env?: NodeJS.ProcessEnv;
      onOutput?: (data: string, isStderr: boolean) => void;
      onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
    }
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const validation = this.validateCommand(command);
    if (!validation.valid) {
      return { 
        success: false, 
        error: validation.reason || 'Command validation failed' 
      };
    }

    return new Promise((resolve) => {
      const child = spawn(command, {
        shell: true,
        cwd: options.cwd,
        timeout: options.timeout || 30000,
        env: this.sanitizeEnvironment(options.env || process.env)
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        stdout += text;
        options.onOutput?.(text, false);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        stderr += text;
        options.onOutput?.(text, true);
      });

      child.on('close', (code, signal) => {
        options.onExit?.(code, signal);
        
        if (code === 0) {
          resolve({ 
            success: true, 
            output: stdout 
          });
        } else {
          resolve({ 
            success: false, 
            error: stderr || `Command exited with code ${code}` 
          });
        }
      });

      child.on('error', (error) => {
        resolve({ 
          success: false, 
          error: error.message 
        });
      });
    });
  }
}
```

#### 2.2 Enhanced Session Management
```typescript
export class TerminalSessionManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionsByClient: Map<string, Set<string>> = new Map();
  private config: TerminalServiceConfig;
  private safetyManager: TerminalSafetyManager;
  private reapTimer?: NodeJS.Timeout;

  constructor(config: TerminalServiceConfig) {
    this.config = config;
    this.safetyManager = new TerminalSafetyManager(config);
    this.startSessionReaper();
  }

  private startSessionReaper(): void {
    this.reapTimer = setInterval(() => {
      this.reapIdleSessions();
    }, 60000); // Check every minute
  }

  private reapIdleSessions(): void {
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const timeoutMs = session.persistent ? 
        this.config.idleTimeoutPersistent : 
        this.config.idleTimeoutEphemeral;

      if (now - session.lastActivity > timeoutMs) {
        console.log(`Reaping idle terminal session: ${sessionId}`);
        this.killSession(sessionId);
      }
    }
  }

  async createSession(
    options: {
      cols?: number;
      rows?: number;
      cwd?: string;
      persistent?: boolean;
      engineMode?: 'auto' | 'line' | 'pipe';
    },
    clientId?: string
  ): Promise<{ sessionId: string; cwd: string }> {
    const sessionId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cols = options.cols || 80;
    const rows = options.rows || 24;
    const cwd = this.resolveWorkingDirectory(options.cwd);
    const persistent = options.persistent || false;
    const engineMode = options.engineMode || this.config.engineMode;

    const session = new TerminalSession(
      {
        sessionId,
        cols,
        rows,
        cwd,
        persistent,
        env: this.getEnhancedEnvironment(),
        engineMode
      },
      this.config,
      (clientId: string, message: any) => this.sendToClient(clientId, message)
    );

    this.sessions.set(sessionId, session);
    
    if (clientId) {
      if (!this.sessionsByClient.has(clientId)) {
        this.sessionsByClient.set(clientId, new Set());
      }
      this.sessionsByClient.get(clientId)!.add(sessionId);
    }

    return { sessionId, cwd };
  }

  async executeCommand(
    command: string,
    options: {
      cwd?: string;
      clientId?: string;
      sessionId?: string;
    },
    sendToClient: (clientId: string, message: any) => boolean
  ): Promise<void> {
    const cwd = this.resolveWorkingDirectory(options.cwd);
    const sessionId = options.sessionId || `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Send start event
    sendToClient(options.clientId || '', {
      type: 'terminal',
      data: {
        op: 'exec',
        sessionId,
        event: 'start',
        cwd
      }
    });

    // Execute command with safety validation
    const result = await this.safetyManager.executeCommandSafely(command, {
      cwd,
      timeout: 30000,
      env: this.getEnhancedEnvironment(),
      onOutput: (data: string, isStderr: boolean) => {
        sendToClient(options.clientId || '', {
          type: 'terminal',
          data: {
            op: 'exec',
            sessionId,
            event: 'data',
            channel: isStderr ? 'stderr' : 'stdout',
            chunk: data
          }
        });
      },
      onExit: (code, signal) => {
        sendToClient(options.clientId || '', {
          type: 'terminal',
          data: {
            op: 'exec',
            sessionId,
            event: 'exit',
            code,
            signal,
            done: true
          }
        });
      }
    });

    if (!result.success) {
      sendToClient(options.clientId || '', {
        type: 'terminal',
        data: {
          op: 'exec',
          sessionId,
          event: 'error',
          error: result.error
        }
      });
    }
  }

  private resolveWorkingDirectory(cwd?: string): string {
    if (!cwd) return this.config.defaultWorkingDirectory;
    
    if (path.isAbsolute(cwd)) {
      return cwd;
    }
    
    return path.join(this.config.workspaceRoot, cwd);
  }

  private getEnhancedEnvironment(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    
    // Inject AI credentials if enabled
    if (this.config.injectAICredentials) {
      const credentialManager = new CredentialManager();
      Object.assign(env, credentialManager.getAllAICredentials());
    }
    
    // Set terminal type
    if (!env.TERM) {
      env.TERM = 'xterm-256color';
    }
    
    return env;
  }

  // ... other session management methods
}
```

### Phase 3: CLI Integration (1 day)

#### 3.1 CLI Terminal Commands
Create `src/cli/commands/terminal.ts`:
```typescript
import { Command } from 'commander';
import { TerminalService } from '../services/TerminalService';
import { TerminalConfigManager } from '../services/TerminalConfig';

export const terminalCommand = new Command('terminal')
  .description('Terminal and command execution operations')
  .option('--workspace <path>', 'Workspace path')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = new TerminalConfigManager(undefined, {
      ...process.env,
      KIRO_DEBUG_TERMINAL: options.debug ? '1' : undefined
    });

    console.log('🖥️  Terminal Service Configuration:');
    console.log(`   Engine Mode: ${config.config.engineMode}`);
    console.log(`   Default Shell: ${config.config.defaultShell}`);
    console.log(`   Workspace: ${config.config.workspaceRoot}`);
    console.log(`   Debug: ${config.config.enableDebug}`);
  });

// Terminal session management
terminalCommand
  .command('session')
  .description('Create and manage terminal sessions')
  .option('--cols <number>', 'Terminal columns', '80')
  .option('--rows <number>', 'Terminal rows', '24')
  .option('--cwd <path>', 'Working directory')
  .option('--persistent', 'Create persistent session')
  .option('--engine <mode>', 'Terminal engine (auto|line|pipe)', 'auto')
  .action(async (options) => {
    console.log('🚀 Creating terminal session...');
    console.log(`   Size: ${options.cols}x${options.rows}`);
    console.log(`   CWD: ${options.cwd || process.cwd()}`);
    console.log(`   Engine: ${options.engine}`);
    console.log(`   Persistent: ${options.persistent}`);
    
    // Session creation logic would go here
    // For CLI mode, this might start an interactive terminal
  });

// Command execution
terminalCommand
  .command('exec')
  .description('Execute a command safely')
  .argument('<command>', 'Command to execute')
  .option('--cwd <path>', 'Working directory')
  .option('--timeout <ms>', 'Command timeout in milliseconds', '30000')
  .action(async (command, options) => {
    console.log(`🔧 Executing: ${command}`);
    console.log(`   CWD: ${options.cwd || process.cwd()}`);
    console.log(`   Timeout: ${options.timeout}ms`);
    
    // Command execution logic would go here
    // This would use the TerminalSafetyManager for validation
  });

// Terminal configuration
terminalCommand
  .command('config')
  .description('Show terminal configuration')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const config = new TerminalConfigManager();
    
    if (options.json) {
      console.log(JSON.stringify(config.config, null, 2));
    } else {
      console.log('⚙️  Terminal Configuration:');
      Object.entries(config.config).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
  });

// Shell detection
terminalCommand
  .command('shell')
  .description('Detect and show shell information')
  .action(async () => {
    const config = new TerminalConfigManager();
    const shell = config.getShellForPlatform();
    
    console.log('🐚 Shell Information:');
    console.log(`   Platform: ${process.platform}`);
    console.log(`   Detected Shell: ${shell}`);
    console.log(`   Default Shell: ${config.config.defaultShell}`);
  });
```

#### 3.2 WebSocket Integration
Update the main CLI server to handle terminal operations:
```typescript
// In src/cli/server.ts or WebSocket handler
import { TerminalSessionManager } from './services/TerminalSession';
import { TerminalConfigManager } from './services/TerminalConfig';

export class CliServer {
  private terminalManager: TerminalSessionManager;
  private terminalConfig: TerminalServiceConfig;

  constructor() {
    this.terminalConfig = new TerminalConfigManager().config;
    this.terminalManager = new TerminalSessionManager(this.terminalConfig);
  }

  async handleTerminalOperation(clientId: string, message: any) {
    const { operation, ...data } = message.data;
    
    try {
      let result;
      
      switch (operation) {
        case 'create':
          result = await this.terminalManager.createSession(data, clientId);
          this.sendToClient(clientId, {
            type: 'terminal',
            id: message.id,
            data: { op: 'create', ok: true, ...result }
          });
          break;
          
        case 'exec':
          await this.terminalManager.executeCommand(
            data.command,
            { ...data, clientId },
            (clientId: string, msg: any) => this.sendToClient(clientId, msg)
          );
          break;
          
        case 'input':
          this.terminalManager.inputToSession(data.sessionId, data.data);
          this.sendToClient(clientId, {
            type: 'terminal',
            id: message.id,
            data: { op: 'input', ok: true }
          });
          break;
          
        case 'resize':
          this.terminalManager.resizeSession(data.sessionId, data.cols, data.rows);
          this.sendToClient(clientId, {
            type: 'terminal',
            id: message.id,
            data: { op: 'resize', ok: true }
          });
          break;
          
        case 'dispose':
          this.terminalManager.killSession(data.sessionId);
          this.sendToClient(clientId, {
            type: 'terminal',
            id: message.id,
            data: { op: 'dispose', ok: true }
          });
          break;
          
        case 'list-sessions':
          const sessions = this.terminalManager.listSessions();
          this.sendToClient(clientId, {
            type: 'terminal',
            id: message.id,
            data: { op: 'list-sessions', ok: true, sessions }
          });
          break;
          
        default:
          throw new Error(`Unknown terminal operation: ${operation}`);
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'terminal',
        id: message.id,
        data: { op: operation, ok: false, error: error.message }
      });
    }
  }

  onClientDisconnect(clientId: string) {
    this.terminalManager.handleClientDisconnect(clientId);
  }
}
```

### Phase 4: Testing and Validation (1 day)

#### 4.1 Test Scenarios
```typescript
// tests/terminal-service.test.ts
import { TerminalSessionManager } from '../src/cli/services/TerminalSession';
import { TerminalConfigManager } from '../src/cli/services/TerminalConfig';

describe('TerminalService', () => {
  let terminalManager: TerminalSessionManager;
  let config: TerminalServiceConfig;

  beforeEach(() => {
    const configManager = new TerminalConfigManager();
    config = configManager.config;
    terminalManager = new TerminalSessionManager(config);
  });

  test('should create terminal session', async () => {
    const result = await terminalManager.createSession({
      cols: 80,
      rows: 24,
      cwd: '/tmp'
    });

    expect(result.sessionId).toBeDefined();
    expect(result.cwd).toBe('/tmp');
  });

  test('should execute safe commands', async () => {
    const mockSendToClient = jest.fn();
    
    await terminalManager.executeCommand(
      'echo "hello world"',
      { cwd: '/tmp' },
      mockSendToClient
    );

    expect(mockSendToClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        type: 'terminal',
        data: expect.objectContaining({
          op: 'exec',
          event: 'start'
        })
      })
    );
  });

  test('should block unsafe commands', async () => {
    const mockSendToClient = jest.fn();
    
    await terminalManager.executeCommand(
      'rm -rf /',
      { cwd: '/tmp' },
      mockSendToClient
    );

    expect(mockSendToClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        type: 'terminal',
        data: expect.objectContaining({
          op: 'exec',
          event: 'error'
        })
      })
    );
  });

  test('should reap idle sessions', async () => {
    // Create session with short timeout
    const sessionConfig = { ...config, idleTimeoutEphemeral: 100 };
    const manager = new TerminalSessionManager(sessionConfig);
    
    const { sessionId } = await manager.createSession({
      cols: 80,
      rows: 24,
      cwd: '/tmp',
      persistent: false
    });

    // Wait for timeout + reap interval
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(manager.getSession(sessionId)).toBeUndefined();
  });
});
```

#### 4.2 CLI Command Testing
```bash
# Test terminal configuration
npm run build:cli
node ./out/cli/index.js terminal config
node ./out/cli/index.js terminal config --json

# Test shell detection
node ./out/cli/index.js terminal shell

# Test session creation
node ./out/cli/index.js terminal session --cols 120 --rows 40 --persistent

# Test command execution
node ./out/cli/index.js terminal exec "echo 'Hello CLI'"
node ./out/cli/index.js terminal exec "ls -la"

# Test error handling
node ./out/cli/index.js terminal exec "rm -rf /"  # Should be blocked
```

## Success Criteria

### Minimum Viable Product
- [ ] CLI Terminal service completely independent of VS Code APIs
- [ ] Terminal session creation and management
- [ ] Safe command execution with allowlist
- [ ] WebSocket integration for web interface
- [ ] Basic pseudo-terminal functionality

### Enhanced Features
- [ ] Multiple terminal engines (line, pipe)
- [ ] Session persistence and idle timeout
- [ ] AI credential injection
- [ ] Output redaction for sensitive data
- [ ] Comprehensive configuration management
- [ ] Command safety validation
- [ ] Cross-platform shell detection

## Files to Create/Modify

### New Files
- `src/cli/services/TerminalService.ts` - Main CLI terminal service
- `src/cli/services/TerminalConfig.ts` - Configuration management
- `src/cli/services/TerminalSession.ts` - Session wrapper
- `src/cli/services/TerminalTypes.ts` - Type definitions
- `src/cli/services/TerminalSafety.ts` - Command safety validation
- `src/cli/commands/terminal.ts` - CLI terminal commands
- `tests/terminal-service.test.ts` - Test suite

### Modified Files
- `src/cli/server.ts` - Integrate new Terminal service
- `src/cli/index.ts` - Add terminal commands
- `package.json` - Add terminal-related dependencies

### Files to Remove
- `src/server/TerminalService.ts` - Replace with CLI version

## Timeline
- **Day 1**: Core CLI terminal service and configuration
- **Day 2**: Enhanced features (safety, session management)
- **Day 3**: CLI integration and WebSocket support
- **Day 4**: Testing, validation, and documentation
- **Day 5**: Cross-platform testing and polish

## Migration Strategy

1. **Parallel Development**: Keep original TerminalService during development
2. **Feature Parity**: Ensure all original functionality is preserved
3. **Safety First**: Implement command validation before enabling execution
4. **Incremental Testing**: Test each terminal operation independently
5. **Performance Validation**: Ensure CLI performance matches or exceeds VS Code version
6. **Security Focus**: Prioritize safe command execution and data redaction

This plan provides a comprehensive roadmap for migrating the Terminal service from VS Code extension dependencies to a fully functional, secure CLI implementation.
