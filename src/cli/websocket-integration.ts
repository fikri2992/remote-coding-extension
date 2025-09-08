/**
 * WebSocket Integration for CLI File System Service
 */

import { CLIFileSystemService } from './services/FileSystemService';
import { FileSystemConfigManager } from './services/FileSystemConfig';
import { WebSocketServer, WebSocket } from 'ws';

export class FileSystemWebSocketIntegration {
  private wsServer: WebSocketServer;
  private fsService: CLIFileSystemService;
  private clientConnections: Map<string, WebSocket> = new Map();

  constructor(wsServer: WebSocketServer, config?: any) {
    this.wsServer = wsServer;
    const fsConfig = new FileSystemConfigManager(undefined, config);
    this.fsService = new CLIFileSystemService(this.sendToClient.bind(this), fsConfig.config);
    
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.wsServer.on('connection', (ws: WebSocket, req) => {
      // Extract client ID from request or generate one
      const clientId = this.extractClientId(req) || this.generateClientId();
      
      console.log(`🔗 Client connected: ${clientId}`);
      this.clientConnections.set(clientId, ws);

      // Handle incoming messages
      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
          this.sendError(clientId, 'Invalid message format');
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.clientConnections.delete(clientId);
        this.fsService.onClientDisconnect(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for client ${clientId}:`, error);
        this.clientConnections.delete(clientId);
        this.fsService.onClientDisconnect(clientId);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        id: 'welcome',
        data: {
          clientId,
          message: 'Connected to File System Service',
          timestamp: Date.now()
        }
      });
    });

    // Handle server errors
    this.wsServer.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });
  }

  private extractClientId(req: any): string | null {
    // Try to extract client ID from query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('clientId');
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async handleClientMessage(clientId: string, message: any): Promise<void> {
    try {
      // Handle file system messages
      if (message.type === 'fileSystem' || message.data?.fileSystemData) {
        await this.fsService.handle(clientId, message);
      }
      // Handle ping/pong for connection health
      else if (message.type === 'ping') {
        this.sendToClient(clientId, {
          type: 'pong',
          id: message.id,
          data: {
            timestamp: Date.now()
          }
        });
      }
      // Handle configuration updates
      else if (message.type === 'config') {
        this.handleConfigMessage(clientId, message);
      }
      // Handle unknown message types
      else {
        console.warn(`⚠️ Unknown message type from client ${clientId}:`, message.type);
        this.sendError(clientId, 'Unknown message type', message.id);
      }
    } catch (error) {
      console.error(`❌ Error handling message from client ${clientId}:`, error);
      this.sendError(clientId, 'Internal server error', message.id);
    }
  }

  private handleConfigMessage(clientId: string, message: any): void {
    const { operation, ...config } = message.data || {};
    
    try {
      switch (operation) {
        case 'get':
          this.sendToClient(clientId, {
            type: 'config',
            id: message.id,
            data: {
              operation: 'get',
              config: this.fsService.getConfig()
            }
          });
          break;
          
        case 'update':
          this.fsService.updateConfig(config);
          this.sendToClient(clientId, {
            type: 'config',
            id: message.id,
            data: {
              operation: 'update',
              success: true
            }
          });
          break;
          
        default:
          this.sendError(clientId, 'Unknown config operation', message.id);
      }
    } catch (error) {
      this.sendError(clientId, 'Failed to handle config operation', message.id);
    }
  }

  private sendToClient(clientId: string, message: any): boolean {
    const ws = this.clientConnections.get(clientId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ Cannot send message to client ${clientId}: WebSocket not open`);
      return false;
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message to client ${clientId}:`, error);
      return false;
    }
  }

  private sendError(clientId: string, error: string, messageId?: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      id: messageId,
      data: {
        error,
        timestamp: Date.now()
      }
    });
  }

  // Public API methods

  getConnectedClients(): string[] {
    return Array.from(this.clientConnections.keys());
  }

  getClientCount(): number {
    return this.clientConnections.size;
  }

  getFileSystemService(): CLIFileSystemService {
    return this.fsService;
  }

  broadcast(message: any, excludeClientId?: string): number {
    let sentCount = 0;
    
    for (const [clientId, ws] of this.clientConnections) {
      if (clientId !== excludeClientId && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`❌ Failed to broadcast to client ${clientId}:`, error);
        }
      }
    }
    
    return sentCount;
  }

  shutdown(): void {
    console.log('🛑 Shutting down FileSystem WebSocket integration...');
    
    // Close all client connections
    for (const [clientId, ws] of this.clientConnections) {
      try {
        ws.close(1000, 'Server shutting down');
        this.fsService.onClientDisconnect(clientId);
      } catch (error) {
        console.error(`❌ Error closing client ${clientId}:`, error);
      }
    }
    
    this.clientConnections.clear();
    
    // Cleanup file system service
    this.fsService.cleanup();
    
    console.log('✅ FileSystem WebSocket integration shutdown complete');
  }

  // Helper method to get server statistics
  getStats() {
    const watcherStats = this.fsService.getWatcherStats();
    
    return {
      websocket: {
        connectedClients: this.getClientCount(),
        clientIds: this.getConnectedClients()
      },
      filesystem: {
        watchers: watcherStats,
        config: this.fsService.getConfig()
      },
      timestamp: Date.now()
    };
  }
}
