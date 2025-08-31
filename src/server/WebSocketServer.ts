import WebSocket from 'ws';
import { IncomingMessage } from 'http';

export interface WebSocketConnection {
  ws: WebSocket;
  id: string;
  isAlive: boolean;
}

export class WebSocketServer {
  private wss: WebSocket.Server | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private port: number;

  constructor(port: number = 8080) {
    this.port = port;
  }

  public start(): void {
    this.wss = new WebSocket.Server({ port: this.port });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const connectionId = this.generateConnectionId();
      const connection: WebSocketConnection = {
        ws,
        id: connectionId,
        isAlive: true
      };

      this.connections.set(connectionId, connection);

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
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${connectionId}:`, error);
        this.connections.delete(connectionId);
      });
    });

    this.wss.on('listening', () => {
      console.log(`WebSocket server listening on port ${this.port}`);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    // Heartbeat to check connection health
    setInterval(() => {
      this.connections.forEach((connection, id) => {
        if (!connection.isAlive) {
          console.log(`Terminating dead connection: ${id}`);
          connection.ws.terminate();
          this.connections.delete(id);
          return;
        }

        connection.isAlive = false;
        connection.ws.ping();
      });
    }, 30000); // Check every 30 seconds
  }

  public stop(): void {
    if (this.wss) {
      this.wss.close(() => {
        console.log('WebSocket server stopped');
      });
      this.connections.clear();
      this.wss = null;
    }
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
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
