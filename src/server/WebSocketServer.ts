import WebSocket from 'ws';
import { IncomingMessage, Server as HttpServer } from 'http';
import { Socket } from 'net';

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

  constructor(config: any, attachedHttpServer?: HttpServer, upgradePath: string = '/ws') {
    // Handle both number and config object
    if (typeof config === 'number') {
      this._port = config;
    } else {
      this._port = (attachedHttpServer ? config.httpPort : (config.websocketPort || config.httpPort + 1));
    }
    this._attachedHttpServer = attachedHttpServer || null;
    this._upgradePath = upgradePath;
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

              // Basic origin allowlist similar to HttpServer
              const origin = request.headers['origin'] as string | undefined;
              const allowedOrigins = new Set([
                'http://localhost:3000',
                'http://localhost:8080',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:8080',
                'http://localhost:8081',
                'http://127.0.0.1:8081'
              ]);
              if (origin && !allowedOrigins.has(origin)) {
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
      connection.ws.send(JSON.stringify(message));
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
    console.log(`Message from ${connectionId}:`, message);

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
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
