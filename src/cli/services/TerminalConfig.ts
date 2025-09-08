import * as fs from 'fs';
import * as path from 'path';

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
  public config: TerminalServiceConfig;

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
    
    const firstWord = command.trim().split(/\s+/)[0]?.toLowerCase() || '';
    return this.config.commandAllowlist.includes(firstWord);
  }

  getShellForPlatform(): string {
    return this.config.defaultShell;
  }

  getWorkingDirectory(cwd?: string): string {
    if (!cwd) return this.config.defaultWorkingDirectory;
    
    if (path.isAbsolute(cwd)) {
      return cwd;
    }
    
    return path.join(this.config.workspaceRoot, cwd);
  }

  getEnhancedEnvironment(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    
    // Set terminal type
    if (!env.TERM) {
      env.TERM = 'xterm-256color';
    }
    
    return env;
  }

  getIdleTimeout(persistent: boolean): number {
    return persistent ? this.config.idleTimeoutPersistent : this.config.idleTimeoutEphemeral;
  }

  getEngineMode(requestedMode?: string): 'line' | 'pipe' {
    if (requestedMode === 'pipe') return 'pipe';
    if (requestedMode === 'line') return 'line';
    if (this.config.engineMode === 'pipe') return 'pipe';
    if (this.config.engineMode === 'line') return 'line';
    
    return 'line'; // Default fallback
  }

  log(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info'): void {
    if (!this.config.enableDebug && level === 'debug') return;
    
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    if (messageLevelIndex <= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      const prefix = level.toUpperCase().padEnd(5);
      console.log(`[${timestamp}] ${prefix}: ${message}`);
    }
  }
}
