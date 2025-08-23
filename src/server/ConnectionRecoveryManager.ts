/**
 * ConnectionRecoveryManager - Handles WebSocket connection recovery and resilience
 */

import { WebSocket } from 'ws';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Connection state tracking
 */
export enum ConnectionState {
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    RECONNECTING = 'reconnecting',
    FAILED = 'failed'
}

/**
 * Recovery configuration
 */
export interface RecoveryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitterEnabled: boolean;
    healthCheckInterval: number;
}

/**
 * Connection health metrics
 */
export interface ConnectionHealth {
    clientId: string;
    state: ConnectionState;
    lastSeen: Date;
    reconnectAttempts: number;
    totalDisconnections: number;
    averageLatency: number;
    isHealthy: boolean;
}

/**
 * Recovery event callbacks
 */
export interface RecoveryCallbacks {
    onStateChange?: (clientId: string, oldState: ConnectionState, newState: ConnectionState) => void;
    onRecoveryAttempt?: (clientId: string, attempt: number, maxAttempts: number) => void;
    onRecoverySuccess?: (clientId: string, attempts: number) => void;
    onRecoveryFailed?: (clientId: string, finalError: Error) => void;
    onHealthCheck?: (clientId: string, health: ConnectionHealth) => void;
}

/**
 * Client connection tracking
 */
interface ClientConnection {
    id: string;
    ws: WebSocket;
    state: ConnectionState;
    health: ConnectionHealth;
    recoveryTimer?: NodeJS.Timeout;
    healthCheckTimer?: NodeJS.Timeout;
    lastPingTime?: Date;
    lastPongTime?: Date;
}

/**
 * Manages connection recovery and health monitoring for WebSocket clients
 */
export class ConnectionRecoveryManager {
    private clients: Map<string, ClientConnection> = new Map();
    private config: RecoveryConfig;
    private callbacks: RecoveryCallbacks;
    private errorHandler: ErrorHandler;
    private globalHealthCheckTimer?: NodeJS.Timeout;

    constructor(config?: Partial<RecoveryConfig>, callbacks?: RecoveryCallbacks) {
        this.config = {
            maxRetries: 5,
            initialDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 2,
            jitterEnabled: true,
            healthCheckInterval: 30000,
            ...config
        };
        
        this.callbacks = callbacks || {};
        this.errorHandler = ErrorHandler.getInstance();
        
        this.startGlobalHealthCheck();
    }

    /**
     * Register a new client connection
     */
    registerClient(clientId: string, ws: WebSocket): void {
        const health: ConnectionHealth = {
            clientId,
            state: ConnectionState.CONNECTED,
            lastSeen: new Date(),
            reconnectAttempts: 0,
            totalDisconnections: 0,
            averageLatency: 0,
            isHealthy: true
        };

        const client: ClientConnection = {
            id: clientId,
            ws,
            state: ConnectionState.CONNECTED,
            health
        };

        this.clients.set(clientId, client);
        this.setupClientMonitoring(client);
        
        console.log(`Connection recovery manager: registered client ${clientId}`);
    }

    /**
     * Unregister a client connection
     */
    unregisterClient(clientId: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            this.cleanupClient(client);
            this.clients.delete(clientId);
            console.log(`Connection recovery manager: unregistered client ${clientId}`);
        }
    }

    /**
     * Handle client disconnection with recovery attempt
     */
    async handleDisconnection(clientId: string, error?: Error): Promise<void> {
        const client = this.clients.get(clientId);
        if (!client) {
            return;
        }

        // Update state and health
        this.updateClientState(client, ConnectionState.DISCONNECTED);
        client.health.totalDisconnections++;
        client.health.lastSeen = new Date();
        client.health.isHealthy = false;

        // Log the disconnection
        const errorInfo = this.errorHandler.createError(
            'CLIENT_DISCONNECTED',
            `Client ${clientId} disconnected${error ? `: ${error.message}` : ''}`,
            ErrorCategory.CLIENT_CONNECTION,
            ErrorSeverity.LOW,
            { clientId, error: error?.message }
        );

        await this.errorHandler.handleError(errorInfo, {
            reconnectClient: () => this.attemptReconnection(client)
        });

        // Start recovery process if not already in progress
        if (!client.recoveryTimer) {
            this.scheduleReconnection(client);
        }
    }

    /**
     * Schedule reconnection attempt with exponential backoff
     */
    private scheduleReconnection(client: ClientConnection): void {
        if (client.health.reconnectAttempts >= this.config.maxRetries) {
            this.handleRecoveryFailure(client);
            return;
        }

        const attempt = client.health.reconnectAttempts + 1;
        const delay = this.calculateBackoffDelay(attempt);

        this.updateClientState(client, ConnectionState.RECONNECTING);
        
        console.log(`Scheduling reconnection for client ${client.id}, attempt ${attempt}/${this.config.maxRetries} in ${delay}ms`);
        
        this.callbacks.onRecoveryAttempt?.(client.id, attempt, this.config.maxRetries);

        client.recoveryTimer = setTimeout(async () => {
            client.recoveryTimer = undefined;
            client.health.reconnectAttempts = attempt;
            
            const success = await this.attemptReconnection(client);
            if (!success) {
                this.scheduleReconnection(client);
            }
        }, delay);
    }

    /**
     * Calculate exponential backoff delay with jitter
     */
    private calculateBackoffDelay(attempt: number): number {
        const baseDelay = Math.min(
            this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
            this.config.maxDelay
        );

        if (this.config.jitterEnabled) {
            // Add ±25% jitter to prevent thundering herd
            const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
            return Math.max(100, baseDelay + jitter);
        }

        return baseDelay;
    }

    /**
     * Attempt to reconnect a client
     */
    private async attemptReconnection(client: ClientConnection): Promise<boolean> {
        try {
            // This is a placeholder for actual reconnection logic
            // In practice, this would involve creating a new WebSocket connection
            // For now, we'll simulate the reconnection process
            
            console.log(`Attempting reconnection for client ${client.id}`);
            
            // Simulate connection attempt (in real implementation, this would create new WebSocket)
            const reconnected = await this.simulateReconnection(client);
            
            if (reconnected) {
                this.handleRecoverySuccess(client);
                return true;
            } else {
                throw new Error('Reconnection failed');
            }
            
        } catch (error) {
            console.error(`Reconnection failed for client ${client.id}:`, error);
            
            const errorInfo = this.errorHandler.createError(
                'RECONNECTION_FAILED',
                `Failed to reconnect client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCategory.CLIENT_CONNECTION,
                ErrorSeverity.MEDIUM,
                { clientId: client.id, attempt: client.health.reconnectAttempts }
            );
            
            await this.errorHandler.handleError(errorInfo, null, false);
            return false;
        }
    }

    /**
     * Simulate reconnection (placeholder for actual implementation)
     */
    private async simulateReconnection(client: ClientConnection): Promise<boolean> {
        // In a real implementation, this would:
        // 1. Create a new WebSocket connection
        // 2. Set up event handlers
        // 3. Send authentication/handshake messages
        // 4. Update the client's WebSocket reference
        
        // For now, we'll just simulate success/failure
        return Math.random() > 0.3; // 70% success rate for simulation
    }

    /**
     * Handle successful recovery
     */
    private handleRecoverySuccess(client: ClientConnection): void {
        const attempts = client.health.reconnectAttempts;
        
        // Reset recovery state
        client.health.reconnectAttempts = 0;
        client.health.isHealthy = true;
        client.health.lastSeen = new Date();
        
        this.updateClientState(client, ConnectionState.CONNECTED);
        
        console.log(`Client ${client.id} reconnected successfully after ${attempts} attempts`);
        this.callbacks.onRecoverySuccess?.(client.id, attempts);
        
        // Restart health monitoring
        this.setupClientMonitoring(client);
    }

    /**
     * Handle recovery failure after max attempts
     */
    private handleRecoveryFailure(client: ClientConnection): void {
        this.updateClientState(client, ConnectionState.FAILED);
        
        const finalError = new Error(`Failed to reconnect client ${client.id} after ${this.config.maxRetries} attempts`);
        
        console.error(`Recovery failed for client ${client.id} after ${this.config.maxRetries} attempts`);
        this.callbacks.onRecoveryFailed?.(client.id, finalError);
        
        // Log critical error
        const errorInfo = this.errorHandler.createError(
            'RECOVERY_FAILED',
            `Client ${client.id} recovery failed after ${this.config.maxRetries} attempts`,
            ErrorCategory.CLIENT_CONNECTION,
            ErrorSeverity.HIGH,
            { clientId: client.id, maxRetries: this.config.maxRetries }
        );
        
        this.errorHandler.handleError(errorInfo, null, false);
        
        // Clean up the client after a delay
        setTimeout(() => {
            this.unregisterClient(client.id);
        }, 60000); // Remove after 1 minute
    }

    /**
     * Setup health monitoring for a client
     */
    private setupClientMonitoring(client: ClientConnection): void {
        // Clear existing timer
        if (client.healthCheckTimer) {
            clearTimeout(client.healthCheckTimer);
        }

        // Setup ping/pong monitoring
        this.setupPingPong(client);
        
        // Schedule periodic health checks
        client.healthCheckTimer = setInterval(() => {
            this.performHealthCheck(client);
        }, this.config.healthCheckInterval);
    }

    /**
     * Setup ping/pong for connection health monitoring
     */
    private setupPingPong(client: ClientConnection): void {
        if (client.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        // Send ping and measure latency
        client.lastPingTime = new Date();
        
        client.ws.ping();
        
        client.ws.once('pong', () => {
            client.lastPongTime = new Date();
            if (client.lastPingTime) {
                const latency = client.lastPongTime.getTime() - client.lastPingTime.getTime();
                client.health.averageLatency = (client.health.averageLatency + latency) / 2;
            }
        });
    }

    /**
     * Perform health check on a client
     */
    private performHealthCheck(client: ClientConnection): void {
        const now = new Date();
        const timeSinceLastSeen = now.getTime() - client.health.lastSeen.getTime();
        
        // Check if client is responsive
        const isResponsive = timeSinceLastSeen < this.config.healthCheckInterval * 2;
        const wasHealthy = client.health.isHealthy;
        
        client.health.isHealthy = isResponsive && client.ws.readyState === WebSocket.OPEN;
        
        // If health status changed, notify
        if (wasHealthy !== client.health.isHealthy) {
            console.log(`Client ${client.id} health changed: ${wasHealthy ? 'healthy' : 'unhealthy'} -> ${client.health.isHealthy ? 'healthy' : 'unhealthy'}`);
        }
        
        this.callbacks.onHealthCheck?.(client.id, { ...client.health });
        
        // If client is unhealthy and connected, consider it for recovery
        if (!client.health.isHealthy && client.state === ConnectionState.CONNECTED) {
            this.handleDisconnection(client.id, new Error('Health check failed'));
        }
        
        // Send ping for next health check
        if (client.health.isHealthy) {
            this.setupPingPong(client);
        }
    }

    /**
     * Update client state and notify callbacks
     */
    private updateClientState(client: ClientConnection, newState: ConnectionState): void {
        const oldState = client.state;
        client.state = newState;
        client.health.state = newState;
        
        if (oldState !== newState) {
            this.callbacks.onStateChange?.(client.id, oldState, newState);
        }
    }

    /**
     * Start global health monitoring
     */
    private startGlobalHealthCheck(): void {
        this.globalHealthCheckTimer = setInterval(() => {
            this.performGlobalHealthCheck();
        }, this.config.healthCheckInterval);
    }

    /**
     * Perform global health check across all clients
     */
    private performGlobalHealthCheck(): void {
        const totalClients = this.clients.size;
        const healthyClients = Array.from(this.clients.values()).filter(c => c.health.isHealthy).length;
        const reconnectingClients = Array.from(this.clients.values()).filter(c => c.state === ConnectionState.RECONNECTING).length;
        
        console.log(`Global health check: ${healthyClients}/${totalClients} healthy, ${reconnectingClients} reconnecting`);
        
        // Check for system-wide issues
        if (totalClients > 0 && healthyClients / totalClients < 0.5) {
            console.warn('System-wide connection issues detected - less than 50% of clients are healthy');
        }
    }

    /**
     * Clean up client resources
     */
    private cleanupClient(client: ClientConnection): void {
        if (client.recoveryTimer) {
            clearTimeout(client.recoveryTimer);
            client.recoveryTimer = undefined;
        }
        
        if (client.healthCheckTimer) {
            clearInterval(client.healthCheckTimer);
            client.healthCheckTimer = undefined;
        }
    }

    /**
     * Get health status for all clients
     */
    getAllClientHealth(): ConnectionHealth[] {
        return Array.from(this.clients.values()).map(client => ({ ...client.health }));
    }

    /**
     * Get health status for specific client
     */
    getClientHealth(clientId: string): ConnectionHealth | null {
        const client = this.clients.get(clientId);
        return client ? { ...client.health } : null;
    }

    /**
     * Force reconnection for a specific client
     */
    async forceReconnection(clientId: string): Promise<boolean> {
        const client = this.clients.get(clientId);
        if (!client) {
            return false;
        }

        // Cancel existing recovery if in progress
        if (client.recoveryTimer) {
            clearTimeout(client.recoveryTimer);
            client.recoveryTimer = undefined;
        }

        // Reset attempts and try reconnection
        client.health.reconnectAttempts = 0;
        return await this.attemptReconnection(client);
    }

    /**
     * Update recovery configuration
     */
    updateConfig(newConfig: Partial<RecoveryConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('Connection recovery configuration updated:', this.config);
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        // Clean up all clients
        for (const client of this.clients.values()) {
            this.cleanupClient(client);
        }
        this.clients.clear();
        
        // Stop global health check
        if (this.globalHealthCheckTimer) {
            clearInterval(this.globalHealthCheckTimer);
            this.globalHealthCheckTimer = undefined;
        }
        
        console.log('Connection recovery manager disposed');
    }
}