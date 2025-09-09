# CLI Integration and Final Migration Plan

## Goal
Provide comprehensive integration strategy for migrating all VS Code extension services to CLI, including unified architecture, WebSocket server integration, CLI command coordination, and final deployment strategy.

## Current State Analysis

### What We Have
- ✅ Individual migration plans for all services (Git, Terminal, File System, RemoteRC)
- ✅ Existing CLI structure with basic WebSocket server
- ✅ Service interfaces and type definitions
- ✅ Build system and package configuration

### What Needs to Change
- ❌ Unified CLI architecture with service coordination
- ❌ Enhanced WebSocket server with service routing
- ❌ CLI command system with unified interface
- ❌ Configuration management across all services
- ❌ Error handling and logging coordination
- ❌ Performance optimization and resource management
- ❌ Testing and deployment automation

## CLI Integration Plan

### Phase 1: Unified CLI Architecture (2 days)

#### 1.1 Create Unified CLI Service Manager
```bash
src/
├── cli/
│   ├── services/
│   │   ├── ServiceManager.ts      # Unified service coordinator
│   │   ├── CLIGitService.ts       # Git service (CLI version)
│   │   ├── CLITerminalService.ts  # Terminal service (CLI version)
│   │   ├── CLIFileSystemService.ts # File system service (CLI version)
│   │   ├── CLIRemoteRCService.ts  # RemoteRC service (CLI version)
│   │   ├── ConfigManager.ts       # Unified configuration
│   │   ├── Logger.ts             # Unified logging system
│   │   └── ErrorHandler.ts        # Unified error handling
│   ├── server/
│   │   ├── WebSocketServer.ts    # Enhanced WebSocket server
│   │   ├── ServiceRouter.ts      # Request routing to services
│   │   └── ClientManager.ts      # Client session management
│   ├── commands/
│   │   ├── index.ts              # CLI command coordinator
│   │   ├── git.ts                # Git commands
│   │   ├── terminal.ts           # Terminal commands
│   │   ├── filesystem.ts         # File system commands
│   │   ├── remoterc.ts           # RemoteRC commands
│   │   └── server.ts             # Server management commands
│   └── index.ts                  # Main CLI entry point
└── tests/
    ├── integration/
    │   ├── ServiceManager.test.ts
    │   ├── WebSocketServer.test.ts
    │   └── CLIIntegration.test.ts
    └── e2e/
        ├── cli-workflow.test.ts
        └── websocket-workflow.test.ts
```

#### 1.2 Unified Service Manager
Create `src/cli/services/ServiceManager.ts`:
```typescript
import { CLIGitService } from './CLIGitService';
import { CLITerminalService } from './CLITerminalService';
import { CLIFileSystemService } from './CLIFileSystemService';
import { CLIRemoteRCService } from './CLIRemoteRCService';
import { ConfigManager } from './ConfigManager';
import { Logger } from './Logger';
import { ErrorHandler } from './ErrorHandler';

export interface ServiceManagerConfig {
  workspaceRoot: string;
  enableAllServices: boolean;
  serviceTimeoutMs: number;
  maxConcurrentOperations: number;
}

export class ServiceManager {
  private config: ServiceManagerConfig;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  
  // Services
  private gitService?: CLIGitService;
  private terminalService?: CLITerminalService;
  private fileSystemService?: CLIFileSystemService;
  private remotercService?: CLIRemoteRCService;
  
  // Service status
  private serviceStatus: Map<string, {
    enabled: boolean;
    healthy: boolean;
    lastCheck: number;
    errorCount: number;
  }> = new Map();

  constructor(config: ServiceManagerConfig) {
    this.config = config;
    this.logger = new Logger(config);
    this.errorHandler = new ErrorHandler(this.logger);
    
    this.initializeServices();
    this.startHealthMonitoring();
  }

  private initializeServices(): void {
    // Initialize Git service
    if (this.config.enableAllServices) {
      try {
        this.gitService = new CLIGitService({
          workspaceRoot: this.config.workspaceRoot,
          timeoutMs: this.config.serviceTimeoutMs
        });
        this.serviceStatus.set('git', {
          enabled: true,
          healthy: true,
          lastCheck: Date.now(),
          errorCount: 0
        });
        this.logger.info('Git service initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Git service:', error);
        this.serviceStatus.set('git', {
          enabled: false,
          healthy: false,
          lastCheck: Date.now(),
          errorCount: 1
        });
      }
    }

    // Initialize Terminal service
    if (this.config.enableAllServices) {
      try {
        this.terminalService = new CLITerminalService({
          workspaceRoot: this.config.workspaceRoot,
          maxSessions: 50,
          idleTimeoutEphemeral: 15 * 60 * 1000,
          idleTimeoutPersistent: 30 * 60 * 1000
        });
        this.serviceStatus.set('terminal', {
          enabled: true,
          healthy: true,
          lastCheck: Date.now(),
          errorCount: 0
        });
        this.logger.info('Terminal service initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Terminal service:', error);
        this.serviceStatus.set('terminal', {
          enabled: false,
          healthy: false,
          lastCheck: Date.now(),
          errorCount: 1
        });
      }
    }

    // Initialize File System service
    if (this.config.enableAllServices) {
      try {
        this.fileSystemService = new CLIFileSystemService(
          (clientId, message) => this.handleServiceMessage('filesystem', clientId, message),
          {
            workspaceRoot: this.config.workspaceRoot,
            maxTextFileSize: 1024 * 1024,
            maxBinaryFileSize: 100 * 1024 * 1024
          }
        );
        this.serviceStatus.set('filesystem', {
          enabled: true,
          healthy: true,
          lastCheck: Date.now(),
          errorCount: 0
        });
        this.logger.info('File System service initialized');
      } catch (error) {
        this.logger.error('Failed to initialize File System service:', error);
        this.serviceStatus.set('filesystem', {
          enabled: false,
          healthy: false,
          lastCheck: Date.now(),
          errorCount: 1
        });
      }
    }

    // Initialize RemoteRC service
    if (this.config.enableAllServices) {
      try {
        this.remotercService = new CLIRemoteRCService({
          workspaceRoot: this.config.workspaceRoot,
          autoInitialize: true,
          maxHistoryDays: 30
        });
        this.serviceStatus.set('remoterc', {
          enabled: true,
          healthy: true,
          lastCheck: Date.now(),
          errorCount: 0
        });
        this.logger.info('RemoteRC service initialized');
      } catch (error) {
        this.logger.error('Failed to initialize RemoteRC service:', error);
        this.serviceStatus.set('remoterc', {
          enabled: false,
          healthy: false,
          lastCheck: Date.now(),
          errorCount: 1
        });
      }
    }
  }

  private startHealthMonitoring(): void {
    setInterval(() => {
      this.checkServiceHealth();
    }, 30000); // Check every 30 seconds
  }

  private async checkServiceHealth(): Promise<void> {
    const services = [
      { name: 'git', service: this.gitService, check: () => this.gitService?.getRepositoryState() },
      { name: 'terminal', service: this.terminalService, check: () => Promise.resolve(true) },
      { name: 'filesystem', service: this.fileSystemService, check: () => this.fileSystemService?.getTree('.') },
      { name: 'remoterc', service: this.remotercService, check: () => this.remotercService?.getPromptHistory() }
    ];

    for (const { name, service, check } of services) {
      if (!service || !this.serviceStatus.get(name)?.enabled) continue;

      try {
        await check();
        const status = this.serviceStatus.get(name)!;
        status.healthy = true;
        status.lastCheck = Date.now();
        status.errorCount = 0;
      } catch (error) {
        const status = this.serviceStatus.get(name)!;
        status.healthy = false;
        status.lastCheck = Date.now();
        status.errorCount++;
        
        this.logger.warn(`Service ${name} health check failed:`, error);
        
        // Attempt to restart service if error count is high
        if (status.errorCount >= 3) {
          this.logger.info(`Attempting to restart service ${name}`);
          await this.restartService(name);
        }
      }
    }
  }

  private async restartService(serviceName: string): Promise<void> {
    this.logger.info(`Restarting service: ${serviceName}`);
    
    // Disable service temporarily
    const status = this.serviceStatus.get(serviceName);
    if (status) {
      status.enabled = false;
    }

    // Re-initialize service
    try {
      switch (serviceName) {
        case 'git':
          this.gitService = new CLIGitService({
            workspaceRoot: this.config.workspaceRoot,
            timeoutMs: this.config.serviceTimeoutMs
          });
          break;
        case 'terminal':
          this.terminalService = new CLITerminalService({
            workspaceRoot: this.config.workspaceRoot,
            maxSessions: 50,
            idleTimeoutEphemeral: 15 * 60 * 1000,
            idleTimeoutPersistent: 30 * 60 * 1000
          });
          break;
        case 'filesystem':
          this.fileSystemService = new CLIFileSystemService(
            (clientId, message) => this.handleServiceMessage('filesystem', clientId, message),
            {
              workspaceRoot: this.config.workspaceRoot,
              maxTextFileSize: 1024 * 1024,
              maxBinaryFileSize: 100 * 1024 * 1024
            }
          );
          break;
        case 'remoterc':
          this.remotercService = new CLIRemoteRCService({
            workspaceRoot: this.config.workspaceRoot,
            autoInitialize: true,
            maxHistoryDays: 30
          });
          break;
      }

      if (status) {
        status.enabled = true;
        status.healthy = true;
        status.errorCount = 0;
        status.lastCheck = Date.now();
      }

      this.logger.info(`Service ${serviceName} restarted successfully`);
    } catch (error) {
      this.logger.error(`Failed to restart service ${serviceName}:`, error);
      
      if (status) {
        status.enabled = false;
        status.healthy = false;
      }
    }
  }

  // Service accessors
  getGitService(): CLIGitService | undefined {
    return this.gitService;
  }

  getTerminalService(): CLITerminalService | undefined {
    return this.terminalService;
  }

  getFileSystemService(): CLIFileSystemService | undefined {
    return this.fileSystemService;
  }

  getRemoteRCService(): CLIRemoteRCService | undefined {
    return this.remotercService;
  }

  // Service status
  getServiceStatus(serviceName?: string): any {
    if (serviceName) {
      return this.serviceStatus.get(serviceName);
    }
    
    return Object.fromEntries(this.serviceStatus);
  }

  // Message handling
  private handleServiceMessage(serviceName: string, clientId: string, message: any): void {
    // Forward service messages to WebSocket clients
    // This will be implemented in the WebSocket server
  }

  // Cleanup
  async dispose(): Promise<void> {
    this.logger.info('Disposing ServiceManager');
    
    // Dispose all services
    if (this.gitService) {
      await this.gitService.dispose();
    }
    
    if (this.terminalService) {
      await this.terminalService.dispose();
    }
    
    if (this.fileSystemService) {
      await this.fileSystemService.dispose();
    }
    
    if (this.remotercService) {
      await this.remotercService.dispose();
    }
    
    this.serviceStatus.clear();
    this.logger.info('ServiceManager disposed');
  }
}
```

#### 1.3 Enhanced WebSocket Server
Create `src/cli/server/WebSocketServer.ts`:
```typescript
import { WebSocketServer as WS } from 'ws';
import { ServiceManager } from '../services/ServiceManager';
import { ClientManager } from './ClientManager';
import { ServiceRouter } from './ServiceRouter';
import { Logger } from '../services/Logger';

export interface WebSocketServerConfig {
  port: number;
  host: string;
  enableCors: boolean;
  maxClients: number;
  heartbeatInterval: number;
  messageTimeout: number;
}

export class WebSocketServer {
  private server: WS;
  private serviceManager: ServiceManager;
  private clientManager: ClientManager;
  private serviceRouter: ServiceRouter;
  private logger: Logger;
  private config: WebSocketServerConfig;

  constructor(config: WebSocketServerConfig, serviceManager: ServiceManager) {
    this.config = config;
    this.serviceManager = serviceManager;
    this.logger = new Logger({ enableDebug: true, logLevel: 'info' });
    this.clientManager = new ClientManager(this.config.maxClients);
    this.serviceRouter = new ServiceRouter(serviceManager);
    
    this.server = new WS({ 
      server: undefined, // Will be attached to HTTP server
      path: '/ws'
    });
    
    this.initializeServer();
  }

  private initializeServer(): void {
    this.server.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.server.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
    });

    // Start heartbeat
    this.startHeartbeat();
    
    this.logger.info(`WebSocket server initialized on port ${this.config.port}`);
  }

  private handleConnection(ws: WS, req: any): void {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress || 'unknown';
    
    this.logger.info(`Client connected: ${clientId} from ${clientIp}`);
    
    // Register client
    this.clientManager.addClient(clientId, ws, clientIp);
    
    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection',
      data: {
        clientId,
        status: 'connected',
        timestamp: Date.now(),
        services: this.serviceManager.getServiceStatus()
      }
    });

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      this.logger.error(`Client error ${clientId}:`, error);
      this.handleDisconnection(clientId);
    });

    // Set up ping/pong for connection health
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  private async handleMessage(clientId: string, data: any): Promise<void> {
    try {
      const message = JSON.parse(data.toString());
      
      this.logger.debug(`Received message from ${clientId}:`, message.type);
      
      // Route message to appropriate service
      const response = await this.serviceRouter.route(clientId, message);
      
      // Send response if needed
      if (response) {
        this.sendToClient(clientId, response);
      }
    } catch (error) {
      this.logger.error(`Failed to handle message from ${clientId}:`, error);
      
      this.sendToClient(clientId, {
        type: 'error',
        data: {
          message: 'Failed to process message',
          error: error.message,
          timestamp: Date.now()
        }
      });
    }
  }

  private handleDisconnection(clientId: string): void {
    this.logger.info(`Client disconnected: ${clientId}`);
    
    // Clean up client resources
    this.clientManager.removeClient(clientId);
    
    // Notify services about client disconnection
    this.serviceRouter.handleClientDisconnect(clientId);
  }

  private sendToClient(clientId: string, message: any): boolean {
    const client = this.clientManager.getClient(clientId);
    if (!client || !client.ws) {
      this.logger.warn(`Attempted to send message to non-existent client: ${clientId}`);
      return false;
    }

    try {
      if (client.ws.readyState === WS.OPEN) {
        client.ws.send(JSON.stringify(message));
        return true;
      } else {
        this.logger.warn(`Client ${clientId} connection not ready (state: ${client.ws.readyState})`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to send message to client ${clientId}:`, error);
      return false;
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.server.clients.forEach((ws) => {
        const client = this.clientManager.getClientByWebSocket(ws);
        if (client) {
          if ((ws as any).isAlive === false) {
            this.logger.info(`Terminating inactive client: ${client.id}`);
            return ws.terminate();
          }
          
          (ws as any).isAlive = false;
          ws.ping();
        }
      });
    }, this.config.heartbeatInterval);
  }

  // Server management
  start(): void {
    this.logger.info(`Starting WebSocket server on ${this.config.host}:${this.config.port}`);
    // The actual HTTP server start will be handled by the main CLI
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping WebSocket server');
    
    // Close all client connections
    this.clientManager.removeAllClients();
    
    // Close WebSocket server
    this.server.close();
    
    this.logger.info('WebSocket server stopped');
  }

  // Public methods for external access
  broadcast(message: any, excludeClientId?: string): void {
    const clients = this.clientManager.getAllClients();
    
    for (const client of clients) {
      if (client.id !== excludeClientId) {
        this.sendToClient(client.id, message);
      }
    }
  }

  getServerStats(): {
    connectedClients: number;
    totalConnections: number;
    uptime: number;
    serviceStatus: any;
  } {
    return {
      connectedClients: this.clientManager.getClientCount(),
      totalConnections: this.clientManager.getTotalConnections(),
      uptime: process.uptime(),
      serviceStatus: this.serviceManager.getServiceStatus()
    };
  }
}
```

### Phase 2: Enhanced CLI Command System (1 day)

#### 2.1 Unified CLI Command Interface
Create `src/cli/commands/index.ts`:
```typescript
import { Command } from 'commander';
import { gitCommand } from './git';
import { terminalCommand } from './terminal';
import { filesystemCommand } from './filesystem';
import { remotercCommand } from './remoterc';
import { serverCommand } from './server';

export interface CLIConfig {
  workspaceRoot: string;
  configFile?: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableColors: boolean;
  outputFormat: 'text' | 'json';
}

export class CLICommandManager {
  private program: Command;
  private config: CLIConfig;

  constructor(config: CLIConfig) {
    this.config = config;
    this.program = new Command();
    this.initializeCommands();
  }

  private initializeCommands(): void {
    this.program
      .name('kiro-cli')
      .description('Kiro AI Assistant CLI')
      .version('1.0.0')
      .option('--workspace <path>', 'Workspace root path', this.config.workspaceRoot)
      .option('--config <path>', 'Configuration file path')
      .option('--log-level <level>', 'Log level (error|warn|info|debug)', this.config.logLevel)
      .option('--no-colors', 'Disable colored output')
      .option('--output <format>', 'Output format (text|json)', this.config.outputFormat)
      .hook('preAction', (thisCommand, actionCommand) => {
        // Update config based on command options
        this.updateConfig(actionCommand);
      });

    // Add service commands
    this.program.addCommand(gitCommand);
    this.program.addCommand(terminalCommand);
    this.program.addCommand(filesystemCommand);
    this.program.addCommand(remotercCommand);
    this.program.addCommand(serverCommand);

    // Add global utility commands
    this.program
      .command('status')
      .description('Show overall system status')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        await this.showSystemStatus(options.json);
      });

    this.program
      .command('config')
      .description('Manage CLI configuration')
      .option('--show', 'Show current configuration')
      .option('--set <key=value>', 'Set configuration value')
      .option('--reset', 'Reset to defaults')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        await this.manageConfiguration(options);
      });
  }

  private updateConfig(command: Command): void {
    const opts = command.opts();
    
    this.config = {
      ...this.config,
      workspaceRoot: opts.workspace || this.config.workspaceRoot,
      logLevel: opts.logLevel || this.config.logLevel,
      enableColors: opts.colors !== false,
      outputFormat: opts.output || this.config.outputFormat
    };
  }

  private async showSystemStatus(jsonOutput: boolean): Promise<void> {
    try {
      // Import here to avoid circular dependencies
      const { ServiceManager } = await import('../services/ServiceManager');
      const { WebSocketServer } = await import('../server/WebSocketServer');
      
      const serviceManager = new ServiceManager({
        workspaceRoot: this.config.workspaceRoot,
        enableAllServices: true,
        serviceTimeoutMs: 30000,
        maxConcurrentOperations: 10
      });

      const status = {
        workspace: this.config.workspaceRoot,
        services: serviceManager.getServiceStatus(),
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };

      if (jsonOutput) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log('🚀 Kiro CLI System Status');
        console.log(`   Workspace: ${status.workspace}`);
        console.log(`   Uptime: ${Math.floor(status.uptime / 60)} minutes`);
        console.log(`   Timestamp: ${new Date(status.timestamp).toLocaleString()}`);
        console.log('\n📊 Services:');
        
        for (const [serviceName, serviceStatus] of Object.entries(status.services)) {
          const statusIcon = serviceStatus.healthy ? '✅' : '❌';
          const enabledIcon = serviceStatus.enabled ? '🟢' : '🔴';
          console.log(`   ${enabledIcon} ${serviceName}: ${statusIcon} ${serviceStatus.healthy ? 'Healthy' : 'Unhealthy'}`);
          if (!serviceStatus.healthy) {
            console.log(`      Error count: ${serviceStatus.errorCount}`);
            console.log(`      Last check: ${new Date(serviceStatus.lastCheck).toLocaleString()}`);
          }
        }
      }

      await serviceManager.dispose();
    } catch (error) {
      console.error('❌ Failed to get system status:', error.message);
      process.exit(1);
    }
  }

  private async manageConfiguration(options: any): Promise<void> {
    try {
      if (options.show) {
        if (options.json) {
          console.log(JSON.stringify(this.config, null, 2));
        } else {
          console.log('⚙️  CLI Configuration:');
          Object.entries(this.config).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
          });
        }
      } else if (options.set) {
        const [key, value] = options.set.split('=');
        console.log(`⚙️  Setting ${key} = ${value}`);
        // Configuration persistence logic would go here
      } else if (options.reset) {
        console.log('🔄 Resetting configuration to defaults...');
        // Configuration reset logic would go here
      }
    } catch (error) {
      console.error('❌ Failed to manage configuration:', error.message);
      process.exit(1);
    }
  }

  public async run(argv: string[] = process.argv): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      console.error('❌ CLI execution failed:', error.message);
      process.exit(1);
    }
  }

  public getProgram(): Command {
    return this.program;
  }
}
```

#### 2.2 Server Management Commands
Create `src/cli/commands/server.ts`:
```typescript
import { Command } from 'commander';
import { WebSocketServer } from '../server/WebSocketServer';
import { ServiceManager } from '../services/ServiceManager';
import { Logger } from '../services/Logger';

export const serverCommand = new Command('server')
  .description('WebSocket server management')
  .option('--port <number>', 'Server port', '8080')
  .option('--host <host>', 'Server host', 'localhost')
  .option('--workspace <path>', 'Workspace path')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const server = new CLIServerManager(options);
    await server.start();
  });

class CLIServerManager {
  private server?: WebSocketServer;
  private serviceManager?: ServiceManager;
  private logger: Logger;
  private options: any;

  constructor(options: any) {
    this.options = options;
    this.logger = new Logger({
      enableDebug: options.debug,
      logLevel: options.debug ? 'debug' : 'info'
    });
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting Kiro CLI WebSocket Server...');
      
      // Initialize service manager
      this.serviceManager = new ServiceManager({
        workspaceRoot: this.options.workspace || process.cwd(),
        enableAllServices: true,
        serviceTimeoutMs: 30000,
        maxConcurrentOperations: 10
      });

      // Initialize WebSocket server
      this.server = new WebSocketServer({
        port: parseInt(this.options.port),
        host: this.options.host,
        enableCors: true,
        maxClients: 100,
        heartbeatInterval: 30000,
        messageTimeout: 10000
      }, this.serviceManager);

      // Start server
      this.server.start();

      console.log(`✅ Server started successfully`);
      console.log(`   🌐 URL: ws://${this.options.host}:${this.options.port}`);
      console.log(`   📁 Workspace: ${this.serviceManager.getServiceStatus() ? 'Loaded' : 'Not found'}`);
      console.log(`   🔧 Debug: ${this.options.debug ? 'Enabled' : 'Disabled'}`);
      
      // Set up graceful shutdown
      this.setupGracefulShutdown();

      // Keep server running
      await this.keepAlive();

    } catch (error) {
      this.logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async keepAlive(): Promise<void> {
    return new Promise((resolve) => {
      // Keep the process alive
      process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        resolve();
      });

      process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        resolve();
      });
    });
  }

  private async setupGracefulShutdown(): Promise<void> {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      try {
        if (this.server) {
          await this.server.stop();
        }
        
        if (this.serviceManager) {
          await this.serviceManager.dispose();
        }
        
        console.log('✅ Server shut down successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}
```

### Phase 3: Configuration and Error Handling (1 day)

#### 3.1 Unified Configuration Manager
Create `src/cli/services/ConfigManager.ts`:
```typescript
import * as path from 'path';
import * as fs from 'fs/promises';

export interface UnifiedConfig {
  // Global settings
  workspaceRoot: string;
  configFile?: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableColors: boolean;
  outputFormat: 'text' | 'json';
  
  // Service-specific settings
  services: {
    git: {
      enabled: boolean;
      defaultBranch: string;
      timeoutMs: number;
      maxBufferSize: number;
    };
    terminal: {
      enabled: boolean;
      defaultShell: string;
      maxSessions: number;
      idleTimeoutEphemeral: number;
      idleTimeoutPersistent: number;
      commandAllowlist: string[];
      allowUnsafeCommands: boolean;
    };
    filesystem: {
      enabled: boolean;
      maxTextFileSize: number;
      maxBinaryFileSize: number;
      maxTreeDepth: number;
      maxFilesPerDirectory: number;
      enableFileWatching: boolean;
      maxWatchersPerClient: number;
    };
    remoterc: {
      enabled: boolean;
      autoInitialize: boolean;
      defaultCategory: string;
      maxHistoryDays: number;
      maxPromptLength: number;
      enableTemplates: boolean;
    };
  };
  
  // Server settings
  server: {
    port: number;
    host: string;
    enableCors: boolean;
    maxClients: number;
    heartbeatInterval: number;
    messageTimeout: number;
  };
  
  // Performance settings
  performance: {
    enableCaching: boolean;
    cacheTimeoutMs: number;
    maxConcurrentOperations: number;
    enableParallelProcessing: boolean;
  };
}

export class ConfigManager {
  private config: UnifiedConfig;
  private configPath?: string;

  constructor(configPath?: string, envVars: NodeJS.ProcessEnv = process.env) {
    this.configPath = configPath;
    this.config = this.loadConfig(configPath, envVars);
  }

  private loadConfig(configPath?: string, envVars: NodeJS.ProcessEnv = process.env): UnifiedConfig {
    const defaultConfig: UnifiedConfig = {
      workspaceRoot: envVars.PWD || process.cwd(),
      configFile: configPath,
      logLevel: (envVars.KIRO_LOG_LEVEL as any) || 'info',
      enableColors: envVars.KIRO_NO_COLORS !== '1',
      outputFormat: (envVars.KIRO_OUTPUT_FORMAT as any) || 'text',
      
      services: {
        git: {
          enabled: envVars.KIRO_GIT_ENABLED !== '0',
          defaultBranch: 'main',
          timeoutMs: parseInt(envVars.KIRO_GIT_TIMEOUT || '30000'),
          maxBufferSize: parseInt(envVars.KIRO_GIT_MAX_BUFFER || '10485760')
        },
        terminal: {
          enabled: envVars.KIRO_TERMINAL_ENABLED !== '0',
          defaultShell: this.getDefaultShell(),
          maxSessions: parseInt(envVars.KIRO_TERMINAL_MAX_SESSIONS || '50'),
          idleTimeoutEphemeral: parseInt(envVars.KIRO_TERMINAL_IDLE_EPHEMERAL || '900000'),
          idleTimeoutPersistent: parseInt(envVars.KIRO_TERMINAL_IDLE_PERSISTENT || '1800000'),
          commandAllowlist: [
            'ls', 'dir', 'echo', 'git', 'npm', 'pnpm', 'yarn', 'node', 'python', 
            'pip', 'go', 'dotnet', 'cargo', 'bash', 'powershell', 'pwsh', 'cmd',
            'cat', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'grep', 'find'
          ],
          allowUnsafeCommands: envVars.KIRO_EXEC_ALLOW_UNSAFE === '1'
        },
        filesystem: {
          enabled: envVars.KIRO_FS_ENABLED !== '0',
          maxTextFileSize: parseInt(envVars.KIRO_FS_MAX_TEXT_SIZE || '1048576'),
          maxBinaryFileSize: parseInt(envVars.KIRO_FS_MAX_BINARY_SIZE || '104857600'),
          maxTreeDepth: parseInt(envVars.KIRO_FS_MAX_TREE_DEPTH || '10'),
          maxFilesPerDirectory: parseInt(envVars.KIRO_FS_MAX_FILES_PER_DIR || '1000'),
          enableFileWatching: envVars.KIRO_FS_WATCHING_ENABLED !== '0',
          maxWatchersPerClient: parseInt(envVars.KIRO_FS_MAX_WATCHERS || '50')
        },
        remoterc: {
          enabled: envVars.KIRO_REMOTERC_ENABLED !== '0',
          autoInitialize: envVars.KIRO_REMOTERC_AUTO_INIT !== '0',
          defaultCategory: 'general',
          maxHistoryDays: parseInt(envVars.KIRO_REMOTERC_MAX_HISTORY || '30'),
          maxPromptLength: parseInt(envVars.KIRO_REMOTERC_MAX_PROMPT_LENGTH || '50000'),
          enableTemplates: envVars.KIRO_REMOTERC_TEMPLATES_ENABLED !== '0'
        }
      },
      
      server: {
        port: parseInt(envVars.KIRO_SERVER_PORT || '8080'),
        host: envVars.KIRO_SERVER_HOST || 'localhost',
        enableCors: envVars.KIRO_SERVER_CORS_ENABLED !== '0',
        maxClients: parseInt(envVars.KIRO_SERVER_MAX_CLIENTS || '100'),
        heartbeatInterval: parseInt(envVars.KIRO_SERVER_HEARTBEAT || '30000'),
        messageTimeout: parseInt(envVars.KIRO_SERVER_MESSAGE_TIMEOUT || '10000')
      },
      
      performance: {
        enableCaching: envVars.KIRO_CACHING_ENABLED !== '0',
        cacheTimeoutMs: parseInt(envVars.KIRO_CACHE_TIMEOUT || '300000'),
        maxConcurrentOperations: parseInt(envVars.KIRO_MAX_CONCURRENT_OPS || '10'),
        enableParallelProcessing: envVars.KIRO_PARALLEL_PROCESSING_ENABLED !== '0'
      }
    };

    // Load from config file if provided
    if (configPath) {
      try {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(configData);
        return this.mergeConfig(defaultConfig, userConfig);
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}:`, error);
      }
    }

    return defaultConfig;
  }

  private mergeConfig(defaultConfig: UnifiedConfig, userConfig: any): UnifiedConfig {
    return {
      ...defaultConfig,
      ...userConfig,
      services: {
        ...defaultConfig.services,
        ...userConfig.services,
        git: { ...defaultConfig.services.git, ...userConfig.services?.git },
        terminal: { ...defaultConfig.services.terminal, ...userConfig.services?.terminal },
        filesystem: { ...defaultConfig.services.filesystem, ...userConfig.services?.filesystem },
        remoterc: { ...defaultConfig.services.remoterc, ...userConfig.services?.remoterc }
      },
      server: { ...defaultConfig.server, ...userConfig.server },
      performance: { ...defaultConfig.performance, ...userConfig.performance }
    };
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

  getConfig(): UnifiedConfig {
    return this.config;
  }

  async updateConfig(updates: Partial<UnifiedConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    
    if (this.configPath) {
      try {
        await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        console.log(`✅ Configuration saved to ${this.configPath}`);
      } catch (error) {
        console.error(`Failed to save configuration to ${this.configPath}:`, error);
      }
    }
  }

  async resetToDefaults(): Promise<void> {
    this.config = this.loadConfig(undefined, process.env);
    
    if (this.configPath) {
      try {
        await fs.unlink(this.configPath);
        console.log(`✅ Configuration file ${this.configPath} removed`);
      } catch (error) {
        // File might not exist, which is fine
      }
    }
  }

  getServiceConfig(serviceName: keyof UnifiedConfig['services']): any {
    return this.config.services[serviceName];
  }

  isServiceEnabled(serviceName: keyof UnifiedConfig['services']): boolean {
    return this.config.services[serviceName].enabled;
  }
}
```

#### 3.2 Unified Error Handler
Create `src/cli/services/ErrorHandler.ts`:
```typescript
import { Logger } from './Logger';

export interface ErrorContext {
  service?: string;
  operation?: string;
  clientId?: string;
  requestId?: string;
  userId?: string;
  additional?: Record<string, any>;
}

export interface ErrorReport {
  timestamp: Date;
  error: Error;
  context: ErrorContext;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
}

export class ErrorHandler {
  private logger: Logger;
  private errorReports: ErrorReport[] = [];
  private errorCallbacks: Set<(report: ErrorReport) => void> = new Set();

  constructor(logger: Logger) {
    this.logger = logger;
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleError(error, {
        severity: 'critical',
        handled: false,
        context: { service: 'process', operation: 'uncaughtException' }
      });
      
      // Give some time for error reporting before exiting
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      
      this.handleError(error, {
        severity: 'high',
        handled: false,
        context: { 
          service: 'process', 
          operation: 'unhandledRejection',
          additional: { promise: promise.toString() }
        }
      });
    });
  }

  handleError(
    error: Error | string,
    options: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      handled?: boolean;
      context?: ErrorContext;
      rethrow?: boolean;
    } = {}
  ): ErrorReport {
    const {
      severity = 'medium',
      handled = true,
      context = {},
      rethrow = false
    } = options;

    const errorObj = error instanceof Error ? error : new Error(error);
    const report: ErrorReport = {
      timestamp: new Date(),
      error: errorObj,
      context,
      stack: errorObj.stack,
      severity,
      handled
    };

    // Store error report
    this.errorReports.push(report);
    
    // Keep only last 1000 error reports
    if (this.errorReports.length > 1000) {
      this.errorReports = this.errorReports.slice(-800);
    }

    // Log error
    this.logError(report);

    // Notify callbacks
    this.notifyCallbacks(report);

    // Rethrow if requested
    if (rethrow) {
      throw errorObj;
    }

    return report;
  }

  private logError(report: ErrorReport): void {
    const { timestamp, error, context, severity, handled } = report;
    
    const logMessage = [
      `[${severity.toUpperCase()}]`,
      context.service ? `[${context.service}]` : '',
      context.operation ? `[${context.operation}]` : '',
      error.message
    ].filter(Boolean).join(' ');

    const logData = {
      timestamp: timestamp.toISOString(),
      error: error.message,
      stack: error.stack,
      context,
      handled
    };

    switch (severity) {
      case 'critical':
        this.logger.error(logMessage, logData);
        break;
      case 'high':
        this.logger.error(logMessage, logData);
        break;
      case 'medium':
        this.logger.warn(logMessage, logData);
        break;
      case 'low':
        this.logger.info(logMessage, logData);
        break;
    }
  }

  private notifyCallbacks(report: ErrorReport): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(report);
      } catch (error) {
        this.logger.error('Error in error callback:', error);
      }
    });
  }

  onError(callback: (report: ErrorReport) => void): () => void {
    this.errorCallbacks.add(callback);
    
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  getErrorReports(options?: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    service?: string;
    since?: Date;
    limit?: number;
  }): ErrorReport[] {
    let reports = [...this.errorReports];

    if (options) {
      if (options.severity) {
        reports = reports.filter(r => r.severity === options.severity);
      }
      
      if (options.service) {
        reports = reports.filter(r => r.context.service === options.service);
      }
      
      if (options.since) {
        reports = reports.filter(r => r.timestamp >= options.since!);
      }
      
      if (options.limit) {
        reports = reports.slice(-options.limit);
      }
    }

    return reports.reverse(); // Most recent first
  }

  getErrorStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byService: Record<string, number>;
    recent: number; // Last 24 hours
  } {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      total: this.errorReports.length,
      bySeverity: {} as Record<string, number>,
      byService: {} as Record<string, number>,
      recent: 0
    };

    for (const report of this.errorReports) {
      // Count by severity
      stats.bySeverity[report.severity] = (stats.bySeverity[report.severity] || 0) + 1;
      
      // Count by service
      if (report.context.service) {
        stats.byService[report.context.service] = (stats.byService[report.context.service] || 0) + 1;
      }
      
      // Count recent errors
      if (report.timestamp >= yesterday) {
        stats.recent++;
      }
    }

    return stats;
  }

  clearErrorReports(): void {
    this.errorReports = [];
  }
}
```

### Phase 4: Testing and Deployment (1 day)

#### 4.1 Integration Tests
Create `tests/integration/CLIIntegration.test.ts`:
```typescript
import { CLICommandManager } from '../../src/cli/commands';
import { ServiceManager } from '../../src/cli/services/ServiceManager';
import { WebSocketServer } from '../../src/cli/server/WebSocketServer';
import { ConfigManager } from '../../src/cli/services/ConfigManager';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CLI Integration', () => {
  let testWorkspace: string;
  let configManager: ConfigManager;
  let serviceManager: ServiceManager;
  let webSocketServer: WebSocketServer;

  beforeEach(async () => {
    testWorkspace = await createTestWorkspace();
    configManager = new ConfigManager(undefined, {
      PWD: testWorkspace,
      KIRO_GIT_ENABLED: '1',
      KIRO_TERMINAL_ENABLED: '1',
      KIRO_FS_ENABLED: '1',
      KIRO_REMOTERC_ENABLED: '1'
    });

    serviceManager = new ServiceManager({
      workspaceRoot: testWorkspace,
      enableAllServices: true,
      serviceTimeoutMs: 5000,
      maxConcurrentOperations: 5
    });

    webSocketServer = new WebSocketServer({
      port: 0, // Use random available port
      host: 'localhost',
      enableCors: true,
      maxClients: 10,
      heartbeatInterval: 5000,
      messageTimeout: 5000
    }, serviceManager);
  });

  afterEach(async () => {
    await webSocketServer.stop();
    await serviceManager.dispose();
    await cleanupTestWorkspace(testWorkspace);
  });

  test('should initialize all services successfully', () => {
    const status = serviceManager.getServiceStatus();
    
    expect(status.git.enabled).toBe(true);
    expect(status.git.healthy).toBe(true);
    expect(status.terminal.enabled).toBe(true);
    expect(status.terminal.healthy).toBe(true);
    expect(status.filesystem.enabled).toBe(true);
    expect(status.filesystem.healthy).toBe(true);
    expect(status.remoterc.enabled).toBe(true);
    expect(status.remoterc.healthy).toBe(true);
  });

  test('should handle CLI commands', async () => {
    const cliManager = new CLICommandManager({
      workspaceRoot: testWorkspace,
      logLevel: 'info',
      enableColors: false,
      outputFormat: 'text'
    });

    // Test status command
    const statusOutput = await captureCommandOutput(async () => {
      await cliManager.run(['node', 'test', 'status', '--json']);
    });

    const statusData = JSON.parse(statusOutput);
    expect(statusData.services).toBeDefined();
    expect(statusData.workspace).toBe(testWorkspace);
  });

  test('should handle WebSocket connections', async () => {
    return new Promise((resolve, reject) => {
      const server = webSocketServer['server']; // Access private server for testing
      
      server.on('listening', () => {
        const address = server.address();
        const port = (address as any).port;
        
        // Create test client
        const ws = new WebSocket(`ws://localhost:${port}`);
        
        ws.on('open', () => {
          // Send test message
          ws.send(JSON.stringify({
            type: 'test',
            data: { message: 'Hello CLI' }
          }));
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'connection') {
              expect(message.data.status).toBe('connected');
              expect(message.data.services).toBeDefined();
              
              ws.close();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', reject);
      });

      server.on('error', reject);
    });
  });

  test('should coordinate between services', async () => {
    // Create a test file
    const testFile = path.join(testWorkspace, 'test.txt');
    await fs.writeFile(testFile, 'test content');

    // Test file system service
    const fileSystemService = serviceManager.getFileSystemService();
    if (fileSystemService) {
      const tree = await fileSystemService.getTree('.');
      expect(tree.children).toBeDefined();
      
      const fileNode = tree.children.find(child => child.name === 'test.txt');
      expect(fileNode).toBeDefined();
    }

    // Test RemoteRC service
    const remotercService = serviceManager.getRemoteRCService();
    if (remotercService) {
      const prompt = await remotercService.savePrompt(
        'Test prompt content',
        'test',
        ['cli', 'integration']
      );
      
      expect(prompt.id).toBeDefined();
      expect(prompt.content).toBe('Test prompt content');
      
      const prompts = await remotercService.getPromptHistory();
      expect(prompts.some(p => p.id === prompt.id)).toBe(true);
    }
  });

  test('should handle errors gracefully', async () => {
    const cliManager = new CLICommandManager({
      workspaceRoot: testWorkspace,
      logLevel: 'info',
      enableColors: false,
      outputFormat: 'text'
    });

    // Test command with invalid workspace
    const output = await captureCommandOutput(async () => {
      try {
        await cliManager.run(['node', 'test', '--workspace', '/nonexistent/path', 'status']);
      } catch (error) {
        // Command should handle error gracefully
        return error.message;
      }
    });

    expect(output).toContain('error');
  });

  test('should manage configuration', async () => {
    const newConfig = {
      services: {
        git: {
          enabled: false
        }
      }
    };

    await configManager.updateConfig(newConfig);
    
    const updatedConfig = configManager.getConfig();
    expect(updatedConfig.services.git.enabled).toBe(false);
    
    // Reset configuration
    await configManager.resetToDefaults();
    
    const resetConfig = configManager.getConfig();
    expect(resetConfig.services.git.enabled).toBe(true);
  });
});

// Helper functions
async function createTestWorkspace(): Promise<string> {
  const workspace = path.join(__dirname, '../temp/test-workspace');
  await fs.mkdir(workspace, { recursive: true });
  
  // Initialize git repository
  const { exec } = require('child_process');
  await new Promise((resolve, reject) => {
    exec('git init', { cwd: workspace }, (error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
  
  return workspace;
}

async function cleanupTestWorkspace(workspace: string): Promise<void> {
  await fs.rm(workspace, { recursive: true, force: true });
}

async function captureCommandOutput(fn: () => Promise<void>): Promise<string> {
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  
  let output = '';
  
  process.stdout.write = (str: string) => {
    output += str;
    return true;
  };
  
  process.stderr.write = (str: string) => {
    output += str;
    return true;
  };
  
  try {
    await fn();
    return output;
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
}
```

#### 4.2 End-to-End Tests
Create `tests/e2e/cli-workflow.test.ts`:
```typescript
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('CLI End-to-End Workflow', () => {
  let testWorkspace: string;
  let cliProcess: ChildProcess;

  beforeEach(async () => {
    testWorkspace = await createTestWorkspace();
  });

  afterEach(async () => {
    if (cliProcess) {
      cliProcess.kill();
    }
    await cleanupTestWorkspace(testWorkspace);
  });

  test('should complete full CLI workflow', async () => {
    // 1. Start CLI server
    cliProcess = spawn('node', [
      path.join(__dirname, '../../out/cli/index.js'),
      'server',
      '--workspace', testWorkspace,
      '--port', '8081',
      '--debug'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Test CLI status command
    const statusResult = await runCLICommand(['status', '--json'], testWorkspace);
    const statusData = JSON.parse(statusResult);
    expect(statusData.services).toBeDefined();

    // 3. Test Git operations
    const gitStatusResult = await runCLICommand(['git', 'status'], testWorkspace);
    expect(gitStatusResult).toContain('Repository');

    // 4. Test File System operations
    await fs.writeFile(path.join(testWorkspace, 'test.txt'), 'Hello CLI');
    const fsTreeResult = await runCLICommand(['fs', 'tree', '--json'], testWorkspace);
    const treeData = JSON.parse(fsTreeResult);
    expect(treeData.children).toBeDefined();

    // 5. Test Terminal operations
    const terminalResult = await runCLICommand(['terminal', 'exec', 'echo "CLI Test"'], testWorkspace);
    expect(terminalResult).toContain('CLI Test');

    // 6. Test RemoteRC operations
    const remotercResult = await runCLICommand(['remoterc', 'prompt', '--create'], testWorkspace);
    expect(remotercResult).toContain('Creating new prompt');

    // 7. Test WebSocket connectivity
    const wsResult = await testWebSocketConnectivity(8081);
    expect(wsResult.connected).toBe(true);

    // 8. Clean shutdown
    cliProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 30000); // Increase timeout for E2E test

  test('should handle concurrent operations', async () => {
    // Start server
    cliProcess = spawn('node', [
      path.join(__dirname, '../../out/cli/index.js'),
      'server',
      '--workspace', testWorkspace,
      '--port', '8082'
    ]);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run multiple operations concurrently
    const operations = [
      runCLICommand(['git', 'status'], testWorkspace),
      runCLICommand(['fs', 'tree'], testWorkspace),
      runCLICommand(['terminal', 'exec', 'pwd'], testWorkspace),
      runCLICommand(['remoterc', 'config', '--show'], testWorkspace)
    ];

    const results = await Promise.allSettled(operations);
    
    // All operations should complete successfully
    results.forEach(result => {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        expect(result.value).toBeDefined();
      }
    });

    cliProcess.kill();
  }, 15000);

  test('should recover from service failures', async () => {
    // Start server
    cliProcess = spawn('node', [
      path.join(__dirname, '../../out/cli/index.js'),
      'server',
      '--workspace', testWorkspace,
      '--port', '8083'
    ]);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get initial status
    const initialStatus = JSON.parse(await runCLICommand(['status', '--json'], testWorkspace));
    expect(initialStatus.services.git.healthy).toBe(true);

    // Simulate git service failure by removing .git directory
    await fs.rm(path.join(testWorkspace, '.git'), { recursive: true, force: true });

    // Wait for health check to detect failure
    await new Promise(resolve => setTimeout(resolve, 35000));

    // Check status again
    const finalStatus = JSON.parse(await runCLICommand(['status', '--json'], testWorkspace));
    
    // Service should be marked as unhealthy but still enabled
    expect(finalStatus.services.git.enabled).toBe(true);
    expect(finalStatus.services.git.healthy).toBe(false);

    cliProcess.kill();
  }, 40000);
});

// Helper functions
async function runCLICommand(args: string[], workspace: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cliPath = path.join(__dirname, '../../out/cli/index.js');
    const process = spawn('node', [cliPath, ...args], {
      cwd: workspace,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}: ${error}`));
      }
    });

    process.on('error', reject);
  });
}

async function testWebSocketConnectivity(port: number): Promise<{ connected: boolean; message?: string }> {
  return new Promise((resolve) => {
    const WebSocket = require('ws');
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'ping' }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection') {
          ws.close();
          resolve({ connected: true });
        }
      } catch (error) {
        ws.close();
        resolve({ connected: false, message: 'Invalid message format' });
      }
    });

    ws.on('error', (error) => {
      resolve({ connected: false, message: error.message });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      ws.close();
      resolve({ connected: false, message: 'Connection timeout' });
    }, 5000);
  });
}

async function createTestWorkspace(): Promise<string> {
  const workspace = path.join(__dirname, '../temp/e2e-workspace');
  await fs.mkdir(workspace, { recursive: true });
  
  // Initialize git repository
  const { exec } = require('child_process');
  await new Promise((resolve, reject) => {
    exec('git init && git config user.name "Test User" && git config user.email "test@example.com"', 
      { cwd: workspace }, (error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
  
  // Create initial commit
  await fs.writeFile(path.join(workspace, 'README.md'), '# Test Workspace');
  await new Promise((resolve, reject) => {
    exec('git add . && git commit -m "Initial commit"', { cwd: workspace }, (error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
  
  return workspace;
}

async function cleanupTestWorkspace(workspace: string): Promise<void> {
  await fs.rm(workspace, { recursive: true, force: true });
}
```

### Phase 5: Final Deployment and Documentation (1 day)

#### 5.1 Build and Deployment Scripts
Create `scripts/build-cli.ts`:
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BuildOptions {
  production: boolean;
  clean: boolean;
  sourcemaps: boolean;
  minify: boolean;
}

async function buildCLI(options: BuildOptions): Promise<void> {
  console.log('🚀 Building Kiro CLI...');
  
  try {
    // Clean build directory if requested
    if (options.clean) {
      console.log('🧹 Cleaning build directory...');
      await fs.rm(path.join(__dirname, '../out'), { recursive: true, force: true });
    }

    // Ensure build directory exists
    await fs.mkdir(path.join(__dirname, '../out'), { recursive: true });

    // Build TypeScript
    console.log('📝 Compiling TypeScript...');
    const tsConfig = options.production ? 'tsconfig.prod.json' : 'tsconfig.json';
    await execAsync(`npx tsc -p ${tsConfig}`, {
      cwd: path.join(__dirname, '..')
    });

    // Copy package.json and other necessary files
    console.log('📋 Copying package files...');
    await copyPackageFiles();

    // Copy static assets
    console.log('📁 Copying static assets...');
    await copyStaticAssets();

    // Generate CLI help documentation
    console.log('📚 Generating CLI documentation...');
    await generateCLIDocumentation();

    // Run tests
    console.log('🧪 Running tests...');
    await runTests();

    // Create distribution package
    if (options.production) {
      console.log('📦 Creating distribution package...');
      await createDistributionPackage();
    }

    console.log('✅ CLI build completed successfully!');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function copyPackageFiles(): Promise<void> {
  const packageJson = await fs.readFile(path.join(__dirname, '../package.json'), 'utf-8');
  const packageData = JSON.parse(packageJson);
  
  // Update package.json for CLI distribution
  packageData.main = 'cli/index.js';
  packageData.bin = {
    'kiro-cli': 'cli/index.js'
  };
  packageData.type = 'module';
  
  await fs.writeFile(
    path.join(__dirname, '../out/package.json'),
    JSON.stringify(packageData, null, 2)
  );

  // Copy README
  try {
    await fs.copyFile(
      path.join(__dirname, '../README.md'),
      path.join(__dirname, '../out/README.md')
    );
  } catch (error) {
    console.warn('README.md not found, skipping...');
  }

  // Copy LICENSE
  try {
    await fs.copyFile(
      path.join(__dirname, '../LICENSE'),
      path.join(__dirname, '../out/LICENSE')
    );
  } catch (error) {
    console.warn('LICENSE not found, skipping...');
  }
}

async function copyStaticAssets(): Promise<void> {
  const staticDir = path.join(__dirname, '../static');
  const outStaticDir = path.join(__dirname, '../out/static');
  
  try {
    await fs.mkdir(outStaticDir, { recursive: true });
    const files = await fs.readdir(staticDir);
    
    for (const file of files) {
      await fs.copyFile(
        path.join(staticDir, file),
        path.join(outStaticDir, file)
      );
    }
  } catch (error) {
    console.warn('Static directory not found, skipping...');
  }
}

async function generateCLIDocumentation(): Promise<void> {
  const { CLICommandManager } = await import('../src/cli/commands');
  
  const cliManager = new CLICommandManager({
    workspaceRoot: process.cwd(),
    logLevel: 'info',
    enableColors: false,
    outputFormat: 'text'
  });

  const program = cliManager.getProgram();
  const helpText = program.helpInformation();
  
  await fs.writeFile(
    path.join(__dirname, '../out/CLI_HELP.md'),
    `# Kiro CLI Help\n\n\`\`\`\n${helpText}\n\`\`\`\n`
  );
}

async function runTests(): Promise<void> {
  try {
    await execAsync('npm test', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Tests failed:', error);
    throw error;
  }
}

async function createDistributionPackage(): Promise<void> {
  const version = JSON.parse(await fs.readFile(path.join(__dirname, '../package.json'), 'utf-8')).version;
  const distDir = path.join(__dirname, '../dist');
  
  await fs.mkdir(distDir, { recursive: true });
  
  // Create tarball
  await execAsync(`cd ../out && npm pack`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  
  // Move tarball to dist directory
  const tarballName = `kiro-cli-${version}.tgz`;
  await fs.rename(
    path.join(__dirname, `../${tarballName}`),
    path.join(distDir, tarballName)
  );
  
  console.log(`📦 Distribution package created: ${path.join(distDir, tarballName)}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: BuildOptions = {
  production: args.includes('--production'),
  clean: args.includes('--clean') || args.includes('--prod'),
  sourcemaps: !args.includes('--no-sourcemaps'),
  minify: !args.includes('--no-minify')
};

buildCLI(options);
```

#### 5.2 Final Documentation
Create `docs/cli-deployment.md`:
```markdown
# CLI Deployment Guide

## Overview

This guide covers the deployment of the Kiro CLI, including installation, configuration, and usage instructions for the standalone CLI version that has been migrated from the VS Code extension.

## Prerequisites

### System Requirements
- Node.js 16.x or higher
- npm 8.x or higher
- Git (for Git service functionality)
- 100MB free disk space

### Optional Dependencies
- Python 3.x (for Python execution in terminal)
- Go 1.x+ (for Go execution in terminal)
- .NET SDK 6.0+ (for .NET execution in terminal)

## Installation

### Method 1: NPM Package (Recommended)
```bash
npm install -g kiro-cli
```

### Method 2: Build from Source
```bash
# Clone the repository
git clone https://github.com/your-org/kiro.git
cd kiro

# Install dependencies
npm install

# Build the CLI
npm run build:cli

# Install globally
npm install -g ./out/kiro-cli-*.tgz
```

### Method 3: Docker
```bash
# Pull the Docker image
docker pull kiroai/cli:latest

# Run the CLI
docker run -it --rm -v $(pwd):/workspace kiroai/cli:latest status
```

## Configuration

### Environment Variables
The CLI can be configured using environment variables:

```bash
# Workspace configuration
export KIRO_WORKSPACE=/path/to/your/workspace

# Service enablement
export KIRO_GIT_ENABLED=1
export KIRO_TERMINAL_ENABLED=1
export KIRO_FS_ENABLED=1
export KIRO_REMOTERC_ENABLED=1

# Server configuration
export KIRO_SERVER_PORT=8080
export KIRO_SERVER_HOST=localhost

# Logging
export KIRO_LOG_LEVEL=info
export KIRO_DEBUG=1
```

### Configuration File
Create a configuration file at `~/.kiro/config.json`:

```json
{
  "workspaceRoot": "/path/to/workspace",
  "logLevel": "info",
  "enableColors": true,
  "outputFormat": "text",
  "services": {
    "git": {
      "enabled": true,
      "defaultBranch": "main",
      "timeoutMs": 30000
    },
    "terminal": {
      "enabled": true,
      "maxSessions": 50,
      "commandAllowlist": ["ls", "git", "npm", "node"]
    },
    "filesystem": {
      "enabled": true,
      "maxTextFileSize": 1048576,
      "enableFileWatching": true
    },
    "remoterc": {
      "enabled": true,
      "maxHistoryDays": 30,
      "enableTemplates": true
    }
  },
  "server": {
    "port": 8080,
    "maxClients": 100
  }
}
```

## Usage

### Basic Commands

#### System Status
```bash
# Show overall system status
kiro-cli status

# Show status in JSON format
kiro-cli status --json
```

#### Git Operations
```bash
# Show git repository status
kiro-cli git status

# Show commit history
kiro-cli git log --count 10

# Show git diff
kiro-cli git diff
```

#### Terminal Operations
```bash
# Show terminal configuration
kiro-cli terminal config

# Execute a command safely
kiro-cli terminal exec "ls -la"

# Create a terminal session
kiro-cli terminal session --persistent
```

#### File System Operations
```bash
# Show directory tree
kiro-cli fs tree

# Read a file
kiro-cli fs read README.md

# Watch a directory for changes
kiro-cli fs watch . --timeout 60
```

#### RemoteRC Operations
```bash
# List all prompts
kiro-cli remoterc prompt --list

# Search prompts
kiro-cli remoterc prompt --search "test query"

# Create a new prompt
kiro-cli remoterc prompt --create
```

### WebSocket Server

#### Start the Server
```bash
# Start with default settings
kiro-cli server

# Start with custom settings
kiro-cli server --port 8080 --workspace /path/to/workspace --debug
```

#### Connect to the Server
The WebSocket server provides a real-time interface for web applications:

```javascript
// Example WebSocket client
const ws = new WebSocket('ws://localhost:8080/ws');

ws.on('open', () => {
  console.log('Connected to Kiro CLI server');
  
  // Send a command
  ws.send(JSON.stringify({
    type: 'git',
    id: 'req-1',
    data: {
      operation: 'status'
    }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

## Service Integration

### Coordinated Operations
The CLI services work together seamlessly:

```bash
# Example: Create a prompt from git commit message
kiro-cli git log --count 1 --json | \
  jq -r '.recentCommits[0].message' | \
  xargs -I {} kiro-cli remoterc prompt --create --content "{}"
```

### Error Handling
All services include comprehensive error handling:

```bash
# Enable debug logging for troubleshooting
kiro-cli --debug server

# Check service health
kiro-cli status --json
```

## Performance Optimization

### Caching
Services use intelligent caching to improve performance:

```json
{
  "performance": {
    "enableCaching": true,
    "cacheTimeoutMs": 300000,
    "maxConcurrentOperations": 10
  }
}
```

### Resource Management
Configure resource limits based on your system:

```json
{
  "services": {
    "terminal": {
      "maxSessions": 50,
      "idleTimeoutEphemeral": 900000
    },
    "filesystem": {
      "maxWatchersPerClient": 50
    }
  }
}
```

## Security

### Command Safety
The terminal service includes a command allowlist:

```json
{
  "services": {
    "terminal": {
      "commandAllowlist": [
        "ls", "dir", "echo", "git", "npm", "pnpm", "yarn", 
        "node", "python", "pip", "go", "dotnet", "cargo"
      ],
      "allowUnsafeCommands": false
    }
  }
}
```

### Path Validation
File system operations include path validation:

```json
{
  "services": {
    "filesystem": {
      "enablePathValidation": true,
      "requireWorkspaceContainment": true,
      "deniedPaths": ["/etc", "/usr", "~/.ssh"]
    }
  }
}
```

## Troubleshooting

### Common Issues

#### Service Not Starting
```bash
# Check service status
kiro-cli status --json

# Enable debug logging
kiro-cli --debug server

# Check configuration
kiro-cli config --show
```

#### WebSocket Connection Issues
```bash
# Verify server is running
kiro-cli server --port 8080

# Test connectivity
curl -I http://localhost:8080
```

#### Permission Issues
```bash
# Check file permissions
ls -la ~/.kiro/

# Fix permissions if needed
chmod 755 ~/.kiro/
```

### Log Files
Logs are stored in `~/.kiro/logs/`:

```bash
# View recent logs
tail -f ~/.kiro/logs/cli.log

# View error logs
tail -f ~/.kiro/logs/error.log
```

## Development

### Building from Source
```bash
# Clone repository
git clone https://github.com/your-org/kiro.git
cd kiro

# Install dependencies
npm install

# Run development build
npm run build:cli --dev

# Run tests
npm test

# Run integration tests
npm run test:integration
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

### Documentation
- [CLI Command Reference](./cli-commands.md)
- [API Documentation](./api.md)
- [Configuration Guide](./configuration.md)

### Community
- GitHub Issues: https://github.com/your-org/kiro/issues
- Discussions: https://github.com/your-org/kiro/discussions
- Discord: https://discord.gg/kiro

### Getting Help
- Create an issue on GitHub
- Join our Discord community
- Check the troubleshooting guide

## Version History

### v1.0.0 (Current)
- Complete migration from VS Code extension
- Standalone CLI with all services
- WebSocket server integration
- Comprehensive configuration system
- Enhanced security features

### v0.9.0 (Previous)
- VS Code extension with CLI fallback
- Basic service implementations
- Limited configuration options

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
```

## Success Criteria

### Minimum Viable Product
- [ ] All services migrated to CLI without VS Code dependencies
- [ ] Unified CLI architecture with service coordination
- [ ] WebSocket server with service routing
- [ ] Comprehensive CLI command system
- [ ] Basic integration and E2E tests passing

### Enhanced Features
- [ ] Advanced configuration management
- [ ] Unified error handling and logging
- [ ] Performance optimization and resource management
- [ ] Complete test coverage (unit, integration, E2E)
- [ ] Production-ready build and deployment scripts
- [ ] Comprehensive documentation

## Files to Create/Modify

### New Files
- `src/cli/services/ServiceManager.ts` - Unified service coordinator
- `src/cli/services/ConfigManager.ts` - Unified configuration
- `src/cli/services/Logger.ts` - Unified logging
- `src/cli/services/ErrorHandler.ts` - Unified error handling
- `src/cli/server/WebSocketServer.ts` - Enhanced WebSocket server
- `src/cli/server/ServiceRouter.ts` - Request routing
- `src/cli/server/ClientManager.ts` - Client management
- `src/cli/commands/index.ts` - CLI command coordinator
- `src/cli/commands/server.ts` - Server management commands
- `tests/integration/` - Integration test suite
- `tests/e2e/` - End-to-end test suite
- `scripts/build-cli.ts` - Build script
- `docs/cli-deployment.md` - Deployment guide

### Modified Files
- `src/cli/index.ts` - Main CLI entry point
- `package.json` - Update build scripts and dependencies
- `tsconfig.json` - Add production configuration
- `README.md` - Update with CLI information

### Files to Remove
- `src/server/` - Original server directory (services migrated to CLI)
- Original VS Code extension files (no longer needed)

## Timeline
- **Day 1**: Unified CLI architecture and service coordination
- **Day 2**: Enhanced WebSocket server and CLI command system
- **Day 3**: Configuration, error handling, and logging
- **Day 4**: Testing (integration and E2E)
- **Day 5**: Build, deployment, and documentation

## Migration Strategy

1. **Incremental Migration**: Migrate services one by one while maintaining compatibility
2. **Parallel Testing**: Run tests for both old and new implementations during transition
3. **Feature Flagging**: Use configuration to enable/disable services during migration
4. **Performance Validation**: Ensure CLI performance matches or exceeds VS Code version
5. **User Experience**: Provide clear migration path and documentation for users

This integration plan provides a comprehensive roadmap for completing the migration from VS Code extension to a fully functional, production-ready CLI implementation.
