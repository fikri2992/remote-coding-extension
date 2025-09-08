import { WebServer, WebServerConfig } from '../server/WebServer';
import { WebSocketServer } from '../server/WebSocketServer';
import { TerminalService } from './services/TerminalService';
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
}

export class CliServer {
  private webServer?: WebServer | undefined;
  private webSocketServer?: WebSocketServer | undefined;
  private terminalService?: TerminalService | undefined;
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
      terminalStats: this.terminalService ? this.terminalService.getStats() : undefined
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
