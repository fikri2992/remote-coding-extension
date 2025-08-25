/**
 * Connection Recovery Service
 * Handles WebSocket reconnection with exponential backoff and connection health monitoring
 */

export class ConnectionRecoveryService {
    constructor(webSocketClient, stateManager, notificationService) {
        this.webSocketClient = webSocketClient;
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // Reconnection configuration
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.baseDelay = 1000; // 1 second
        this.maxDelay = 30000; // 30 seconds
        this.backoffMultiplier = 1.5;
        this.jitterRange = 0.1; // 10% jitter
        
        // Connection health monitoring
        this.connectionHealth = {
            score: 100,
            consecutiveFailures: 0,
            lastSuccessfulConnection: null,
            averageLatency: 0,
            latencyHistory: [],
            maxLatencyHistory: 10
        };
        
        // Recovery state
        this.isRecovering = false;
        this.recoveryStartTime = null;
        this.recoveryTimeout = null;
        this.healthCheckInterval = null;
        
        // Connection quality thresholds
        this.qualityThresholds = {
            excellent: { latency: 50, score: 90 },
            good: { latency: 150, score: 70 },
            fair: { latency: 300, score: 50 },
            poor: { latency: 1000, score: 30 }
        };
        
        // Bind methods
        this.handleConnectionLost = this.handleConnectionLost.bind(this);
        this.handleConnectionRestored = this.handleConnectionRestored.bind(this);
        this.handleLatencyUpdate = this.handleLatencyUpdate.bind(this);
    }

    /**
     * Initialize the connection recovery service
     */
    async initialize() {
        // Set up event listeners
        this.setupEventListeners();
        
        // Start health monitoring
        this.startHealthMonitoring();
        
        console.log('✅ ConnectionRecoveryService initialized');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for connection events
        window.addEventListener('websocket-disconnected', this.handleConnectionLost);
        window.addEventListener('websocket-connected', this.handleConnectionRestored);
        window.addEventListener('websocket-latency', this.handleLatencyUpdate);
        window.addEventListener('reconnect-requested', this.handleManualReconnect.bind(this));
        
        // Listen for network status changes
        window.addEventListener('online', this.handleNetworkOnline.bind(this));
        window.addEventListener('offline', this.handleNetworkOffline.bind(this));
    }    /**

     * Handle connection lost
     */
    handleConnectionLost(event) {
        console.log('🔌 Connection lost, starting recovery process');
        
        // Update connection health
        this.connectionHealth.consecutiveFailures++;
        this.updateConnectionScore();
        
        // Start recovery if not already recovering
        if (!this.isRecovering) {
            this.startRecovery();
        }
    }

    /**
     * Handle connection restored
     */
    handleConnectionRestored(event) {
        console.log('✅ Connection restored');
        
        // Update connection health
        this.connectionHealth.consecutiveFailures = 0;
        this.connectionHealth.lastSuccessfulConnection = new Date();
        this.updateConnectionScore();
        
        // Stop recovery process
        this.stopRecovery();
        
        // Reset reconnection attempts
        this.reconnectAttempts = 0;
        
        // Show success notification
        this.notificationService.success(
            'Connection Restored',
            'Successfully reconnected to the server.',
            { duration: 3000 }
        );
    }

    /**
     * Handle latency updates
     */
    handleLatencyUpdate(event) {
        const latency = event.detail?.latency;
        if (typeof latency === 'number') {
            this.updateLatencyMetrics(latency);
        }
    }

    /**
     * Handle manual reconnection request
     */
    async handleManualReconnect() {
        console.log('🔄 Manual reconnection requested');
        
        if (this.isRecovering) {
            // Reset current recovery and start fresh
            this.stopRecovery();
        }
        
        this.reconnectAttempts = 0;
        await this.attemptReconnection();
    }

    /**
     * Handle network coming online
     */
    handleNetworkOnline() {
        console.log('🌐 Network is back online');
        
        // If we were recovering, try reconnection immediately
        if (this.isRecovering) {
            this.attemptReconnection();
        }
    }

    /**
     * Handle network going offline
     */
    handleNetworkOffline() {
        console.log('🌐 Network went offline');
        
        // Pause recovery attempts while offline
        if (this.recoveryTimeout) {
            clearTimeout(this.recoveryTimeout);
            this.recoveryTimeout = null;
        }
    }

    /**
     * Start recovery process
     */
    startRecovery() {
        if (this.isRecovering) return;
        
        console.log('🔄 Starting connection recovery');
        
        this.isRecovering = true;
        this.recoveryStartTime = Date.now();
        this.reconnectAttempts = 0;
        
        // Update state
        this.stateManager.updateConnection({
            status: 'recovering',
            recoveryStartTime: this.recoveryStartTime
        });
        
        // Show recovery notification
        this.notificationService.warning(
            'Connection Lost',
            'Attempting to reconnect to the server...',
            {
                persistent: true,
                actions: [
                    {
                        label: 'Retry Now',
                        primary: true,
                        handler: () => this.handleManualReconnect()
                    }
                ]
            }
        );
        
        // Start reconnection attempts
        this.attemptReconnection();
    }

    /**
     * Stop recovery process
     */
    stopRecovery() {
        if (!this.isRecovering) return;
        
        console.log('✅ Stopping connection recovery');
        
        this.isRecovering = false;
        this.recoveryStartTime = null;
        
        // Clear recovery timeout
        if (this.recoveryTimeout) {
            clearTimeout(this.recoveryTimeout);
            this.recoveryTimeout = null;
        }
        
        // Update state
        this.stateManager.updateConnection({
            status: 'connected',
            recoveryStartTime: null
        });
    } 
   /**
     * Attempt reconnection with exponential backoff
     */
    async attemptReconnection() {
        // Check if we've exceeded max attempts
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            this.handleMaxAttemptsReached();
            return;
        }
        
        // Check network status
        if (!navigator.onLine) {
            console.log('🌐 Network is offline, waiting for connection');
            this.scheduleReconnection(5000); // Check again in 5 seconds
            return;
        }
        
        this.reconnectAttempts++;
        
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        // Update state
        this.stateManager.updateConnection({
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        });
        
        try {
            // Attempt to reconnect
            await this.webSocketClient.connect();
            
            // If we get here, connection was successful
            console.log('✅ Reconnection successful');
            
        } catch (error) {
            console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error);
            
            // Calculate next retry delay with exponential backoff
            const delay = this.calculateBackoffDelay();
            
            // Schedule next attempt
            this.scheduleReconnection(delay);
        }
    }

    /**
     * Calculate backoff delay with jitter
     */
    calculateBackoffDelay() {
        // Exponential backoff: baseDelay * (backoffMultiplier ^ attempts)
        let delay = this.baseDelay * Math.pow(this.backoffMultiplier, this.reconnectAttempts - 1);
        
        // Cap at maximum delay
        delay = Math.min(delay, this.maxDelay);
        
        // Add jitter to prevent thundering herd
        const jitter = delay * this.jitterRange * (Math.random() * 2 - 1);
        delay += jitter;
        
        // Ensure minimum delay
        delay = Math.max(delay, this.baseDelay);
        
        return Math.round(delay);
    }

    /**
     * Schedule next reconnection attempt
     */
    scheduleReconnection(delay) {
        console.log(`⏰ Next reconnection attempt in ${delay}ms`);
        
        // Clear existing timeout
        if (this.recoveryTimeout) {
            clearTimeout(this.recoveryTimeout);
        }
        
        // Schedule next attempt
        this.recoveryTimeout = setTimeout(() => {
            this.attemptReconnection();
        }, delay);
        
        // Update state with next attempt time
        this.stateManager.updateConnection({
            nextReconnectAttempt: new Date(Date.now() + delay)
        });
    }

    /**
     * Handle max attempts reached
     */
    handleMaxAttemptsReached() {
        console.error('❌ Maximum reconnection attempts reached');
        
        this.stopRecovery();
        
        // Update state
        this.stateManager.updateConnection({
            status: 'failed',
            lastError: 'Maximum reconnection attempts reached'
        });
        
        // Show failure notification
        this.notificationService.error(
            'Connection Failed',
            'Unable to reconnect to the server after multiple attempts. Please check your connection and try again.',
            {
                persistent: true,
                actions: [
                    {
                        label: 'Try Again',
                        primary: true,
                        handler: () => this.handleManualReconnect()
                    },
                    {
                        label: 'Reload Page',
                        handler: () => window.location.reload()
                    }
                ]
            }
        );
    }

    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        // Monitor connection health every 30 seconds
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000);
    }

    /**
     * Perform connection health check
     */
    performHealthCheck() {
        if (!this.webSocketClient.isConnected) {
            return;
        }
        
        // Send ping to measure latency
        const pingStart = Date.now();
        
        this.webSocketClient.sendMessage({
            type: 'ping',
            timestamp: pingStart
        }).then(() => {
            // Ping sent successfully
        }).catch(error => {
            console.warn('Health check ping failed:', error);
            this.connectionHealth.consecutiveFailures++;
            this.updateConnectionScore();
        });
    } 
   /**
     * Update latency metrics
     */
    updateLatencyMetrics(latency) {
        // Add to history
        this.connectionHealth.latencyHistory.push(latency);
        
        // Limit history size
        if (this.connectionHealth.latencyHistory.length > this.connectionHealth.maxLatencyHistory) {
            this.connectionHealth.latencyHistory.shift();
        }
        
        // Calculate average latency
        const sum = this.connectionHealth.latencyHistory.reduce((a, b) => a + b, 0);
        this.connectionHealth.averageLatency = Math.round(sum / this.connectionHealth.latencyHistory.length);
        
        // Update connection score based on latency
        this.updateConnectionScore();
        
        // Update state
        this.stateManager.updateConnection({
            latency,
            averageLatency: this.connectionHealth.averageLatency,
            connectionQuality: this.getConnectionQuality()
        });
    }

    /**
     * Update connection score
     */
    updateConnectionScore() {
        let score = 100;
        
        // Reduce score based on consecutive failures
        score -= this.connectionHealth.consecutiveFailures * 10;
        
        // Reduce score based on average latency
        const avgLatency = this.connectionHealth.averageLatency;
        if (avgLatency > this.qualityThresholds.poor.latency) {
            score -= 30;
        } else if (avgLatency > this.qualityThresholds.fair.latency) {
            score -= 20;
        } else if (avgLatency > this.qualityThresholds.good.latency) {
            score -= 10;
        }
        
        // Ensure score is within bounds
        this.connectionHealth.score = Math.max(0, Math.min(100, score));
        
        // Update state
        this.stateManager.updateConnection({
            connectionHealth: this.connectionHealth.score
        });
    }

    /**
     * Get connection quality based on latency and health score
     */
    getConnectionQuality() {
        const latency = this.connectionHealth.averageLatency;
        const score = this.connectionHealth.score;
        
        if (latency <= this.qualityThresholds.excellent.latency && score >= this.qualityThresholds.excellent.score) {
            return 'excellent';
        } else if (latency <= this.qualityThresholds.good.latency && score >= this.qualityThresholds.good.score) {
            return 'good';
        } else if (latency <= this.qualityThresholds.fair.latency && score >= this.qualityThresholds.fair.score) {
            return 'fair';
        } else {
            return 'poor';
        }
    }

    /**
     * Get recovery statistics
     */
    getRecoveryStatistics() {
        return {
            isRecovering: this.isRecovering,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            recoveryStartTime: this.recoveryStartTime,
            connectionHealth: { ...this.connectionHealth },
            connectionQuality: this.getConnectionQuality(),
            nextReconnectAttempt: this.recoveryTimeout ? 
                new Date(Date.now() + (this.recoveryTimeout._idleTimeout || 0)) : null
        };
    }

    /**
     * Force immediate reconnection
     */
    async forceReconnection() {
        console.log('🔄 Forcing immediate reconnection');
        
        // Disconnect current connection
        if (this.webSocketClient.isConnected) {
            this.webSocketClient.disconnect();
        }
        
        // Reset recovery state
        this.stopRecovery();
        this.reconnectAttempts = 0;
        
        // Start fresh recovery
        this.startRecovery();
    }

    /**
     * Reset connection health
     */
    resetConnectionHealth() {
        this.connectionHealth = {
            score: 100,
            consecutiveFailures: 0,
            lastSuccessfulConnection: new Date(),
            averageLatency: 0,
            latencyHistory: [],
            maxLatencyHistory: 10
        };
        
        this.updateConnectionScore();
    }

    /**
     * Configure recovery parameters
     */
    configureRecovery(options = {}) {
        if (options.maxReconnectAttempts !== undefined) {
            this.maxReconnectAttempts = options.maxReconnectAttempts;
        }
        
        if (options.baseDelay !== undefined) {
            this.baseDelay = options.baseDelay;
        }
        
        if (options.maxDelay !== undefined) {
            this.maxDelay = options.maxDelay;
        }
        
        if (options.backoffMultiplier !== undefined) {
            this.backoffMultiplier = options.backoffMultiplier;
        }
        
        if (options.jitterRange !== undefined) {
            this.jitterRange = options.jitterRange;
        }
        
        console.log('🔧 Connection recovery configured:', {
            maxReconnectAttempts: this.maxReconnectAttempts,
            baseDelay: this.baseDelay,
            maxDelay: this.maxDelay,
            backoffMultiplier: this.backoffMultiplier,
            jitterRange: this.jitterRange
        });
    }

    /**
     * Destroy the connection recovery service
     */
    destroy() {
        // Stop recovery process
        this.stopRecovery();
        
        // Stop health monitoring
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        // Remove event listeners
        window.removeEventListener('websocket-disconnected', this.handleConnectionLost);
        window.removeEventListener('websocket-connected', this.handleConnectionRestored);
        window.removeEventListener('websocket-latency', this.handleLatencyUpdate);
        window.removeEventListener('online', this.handleNetworkOnline);
        window.removeEventListener('offline', this.handleNetworkOffline);
        
        console.log('✅ ConnectionRecoveryService destroyed');
    }
}