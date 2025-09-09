import WebSocket from 'ws';
import { IncomingMessage, Server as HttpServer } from 'http';
import { Socket } from 'net';
import { CLIFileSystemService } from '../cli/services/FileSystemService';
import { CLIGitService } from '../cli/services/GitService';
import { TerminalService } from '../cli/services/TerminalService';
import { FileSystemConfigManager } from '../cli/services/FileSystemConfig';
import { GitConfigManager } from '../cli/services/GitService';
import { TerminalConfigManager } from '../cli/services/TerminalConfig';

type ICommandHandler = {
  addAllowedCommand: (cmd: string) => void;
  executeCommand: (cmd: string, args: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  dispose: () => void;
  setStateChangeCallback?: (cb: any) => void;
} | null;

// Service interface for WebSocket registration
interface ServiceRegistration {
  handle: (clientId: string, message: any) => Promise<any>;
  onClientDisconnect: (clientId: string) => void;
}

export interface WebSocketConnection {
  ws: WebSocket;
  id: string;
  isAlive: boolean;
}

export class WebSocketServer {
  private wss: WebSocket.Server | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private _port: number;
  private _clientCount: number = 0;
  private _attachedHttpServer: HttpServer | null = null;
  private _upgradePath: string = '/ws';
  private _fsService: CLIFileSystemService;
  private _gitService: CLIGitService | null = null;
  private _terminalService: TerminalService;
  private _commandHandler: ICommandHandler = null;
  private services: Map<string, ServiceRegistration> = new Map();
  private debug: boolean = true; // Hardcoded debug mode for WebSocket frame tracking

  constructor(config: any, attachedHttpServer?: HttpServer, upgradePath: string = '/ws') {
    // Handle both number and config object
    if (typeof config === 'number') {
      this._port = config;
    } else {
      this._port = (attachedHttpServer ? config.httpPort : (config.websocketPort || config.httpPort + 1));
    }
    this._attachedHttpServer = attachedHttpServer || null;
    this._upgradePath = upgradePath;
    
    if (this.debug) {
      console.log('🔧 WebSocketServer: Debug mode ENABLED (hardcoded)');
    }
    
    // Initialize CLI services with proper configuration
    const fsConfig = new FileSystemConfigManager();
    this._fsService = new CLIFileSystemService((clientId, payload) => this.sendToClient(clientId, payload), fsConfig.config);
    
    const gitConfig = new GitConfigManager();
    this._gitService = new CLIGitService({
      workspaceRoot: process.cwd(),
      enableDebug: process.env.KIRO_GIT_DEBUG === '1'
    });
    
    const terminalConfig = new TerminalConfigManager();
    this._terminalService = new TerminalService((clientId, payload) => this.sendToClient(clientId, payload));
    
    // Register services for WebSocket handling
    this.registerService('fileSystem', {
      handle: (clientId: string, message: any) => {
        return this._fsService.handle(clientId, message);
      },
      onClientDisconnect: (clientId: string) => {
        this._fsService.onClientDisconnect(clientId);
      }
    });
    
    // Git service registration is now handled by CLI server
    // This built-in registration is disabled to avoid conflicts
    
    this.registerService('terminal', {
      handle: (clientId: string, message: any) => {
        return this._terminalService.handle(clientId, message);
      },
      onClientDisconnect: (clientId: string) => {
        this._terminalService.onClientDisconnect(clientId);
      }
    });
    
    // Try to initialize command handler for VS Code compatibility
    try {
      const mod = require('./CommandHandler');
      this._commandHandler = new mod.CommandHandler();
      const ch = this._commandHandler as any;
      ch.addAllowedCommand('kiroAgent.focusContinueInputWithoutClear');
      ch.addAllowedCommand('type');
      ch.addAllowedCommand('editor.action.clipboardPasteAction');
      ch.addAllowedCommand('kiroAgent.focusPasteEnter');
    } catch {
      this._commandHandler = null;
      if (this.debug) console.log('WebSocketServer: CommandHandler unavailable (CLI mode)');
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this._attachedHttpServer) {
          // Attach to existing HTTP server using noServer mode
          this.wss = new WebSocket.Server({ noServer: true });

          this._attachedHttpServer.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
            try {
              const url = new URL(request.url || '/', 'http://localhost');
              if (url.pathname !== this._upgradePath) {
                socket.destroy();
                return;
              }

              // Origin allowlist: allow common localhost origins and same-origin over tunnels
              const origin = request.headers['origin'] as string | undefined;
              const allowedOrigins = new Set([
                'http://localhost:3000',
                'http://localhost:3900',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3900',
                'http://localhost:3901',
                'http://127.0.0.1:3901'
              ]);
              let sameOriginOk = false;
              try {
                if (origin && request.headers['host']) {
                  const o = new URL(origin);
                  // Accept when the Origin host matches request Host (e.g., Cloudflare tunnel same-origin)
                  sameOriginOk = o.host === String(request.headers['host']);
                }
              } catch {}
              if (origin && !allowedOrigins.has(origin) && !sameOriginOk) {
                socket.destroy();
                return;
              }

              this.wss!.handleUpgrade(request, socket, head, (ws) => {
                this.wss!.emit('connection', ws, request);
              });
            } catch (e) {
              try { socket.destroy(); } catch {}
            }
          });
        } else {
          // Standalone WebSocket server on its own port for backward compatibility
          this.wss = new WebSocket.Server({ port: this.port });
        }

        this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
          const connectionId = this.generateConnectionId();
          const connection: WebSocketConnection = {
            ws,
            id: connectionId,
            isAlive: true
          };

          this.connections.set(connectionId, connection);
          this._clientCount = this.connections.size;

          console.log(`WebSocket connection established: ${connectionId}`);

          // Send connection confirmation
          ws.send(JSON.stringify({
            type: 'connection_established',
            connectionId,
            timestamp: new Date().toISOString()
          }));

          // Handle pong messages to keep connection alive
          ws.on('pong', () => {
            connection.isAlive = true;
          });

          // Handle incoming messages
          ws.on('message', (data: WebSocket.RawData) => {
            try {
              const message = JSON.parse(data.toString());
              this.handleMessage(connectionId, message);
            } catch (error) {
              console.error('Error parsing message:', error);
            }
          });

          // Handle connection close
          ws.on('close', () => {
            console.log(`WebSocket connection closed: ${connectionId}`);
            // Cleanup any per-client watchers/listeners
            this.services.forEach((service, serviceName) => {
              try {
                service.onClientDisconnect(connectionId);
              } catch (error) {
                console.error(`Error in ${serviceName} service disconnect:`, error);
              }
            });
            this.connections.delete(connectionId);
            this._clientCount = this.connections.size;
          });

          // Handle errors
          ws.on('error', (error) => {
            console.error(`WebSocket error for ${connectionId}:`, error);
            this.connections.delete(connectionId);
            this._clientCount = this.connections.size;
          });
        });

        // In attached mode, consider it started immediately after binding to HTTP server
        if (this._attachedHttpServer) {
          console.log(`WebSocket upgrade handler attached at path ${this._upgradePath} on HTTP port ${this.port}`);
          resolve();
        } else {
          this.wss.on('listening', () => {
            console.log(`WebSocket server listening on port ${this.port}`);
            resolve();
          });
        }

        this.wss.on('error', (error) => {
          console.error('WebSocket server error:', error);
          reject(error);
        });

        // Heartbeat to check connection health
        setInterval(() => {
          this.connections.forEach((connection, id) => {
            if (!connection.isAlive) {
              console.log(`Terminating dead connection: ${id}`);
              connection.ws.terminate();
              this.connections.delete(id);
              this._clientCount = this.connections.size;
              return;
            }

            connection.isAlive = false;
            connection.ws.ping();
          });
        }, 30000); // Check every 30 seconds

      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          console.log('WebSocket server stopped');
          this.connections.clear();
          this.wss = null;
          this._clientCount = 0;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Add missing methods that ServerManager expects
  get port(): number {
    return this._port;
  }

  get clientCount(): number {
    return this._clientCount;
  }

  public broadcastMessage(message: any): number {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.connections.forEach((connection) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(messageStr);
        sentCount++;
      }
    });

    return sentCount;
  }

  public getConnectedClients(): any[] {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      connectedAt: new Date().toISOString()
    }));
  }

  public sendToClient(clientId: string, message: any): boolean {
    const connection = this.connections.get(clientId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      
      // Debug logging for outgoing messages
      if (this.debug) {
        console.log(`🔼 WebSocket Send [${clientId.substring(0, 8)}...]:`, {
          type: message.type,
          payloadSize: messageStr.length,
          messageId: message.id
        });
        
        // Special tracking for terminal frames
        if (message.type === 'terminal') {
          console.log(`📟 Terminal Frame Out [${clientId.substring(0, 8)}...]:`, {
            op: message.data?.op,
            sessionId: message.data?.sessionId,
            payloadSize: messageStr.length
          });
        }
      }
      
      connection.ws.send(messageStr);
      return true;
    }
    return false;
  }

  public forceStateSynchronization(): void {
    // Simple state sync implementation
    this.broadcastMessage({
      type: 'state_sync',
      timestamp: new Date().toISOString()
    });
  }

  public forceClientStateSynchronization(clientId: string): boolean {
    return this.sendToClient(clientId, {
      type: 'state_sync',
      timestamp: new Date().toISOString()
    });
  }

  public getEnhancedClientInfo(): any[] {
    return this.getConnectedClients().map(client => ({
      ...client,
      state: 'active',
      lastActivity: new Date().toISOString()
    }));
  }

  get stateVersion(): number {
    return Date.now(); // Simple version based on timestamp
  }

  get isRunning(): boolean {
    return this._clientCount > 0 || this.wss !== null;
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  public disconnect(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.ws.close(1000, 'Server initiated disconnect');
      this.connections.delete(connectionId);
      console.log(`Disconnected connection: ${connectionId}`);
      return true;
    }
    return false;
  }

  public broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    this.connections.forEach((connection) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(messageStr);
      }
    });
  }

  private handleMessage(connectionId: string, message: any): void {
    // Enhanced debug logging for all WebSocket messages
    if (this.debug) {
      const payloadSize = JSON.stringify(message).length;
      console.log(`🔽 WebSocket Frame [${connectionId.substring(0, 8)}...]:`, {
        type: message.type,
        payloadSize,
        messageId: message.id
      });
      
      // Special tracking for terminal frames
      if (message.type === 'terminal') {
        console.log(`📟 Terminal Frame In [${connectionId.substring(0, 8)}...]:`, {
          op: message.data?.op,
          sessionId: message.data?.sessionId,
          payloadSize
        });
      }
    } else {
      console.log(`Message from ${connectionId}:`, message);
    }

    // Handle ping messages
    if (message.type === 'ping') {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
      }
    }

    // Handle chat messages
    if (message.type === 'chat_message') {
      const chatMessage = {
        type: 'chat_message',
        id: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: message.role || 'user',
        text: message.text || '',
        timestamp: new Date().toISOString(),
        clientTs: message.clientTs || Date.now(),
        senderId: connectionId
      };

      // Broadcast to all connected clients
      this.broadcastMessage(chatMessage);
      console.log(`Broadcasted chat message from ${connectionId}: ${message.text}`);
    }

    // File system protocol
    if (message.type === 'fileSystem') {
      this._fsService.handle(connectionId, message).catch(err => {
        const id = message.id;
        const op = message?.data?.fileSystemData?.operation || 'unknown';
        const errMsg = err instanceof Error ? err.message : String(err);
        this.sendToClient(connectionId, { type: 'fileSystem', id, data: { operation: op, ok: false, error: errMsg } });
      });
    }

    // Git protocol - Route to registered git service
    if (message.type === 'git') {
      const id = message.id;
      const gitService = this.services.get('git');
      
      if (gitService) {
        gitService.handle(connectionId, message)
          .then(result => {
            this.sendToClient(connectionId, { 
              type: 'git', 
              id, 
              data: { 
                gitData: { 
                  operation: message.data?.gitData?.operation || 'unknown',
                  result: result.data 
                }, 
                ok: result.success !== false, 
                error: result.error 
              } 
            });
          })
          .catch(error => {
            const errMsg = error instanceof Error ? error.message : String(error);
            this.sendToClient(connectionId, { 
              type: 'git', 
              id, 
              data: { 
                gitData: { 
                  operation: message.data?.gitData?.operation || 'unknown' 
                }, 
                ok: false, 
                error: errMsg 
              } 
            });
          });
      } else {
        this.sendToClient(connectionId, { 
          type: 'git', 
          id, 
          data: { 
            gitData: { 
              operation: message.data?.gitData?.operation || 'unknown' 
            }, 
            ok: false, 
            error: 'Git service not available' 
          } 
        });
      }
    }

    // VS Code command execution protocol
    if (message.type === 'command') {
      const id = message.id;
      const cmd: string | undefined = message.command || message?.data?.command;
      const args: any[] = (message.args || message?.data?.args || []) as any[];
      if (!cmd) {
        this.sendToClient(connectionId, { type: 'command', id, data: { ok: false, error: 'Missing command id' } });
        return;
      }
      try {
        if (!this._commandHandler) {
          this.sendToClient(connectionId, { type: 'command', id, data: { ok: false, error: 'Command subsystem not available in CLI mode' } });
          return;
        }
        if (this.debug) {
          try { console.log('[WS] Command request', { connection: connectionId.substring(0,8)+'...', cmd, argsLen: Array.isArray(args) ? args.length : 0 }); } catch {}
        }
        this._commandHandler.executeCommand(cmd, args)
          .then((result) => {
            if (this.debug) {
              try { console.log('[WS] Command result', { cmd, ok: result.success, hasData: !!result.data, error: result.error }); } catch {}
            }
            this.sendToClient(connectionId, { type: 'command', id, data: { ok: result.success, result: result.data, error: result.error } });
          })
          .catch((err) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (this.debug) {
              try { console.log('[WS] Command error', { cmd, error: errMsg }); } catch {}
            }
            this.sendToClient(connectionId, { type: 'command', id, data: { ok: false, error: errMsg } });
          });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.sendToClient(connectionId, { type: 'command', id, data: { ok: false, error: errMsg } });
      }
    }

    // Terminal protocol (Stage 1: exec)
    if (message.type === 'terminal') {
      if (this.debug) {
        console.log(`🔄 Processing Terminal Frame [${connectionId.substring(0, 8)}...]:`, {
          op: message.data?.op,
          sessionId: message.data?.sessionId
        });
      }
      
      this._terminalService.handle(connectionId, message).catch(err => {
        const id = message.id;
        const errMsg = err instanceof Error ? err.message : String(err);
        
        if (this.debug) {
          console.log(`❌ Terminal Error [${connectionId.substring(0, 8)}...]:`, {
            error: errMsg,
            messageId: id
          });
        }
        
        this.sendToClient(connectionId, { type: 'terminal', id, data: { ok: false, error: errMsg } });
      });
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Register a service for WebSocket message handling
  public registerService(serviceName: string, registration: ServiceRegistration): void {
    this.services.set(serviceName, registration);
    if (this.debug) {
      console.log(`WebSocketServer: Registered service '${serviceName}'`);
    }
  }

  // Unregister a service
  public unregisterService(serviceName: string): void {
    this.services.delete(serviceName);
    if (this.debug) {
      console.log(`WebSocketServer: Unregistered service '${serviceName}'`);
    }
  }

  // Get registered services
  public getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }
}
