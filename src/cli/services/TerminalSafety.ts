import { spawn, ChildProcess } from 'child_process';
import { TerminalConfigManager } from './TerminalConfig';
import { TerminalExecutionOptions, TerminalExecutionResult, TerminalSafetyValidation } from './TerminalTypes';

export class TerminalSafetyManager {
  constructor(private configManager: TerminalConfigManager) {}

  validateCommand(command: string): TerminalSafetyValidation {
    if (!command || typeof command !== 'string') {
      return { valid: false, reason: 'Command must be a non-empty string' };
    }

    // Check if command is allowed
    if (!this.configManager.isCommandAllowed(command)) {
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
      /^cp\s+.*\//,               // Copy to root (potentially dangerous)
      /^sudo\s+rm/,               // sudo rm commands
      /^sudo\s+dd/,               // sudo dd commands
      /^:\(\)\{\s*:\|:&\s*\};\s*:/ // Fork bomb
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
      'LD_PRELOAD',
      'DYLD_INSERT_LIBRARIES',
      'PYTHONPATH',
      'NODE_PATH',
      'PERL5LIB',
      'CLASSPATH'
    ];

    for (const varName of dangerousVars) {
      delete sanitized[varName];
    }

    return sanitized;
  }

  async executeCommandSafely(
    command: string, 
    options: TerminalExecutionOptions
  ): Promise<TerminalExecutionResult> {
    const validation = this.validateCommand(command);
    if (!validation.valid) {
      return { 
        success: false, 
        error: validation.reason || 'Command validation failed' 
      };
    }

    return new Promise((resolve) => {
      const cwd = options.cwd || this.configManager.config.defaultWorkingDirectory;
      const timeout = options.timeout || 30000;
      const env = this.sanitizeEnvironment(options.env || this.configManager.getEnhancedEnvironment());

      const child = spawn(command, {
        shell: true,
        cwd,
        timeout,
        env
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
          const result: TerminalExecutionResult = {
            success: true, 
            output: stdout
          };
          if (code !== null && code !== undefined) result.code = code;
          if (signal !== null && signal !== undefined) result.signal = signal;
          resolve(result);
        } else {
          const result: TerminalExecutionResult = { 
            success: false, 
            error: stderr || `Command exited with code ${code}`
          };
          if (code !== null && code !== undefined) result.code = code;
          if (signal !== null && signal !== undefined) result.signal = signal;
          resolve(result);
        }
      });

      child.on('error', (error) => {
        resolve({ 
          success: false, 
          error: error.message 
        });
      });

      child.on('timeout', () => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
        
        resolve({
          success: false,
          error: `Command timed out after ${timeout}ms`
        });
      });
    });
  }

  isSafePath(path: string): boolean {
    // Prevent path traversal attacks
    const normalized = path.replace(/\\/g, '/');
    
    // Block absolute paths that could be dangerous
    if (normalized.startsWith('/etc/') || 
        normalized.startsWith('/system/') ||
        normalized.startsWith('/Windows/') ||
        normalized.startsWith('/Program Files/')) {
      return false;
    }

    // Block relative paths that try to escape
    if (normalized.includes('../') || normalized.includes('..\\')) {
      return false;
    }

    return true;
  }

  getSafeWorkingDirectory(requestedCwd?: string): string {
    if (!requestedCwd) {
      return this.configManager.config.defaultWorkingDirectory;
    }

    if (!this.isSafePath(requestedCwd)) {
      this.configManager.log(`Requested working directory "${requestedCwd}" is not safe, using default`, 'warn');
      return this.configManager.config.defaultWorkingDirectory;
    }

    return this.configManager.getWorkingDirectory(requestedCwd);
  }
}
