import { WebServer, WebServerConfig } from '../server/WebServer';
import { WebSocketServer } from '../server/WebSocketServer';
import { TerminalService } from './services/TerminalService';
import { CLIGitService } from './services/GitService';
import { CLIFileSystemService } from './services/FileSystemService';
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
  private webServer?: WebServer | undefined;
  private webSocketServer?: WebSocketServer | undefined;
  private terminalService?: TerminalService | undefined;
  private gitService?: CLIGitService | undefined;
  private filesystemService?: CLIFileSystemService | undefined;
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

      // Start web server with React frontend
      const webServerConfig: WebServerConfig = {
        port: port,
        host: this.config.server.host,
        distPath: './src/webview/react-frontend/dist'
      };

      this.webServer = new WebServer(webServerConfig);
      await this.webServer.start();

      // Start WebSocket server attached to the HTTP server
      this.webSocketServer = new WebSocketServer(
        { httpPort: port },
        (this.webServer as any).server,
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
      port: this.webServer ? (this.webServer as any).status?.port : undefined,
      uptime: this.isRunning && this.startTime ? Date.now() - this.startTime.getTime() : undefined,
      startTime: this.startTime,
      webServerStatus: this.webServer ? (this.webServer as any).status : undefined,
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
