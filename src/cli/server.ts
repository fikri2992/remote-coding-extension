import { HttpServer } from '../server/HttpServer';
import { WebSocketServer } from '../server/WebSocketServer';
import { ServerConfig } from '../server/interfaces';
import { TerminalService } from './services/TerminalService';
import { CLIGitService } from './services/GitService';
import { CLIFileSystemService } from './services/FileSystemService';
import { AcpHttpController } from '../acp/AcpHttpController';
import {
  createTunnel as cfCreateTunnel,
  getActiveTunnels as cfGetActiveTunnels,
  getTunnelsSummary as cfGetTunnelsSummary,
  stopTunnelById as cfStopTunnelById,
  stopAllTunnels as cfStopAllTunnels,
  ensureCloudflared as cfEnsure,
  killProcessTree as cfKillTree,
} from '../server/CloudflaredManager';
import fs from 'fs/promises';
import path from 'path';

export interface CliConfig {
  version: string;
  server: {
    port: number;
    host: string;
  };
  terminal: {
    shell: string;
    cwd: string;
  };
  prompts: {
    directory: string;
    autoSave: boolean;
  };
  results: {
    directory: string;
    format: string;
  };
  created: string;
  lastModified: string;
}

export interface CliServerStatus {
  isRunning: boolean;
  config?: CliConfig | undefined;
  configPath?: string | undefined;
  port?: number;
  uptime?: number | undefined;
  startTime?: Date | undefined;
  webServerStatus?: any;
  terminalStats?: {
    totalSessions: number;
    persistentSessions: number;
    ephemeralSessions: number;
    activeSessions: number;
    idleSessions: number;
  } | undefined;
  gitStats?: {
    repositoryCache: number;
    config: any;
  } | undefined;
  filesystemStats?: {
    cacheSize: number;
    config: any;
    watcherStats: any;
  } | undefined;
}

export class CliServer {
  private webServer?: HttpServer | undefined;
  private webSocketServer?: WebSocketServer | undefined;
  private terminalService?: TerminalService | undefined;
  private gitService?: CLIGitService | undefined;
  private filesystemService?: CLIFileSystemService | undefined;
  private acpController?: AcpHttpController | undefined;
  private isRunning = false;
  private config?: CliConfig;
  private configPath?: string;
  private startTime?: Date;

  constructor(configPath?: string) {
    this.configPath = configPath || '.on-the-go/config.json';
  }

  async loadConfig(): Promise<CliConfig> {
    try {
      const configContent = await fs.readFile(this.configPath!, 'utf-8');
      this.config = JSON.parse(configContent);
      return this.config!;
    } catch (error) {
      throw new Error(`Failed to load config from ${this.configPath}: ${error}`);
    }
  }

  async start(options: { port?: number; config?: string } = {}) {
    if (this.isRunning) {
      console.log('✅ Server is already running');
      return;
    }

    try {
      // Load configuration
      if (options.config) {
        this.configPath = options.config;
      }
      this.config = await this.loadConfig();

      // Override port if provided
      const port = options.port || this.config.server.port;

      console.log('🚀 Starting Kiro Remote server...');
      console.log(`📁 Configuration: ${this.configPath}`);
      console.log(`🌐 Port: ${port}`);

      // Start unified HTTP server (serves React dist; WS upgrades attach here)
      const serverCfg: ServerConfig = {
        httpPort: port,
        autoStartTunnel: false,
      };
      this.webServer = new HttpServer(serverCfg);
      await this.webServer.start();

      // Start WebSocket server attached to the HTTP server
      this.webSocketServer = new WebSocketServer(
        { httpPort: port },
        this.webServer.nodeServer!,
        '/ws'
      );
      await this.webSocketServer.start();

      // Initialize terminal service
      this.terminalService = new TerminalService((clientId: string, message: any) => {
        // Send terminal messages through WebSocket
        if (this.webSocketServer) {
          return this.webSocketServer.sendToClient(clientId, message);
        }
        return false;
      });

      // Initialize git service
      const workspaceRoot = process.cwd();
      console.log(`🔧 Git Service workspace root: ${workspaceRoot}`);
      this.gitService = new CLIGitService({
        workspaceRoot: workspaceRoot,
        enableDebug: process.env.KIRO_GIT_DEBUG === '1'
      });

      // Initialize filesystem service
      console.log(`📁 FileSystem Service workspace root: ${workspaceRoot}`);
      this.filesystemService = new CLIFileSystemService((clientId: string, message: any) => {
        // Send filesystem messages through WebSocket
        if (this.webSocketServer) {
          return this.webSocketServer.sendToClient(clientId, message);
        }
        return false;
      });

      // Log filesystem service configuration for debugging
      console.log(`📁 FileSystem Service config:`, this.filesystemService.getConfig());

      // Initialize ACP controller (WS-only; no REST endpoints)
      console.log(`🤖 Initializing ACP controller (WS-only)...`);
      this.acpController = new AcpHttpController();
      await this.acpController.init();

      // Option B — Autostart the ACP agent at server startup
      // Proactively connect so the agent is pre-warmed before any client appears.
      // Keep non-fatal: if credentials are missing or any error occurs, continue startup.
      try {
        await this.acpController.connect({});
        console.log('🤖 ACP agent autostarted (pre-warmed)');
      } catch (e: any) {
        console.warn('[ACP] Autostart failed (non-fatal):', e?.message || String(e));
      }

      // Register terminal service with WebSocket server
      if (this.webSocketServer) {
        (this.webSocketServer as any).registerService('terminal', {
          handle: (clientId: string, message: any) => {
            if (this.terminalService) {
              return this.terminalService.handle(clientId, message);
            }
            return Promise.resolve();
          },
          onClientDisconnect: (clientId: string) => {
            if (this.terminalService) {
              this.terminalService.onClientDisconnect(clientId);
            }
          }
        });

        // Register git service with WebSocket server
        (this.webSocketServer as any).registerService('git', {
          handle: async (clientId: string, message: any) => {
            if (!this.gitService) {
              return { error: 'Git service not available' };
            }

            try {
              // Extract operation and options from the correct nested structure
              const operation = message.data?.gitData?.operation;
              const options = message.data?.gitData?.options || {};

              if (this.config?.server && process.env.KIRO_GIT_DEBUG === '1') {
                console.log(`[Git Debug] Received message:`, JSON.stringify(message, null, 2));
                console.log(`[Git Debug] Extracted operation: ${operation}`);
                console.log(`[Git Debug] Extracted options:`, options);
              }

              if (!operation) {
                return { error: 'Missing operation in git message' };
              }

              switch (operation) {
                case 'status':
                  const repositoryState = await this.gitService.getRepositoryState(options.workspacePath);
                  return { success: true, data: repositoryState };

                case 'log':
                  const commits = await this.gitService.getRecentCommits(options.count || 10, options.workspacePath);
                  return { success: true, data: commits };

                case 'diff':
                  const diffs = await this.gitService.getCurrentDiff(options.workspacePath);
                  return { success: true, data: diffs };

                case 'add':
                  await this.gitService.add(options.files, options.workspacePath);
                  return { success: true };

                case 'commit':
                  await this.gitService.commit(options.message, options.files, options.workspacePath);
                  return { success: true };

                case 'push':
                  await this.gitService.push(options.remote, options.branch, options.workspacePath);
                  return { success: true };

                case 'pull':
                  await this.gitService.pull(options.remote, options.branch, options.workspacePath);
                  return { success: true };

                case 'state':
                  const state = await this.gitService.getRepositoryState(options.workspacePath);
                  return { success: true, data: state };

                case 'find-repos':
                  const repos = await this.gitService.findRepositories(options.rootPath);
                  return { success: true, data: repos };

                case 'show':
                  if (!options.commitHash) {
                    return { error: 'Missing commitHash for show operation' };
                  }
                  const showResult = await this.gitService.getCommitDiff(options.commitHash, options.workspacePath);
                  return { success: true, data: showResult };

                case 'config':
                  const config = this.gitService.getConfig();
                  return { success: true, data: config };

                case 'branch':
                  if (options.create) {
                    await this.gitService.executeSafeOperation('create-branch', {
                      name: options.create,
                      from: options.from,
                      workspacePath: options.workspacePath
                    });
                  } else if (options.switch) {
                    await this.gitService.executeSafeOperation('switch-branch', {
                      name: options.switch,
                      workspacePath: options.workspacePath
                    });
                  } else {
                    const repo = await this.gitService.getRepository(options.workspacePath);
                    const currentBranch = repo ? await repo.getCurrentBranch() : null;
                    return { success: true, data: { currentBranch } };
                  }
                  return { success: true };

                default:
                  return { error: `Unknown git operation: ${operation}` };
              }
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          },
          onClientDisconnect: (clientId: string) => {
            // Git service doesn't need special disconnect handling
          }
        });

        // Register filesystem service with WebSocket server
        (this.webSocketServer as any).registerService('fileSystem', {
          handle: async (clientId: string, message: any) => {
            if (!this.filesystemService) {
              return { error: 'Filesystem service not available' };
            }

            try {
              // Debug logging enabled by default for troubleshooting
              console.log(`[FS Debug] Received message:`, JSON.stringify(message, null, 2));

              // Use the filesystem service's own handle method which expects the full message
              // The service will handle the message parsing and send responses directly
              await this.filesystemService.handle(clientId, message);

              // Return a success indicator since the service handles responses internally
              return { success: true };
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          },
          onClientDisconnect: (clientId: string) => {
            if (this.filesystemService) {
              this.filesystemService.onClientDisconnect(clientId);
            }
          }
        });

        // Register tunnels service (Cloudflared) over WebSocket
        (this.webSocketServer as any).registerService('tunnels', {
          handle: async (_clientId: string, message: any) => {
            try {
              const op = message.op || message.operation || message.data?.operation;
              const body = message.payload || message.data || {};
              switch (op) {
                case 'list':
                  return { success: true, data: cfGetActiveTunnels() };
                case 'status':
                  return { success: true, data: await cfGetTunnelsSummary() };
                case 'create': {
                  const localPort = Number(body.localPort || 0);
                  if (!localPort || Number.isNaN(localPort)) {
                    return { success: false, error: 'localPort is required' };
                  }
                  const name = typeof body.name === 'string' ? body.name : undefined;
                  const token = typeof body.token === 'string' ? body.token : undefined;
                  const type: 'quick' | 'named' = name || token ? 'named' : 'quick';
                  const tunnel = await cfCreateTunnel({ localPort, name, token, type });
                  return { success: true, data: tunnel };
                }
                case 'stop': {
                  const id = typeof body.id === 'string' ? body.id : undefined;
                  const pid = typeof body.pid === 'number' ? body.pid : undefined;
                  let ok = false;
                  if (id) ok = await cfStopTunnelById(id);
                  else if (pid && pid > 0) ok = await cfKillTree(pid);
                  else return { success: false, error: 'id or pid is required' };
                  return { success: true, data: { ok } };
                }
                case 'stopAll': {
                  const count = await cfStopAllTunnels();
                  return { success: true, data: { stopped: count } };
                }
                case 'install': {
                  const bin = await cfEnsure(undefined);
                  return { success: true, data: { binary: bin } };
                }
                default:
                  return { success: false, error: `Unknown tunnels op: ${op}` };
              }
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          },
          onClientDisconnect: (_clientId: string) => {}
        });

        // Register ACP service (WebSocket only)
        (this.webSocketServer as any).registerService('acp', {
          handle: async (_clientId: string, message: any) => {
            if (!this.acpController) {
              return { error: 'ACP service not available' };
            }
            try {
              const operation = message.op;
              const payload = message.payload || {};
              switch (operation) {
                case 'connect':
                  return { success: true, data: await this.acpController.connect(payload) };
                case 'authenticate':
                  return { success: true, data: await this.acpController.authenticate(payload) };
                case 'authMethods':
                  return { success: true, data: { methods: this.acpController.getAuthMethods() } };
                case 'session.new':
                  return { success: true, data: await this.acpController.newSession(payload) };
                case 'session.setMode':
                  return { success: true, data: await this.acpController.setMode(payload) };
                case 'cancel':
                  return { success: true, data: await this.acpController.cancel(payload) };
                case 'prompt':
                  return { success: true, data: await this.acpController.prompt(payload) };
                case 'session.state':
                  return { success: true, data: this.acpController.state() };
                case 'session.ensureActive':
                  return { success: true, data: { sessionId: await (this.acpController as any)['ensureActiveSession']() } };
                case 'session.selectThread':
                  return { success: true, data: await this.acpController.selectThread(payload) };
                case 'disconnect':
                  return { success: true, data: await this.acpController.disconnect() };
                case 'models.list':
                  return { success: true, data: await this.acpController.listModels(payload.sessionId) };
                case 'model.select':
                  return { success: true, data: await this.acpController.selectModel(payload) };
                case 'permission':
                  return { success: true, data: await this.acpController.permission(payload) };
                case 'sessions.list':
                  return { success: true, data: this.acpController.listSessions() };
                case 'session.select':
                  return { success: true, data: await this.acpController.selectSession(payload) };
                case 'session.delete':
                  return { success: true, data: await this.acpController.deleteSession(payload) };
                case 'terminal.create':
                  return { success: true, data: this.acpController.terminalCreate(payload) };
                case 'terminal.output':
                  return { success: true, data: this.acpController.terminalOutput(payload) };
                case 'terminal.kill':
                  return { success: true, data: this.acpController.terminalKill(payload) };
                case 'terminal.release':
                  return { success: true, data: this.acpController.terminalRelease(payload) };
                case 'terminal.waitForExit':
                  return { success: true, data: await this.acpController.terminalWaitForExit(payload) };
                case 'terminal.commands.list':
                  return { success: true, data: await this.acpController.listTerminalCommands() };
                case 'terminal.commands.remove':
                  return { success: true, data: await this.acpController.removeTerminalCommand(payload) };
                case 'terminal.commands.clear':
                  return { success: true, data: await this.acpController.clearTerminalCommands() };
                case 'diff.apply':
                  return { success: true, data: await this.acpController.applyDiff(payload) };
                case 'session.last':
                  return { success: true, data: this.acpController.lastSession() };
                case 'threads.list':
                  return { success: true, data: await this.acpController.listThreads() };
                case 'thread.get':
                  return { success: true, data: await this.acpController.getThread(payload.id) };
                case 'thread.rename':
                  return { success: true, data: await (this.acpController as any).renameThread(payload) };
                default:
                  return { error: `Unknown ACP operation: ${operation}` };
              }
            } catch (error: any) {
              // Preserve structured error details for the client (e.g., authRequired, authMethods, code)
              const errObj = error instanceof Error ? error : new Error(String(error?.message || error));
              const payload = {
                message: errObj.message,
                code: (error && typeof error.code === 'number') ? error.code : undefined,
                authRequired: (error && typeof error.authRequired === 'boolean') ? error.authRequired : undefined,
                authMethods: (error && Array.isArray(error.authMethods)) ? error.authMethods : undefined,
              };
              return { success: false, error: payload } as any;
            }
          },
          onClientDisconnect: (_clientId: string) => {
            // No special handling needed
          }
        });

        // Bridge ACP event bus to all connected WS clients for live feedback
        try {
          const forward = (msg: any) => {
            try { this.webSocketServer?.broadcast(msg); } catch {}
          };
          const bus = require('../acp/AcpEventBus');
          if (bus && bus.AcpEventBus && bus.AcpEventBus.on) {
            bus.AcpEventBus.on('agent_connect', forward);
            bus.AcpEventBus.on('agent_initialized', forward);
            bus.AcpEventBus.on('agent_stderr', forward);
            bus.AcpEventBus.on('agent_exit', forward);
            bus.AcpEventBus.on('permission_request', forward);
            bus.AcpEventBus.on('terminal_output', forward);
            bus.AcpEventBus.on('terminal_exit', forward);
            bus.AcpEventBus.on('terminal_command_update', forward);
            bus.AcpEventBus.on('session_update', forward);
            try { bus.AcpEventBus.on('session_recovered', forward); } catch {}
            console.log('🔗 ACP event bus bridged to WebSocket broadcast');
          }
        } catch {}
      }

      this.isRunning = true;
      this.startTime = new Date();

      console.log('');
      console.log('✅ Server started successfully!');
      console.log(`📱 Web interface: http://localhost:${port}`);
      console.log('🔧 WebSocket: Connected');
      console.log('');
      console.log('Press Ctrl+C to stop the server');

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log('ℹ️  Server is not running');
      return;
    }

    try {
      console.log('🛑 Stopping server...');

      if (this.webServer) {
        await this.webServer.stop();
        this.webServer = undefined;
      }

      if (this.webSocketServer) {
        await this.webSocketServer.stop();
        this.webSocketServer = undefined;
      }

      if (this.terminalService) {
        this.terminalService.dispose();
        this.terminalService = undefined;
      }

      if (this.gitService) {
        this.gitService.clearCache();
        this.gitService = undefined;
      }

      if (this.filesystemService) {
        this.filesystemService.cleanup();
        this.filesystemService = undefined;
      }

      this.isRunning = false;
      console.log('✅ Server stopped successfully');

    } catch (error) {
      console.error('❌ Failed to stop server:', error);
      throw error;
    }
  }

  getStatus(): CliServerStatus {
    return {
      isRunning: this.isRunning,
      config: this.config,
      configPath: this.configPath,
      ...(this.webServer ? { port: this.webServer.port } : {}),
      uptime: this.isRunning && this.startTime ? Date.now() - this.startTime.getTime() : undefined,
      startTime: this.startTime,
      ...(this.webServer ? { webServerStatus: this.webServer.getDiagnostics() } : {}),
      terminalStats: this.terminalService ? this.terminalService.getStats() : undefined,
      gitStats: this.gitService ? {
        repositoryCache: this.gitService['repositoryCache'].size,
        config: this.gitService.getConfig()
      } : undefined,
      filesystemStats: this.filesystemService ? {
        cacheSize: (this.filesystemService as any).cache.size,
        config: this.filesystemService.getConfig(),
        watcherStats: this.filesystemService.getWatcherStats()
      } : undefined
    };
  }

  printStatus() {
    const status = this.getStatus();

    if (!status.isRunning) {
      console.log('❌ Server is not running');
      return;
    }

    console.log('🟢 Kiro Remote Server Status');
    console.log('================================');
    console.log(`📁 Config: ${status.configPath}`);
    console.log(`🌐 Port: ${status.port || 'unknown'}`);
    console.log(`⏱️  Uptime: ${status.uptime ? this.formatUptime(status.uptime) : 'unknown'}`);

    if (status.startTime) {
      console.log(`🕒 Started: ${status.startTime.toLocaleString()}`);
    }

    if (status.webServerStatus) {
      console.log(`🌐 Web Server: ${status.webServerStatus.isRunning ? 'Running' : 'Stopped'}`);
      console.log(`🔗 Local URL: ${status.webServerStatus.localUrl || 'unknown'}`);

      if (status.webServerStatus.lastError) {
        console.log(`⚠️  Last Error: ${status.webServerStatus.lastError}`);
      }
    }

    if (status.terminalStats) {
      console.log(`🖥️  Terminal Sessions: ${status.terminalStats.totalSessions} total`);
      console.log(`   Active: ${status.terminalStats.activeSessions}`);
      console.log(`   Idle: ${status.terminalStats.idleSessions}`);
      console.log(`   Persistent: ${status.terminalStats.persistentSessions}`);
    }

    if (status.gitStats) {
      console.log(`🔀 Git Service: ${status.gitStats.repositoryCache} cached repositories`);
      console.log(`   Default Branch: ${status.gitStats.config.defaultBranch}`);
      console.log(`   Debug: ${status.gitStats.config.enableDebug}`);
    }

    if (status.filesystemStats) {
      console.log(`📁 File System Service: ${status.filesystemStats.cacheSize} cached items`);
      console.log(`   Max Text File Size: ${formatBytes(status.filesystemStats.config.maxTextFileSize)}`);
      console.log(`   File Watching: ${status.filesystemStats.config.enableFileWatching}`);
      console.log(`   Watchers: ${status.filesystemStats.watcherStats.totalClients} clients, ${status.filesystemStats.watcherStats.totalWatchers} total watchers`);
    }

    console.log('================================');
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
