import { Command } from 'commander';
import { TerminalConfigManager } from '../services/TerminalConfig';
import { TerminalService } from '../services/TerminalService';

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
    
    // Mock sendToClient function for CLI mode
    const sendToClient = (clientId: string, message: any) => {
      console.log('📨 Message to client:', JSON.stringify(message, null, 2));
      return true;
    };

    const terminalService = new TerminalService(sendToClient);
    
    try {
      const result = await terminalService.sessionManager.createSession({
        cols: parseInt(options.cols),
        rows: parseInt(options.rows),
        cwd: options.cwd,
        persistent: options.persistent,
        engineMode: options.engine
      });
      
      console.log('✅ Session created successfully:');
      console.log(`   Session ID: ${result.sessionId}`);
      console.log(`   Working Directory: ${result.cwd}`);
      
      // Show session stats
      const stats = terminalService.getStats();
      console.log(`   Total Sessions: ${stats.totalSessions}`);
      
    } catch (error) {
      console.error('❌ Failed to create session:', error);
    }
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
    
    const config = new TerminalConfigManager();
    
    // Mock sendToClient function for CLI mode
    const sendToClient = (clientId: string, message: any) => {
      if (message.type === 'terminal') {
        const data = message.data;
        if (data.op === 'exec') {
          switch (data.event) {
            case 'start':
              console.log('🚀 Command execution started');
              break;
            case 'data':
              const prefix = data.channel === 'stderr' ? '⚠️  ' : '📤 ';
              process.stdout.write(prefix + data.chunk);
              break;
            case 'exit':
              console.log(`\n✅ Command completed with code: ${data.code}`);
              break;
            case 'error':
              console.error(`❌ Command error: ${data.error}`);
              break;
          }
        }
      }
      return true;
    };

    const terminalService = new TerminalService(sendToClient);
    
    try {
      await terminalService.sessionManager.executeCommand(
        command,
        {
          cwd: options.cwd,
          timeout: parseInt(options.timeout)
        },
        sendToClient
      );
      
    } catch (error) {
      console.error('❌ Failed to execute command:', error);
    }
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

// List active sessions
terminalCommand
  .command('list')
  .description('List active terminal sessions')
  .action(async () => {
    const sendToClient = (clientId: string, message: any) => true;
    const terminalService = new TerminalService(sendToClient);
    
    const sessions = terminalService.sessionManager.listSessions();
    const stats = terminalService.getStats();
    
    console.log('📋 Terminal Sessions:');
    console.log(`   Total Sessions: ${stats.totalSessions}`);
    console.log(`   Active Sessions: ${stats.activeSessions}`);
    console.log(`   Idle Sessions: ${stats.idleSessions}`);
    console.log(`   Persistent Sessions: ${stats.persistentSessions}`);
    console.log(`   Ephemeral Sessions: ${stats.ephemeralSessions}`);
    console.log('');
    
    if (sessions.length > 0) {
      sessions.forEach((session, index) => {
        const uptime = Math.floor((Date.now() - session.createdAt) / 1000);
        const idleTime = Math.floor((Date.now() - session.lastActivity) / 1000);
        
        console.log(`${index + 1}. ${session.sessionId}`);
        console.log(`   Status: ${session.status}`);
        console.log(`   Engine: ${session.engineMode}`);
        console.log(`   Size: ${session.cols}x${session.rows}`);
        console.log(`   CWD: ${session.cwd}`);
        console.log(`   Persistent: ${session.persistent}`);
        console.log(`   Uptime: ${uptime}s`);
        console.log(`   Idle: ${idleTime}s`);
        if (session.availableProviders && session.availableProviders.length > 0) {
          console.log(`   AI Providers: ${session.availableProviders.join(', ')}`);
        }
        console.log('');
      });
    } else {
      console.log('   No active sessions');
    }
  });

// Test command safety
terminalCommand
  .command('test-safety')
  .description('Test command safety validation')
  .argument('<command>', 'Command to test')
  .action(async (command) => {
    const config = new TerminalConfigManager();
    const { TerminalSafetyManager } = await import('../services/TerminalSafety');
    const safetyManager = new TerminalSafetyManager(config);
    
    const validation = safetyManager.validateCommand(command);
    
    console.log('🔒 Command Safety Test:');
    console.log(`   Command: ${command}`);
    console.log(`   Valid: ${validation.valid}`);
    
    if (validation.reason) {
      console.log(`   Reason: ${validation.reason}`);
    }
    
    if (validation.valid) {
      console.log('✅ Command is safe to execute');
    } else {
      console.log('❌ Command is blocked for safety reasons');
      console.log('   Tip: Set KIRO_EXEC_ALLOW_UNSAFE=1 to override (not recommended)');
    }
  });

// Interactive terminal mode
terminalCommand
  .command('interactive')
  .description('Start an interactive terminal session')
  .option('--cols <number>', 'Terminal columns', '80')
  .option('--rows <number>', 'Terminal rows', '24')
  .option('--cwd <path>', 'Working directory')
  .option('--engine <mode>', 'Terminal engine (auto|line|pipe)', 'auto')
  .action(async (options) => {
    console.log('🖥️  Starting interactive terminal session...');
    console.log('   Type "exit" or press Ctrl+C to quit');
    console.log('');
    
    const config = new TerminalConfigManager();
    const { TerminalSafetyManager } = await import('../services/TerminalSafety');
    const safetyManager = new TerminalSafetyManager(config);
    
    // Create a simple interactive loop
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${options.cwd || process.cwd()}$ `
    });
    
    rl.prompt();
    
    rl.on('line', async (input: string) => {
      const command = input.trim();
      
      if (command === 'exit' || command === 'quit') {
        rl.close();
        return;
      }
      
      if (command) {
        const validation = safetyManager.validateCommand(command);
        
        if (!validation.valid) {
          console.log(`❌ ${validation.reason}`);
        } else {
          try {
            const result = await safetyManager.executeCommandSafely(command, {
              cwd: options.cwd,
              timeout: 30000,
              onOutput: (data: string, isStderr: boolean) => {
                if (isStderr) {
                  process.stderr.write(data);
                } else {
                  process.stdout.write(data);
                }
              }
            });
            
            if (!result.success && result.error) {
              console.error(`❌ ${result.error}`);
            }
          } catch (error) {
            console.error('❌ Execution error:', error);
          }
        }
      }
      
      rl.prompt();
    });
    
    rl.on('close', () => {
      console.log('\n👋 Interactive terminal session ended');
      process.exit(0);
    });
  });
