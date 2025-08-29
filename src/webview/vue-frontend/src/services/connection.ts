import { useWebSocket } from '../composables/useWebSocket'
import { useConnectionStore } from '../stores/connection'
import { addBreadcrumb, captureError, createAppError } from './error-handler'

export class ConnectionService {
  private webSocket = useWebSocket()
  private connectionStore = useConnectionStore()
  private reconnectTimer: NodeJS.Timeout | null = null
  private isInitialized = false

  /**
   * Initialize the connection service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    addBreadcrumb('connection', 'Initializing connection service', 'info')

    // Set up WebSocket event handlers
    this.setupEventHandlers()

    // Attempt initial connection
    await this.connect()

    this.isInitialized = true
    addBreadcrumb('connection', 'Connection service initialized', 'info')
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    try {
      // Determine WebSocket URL
      const wsUrl = this.getWebSocketUrl()
      addBreadcrumb('connection', `Attempting to connect to ${wsUrl}`, 'info')

      this.connectionStore.setConnectionStatus('connecting')
      
      await this.webSocket.connect(wsUrl, {
        maxReconnectAttempts: 10,
        reconnectInterval: 2000,
        heartbeatInterval: 30000,
        messageTimeout: 15000 // Increase timeout to 15 seconds
      })

      addBreadcrumb('connection', 'WebSocket connection established', 'info')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error'
      addBreadcrumb('connection', `Connection failed: ${errorMessage}`, 'error')
      
      captureError(createAppError(
        `Failed to connect to WebSocket server: ${errorMessage}`,
        'websocket',
        'high',
        { url: this.getWebSocketUrl() },
        {
          title: 'Connection Error',
          message: 'Unable to connect to the VS Code extension server. Some features may not work properly.',
          reportable: true,
          recoveryActions: [
            {
              label: 'Retry Connection',
              action: () => this.connect(),
              primary: true
            },
            {
              label: 'Check Extension Status',
              action: () => {
                // This would open VS Code command palette or show extension status
                console.log('Check if the Web Automation Tunnel extension is running')
              }
            }
          ]
        }
      ))

      this.connectionStore.setConnectionStatus('error', errorMessage)
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    addBreadcrumb('connection', 'Disconnecting from WebSocket server', 'info')
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.webSocket.disconnect()
    this.connectionStore.disconnect()
  }

  /**
   * Get the WebSocket URL
   */
  private getWebSocketUrl(): string {
    // Check if we're running in VS Code webview
    if (typeof window !== 'undefined' && (window as any).vscode) {
      // In VS Code webview, try to connect to localhost
      // The extension should be running the WebSocket server
      const defaultPort = 8081 // Default WebSocket port (HTTP port + 1)
      console.log(`🔌 VS Code webview detected, connecting to ws://localhost:${defaultPort}`)
      return `ws://localhost:${defaultPort}`
    }

    // For development or standalone mode
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = parseInt(window.location.port) + 1 // WebSocket port is typically HTTP port + 1
    
    const url = `${protocol}//${host}:${port}`
    console.log(`🔌 Standalone mode detected, connecting to ${url}`)
    return url
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    // Connection established
    this.webSocket.onConnect(() => {
      addBreadcrumb('connection', 'WebSocket connected successfully', 'info')
      this.connectionStore.setConnected(this.webSocket.getConnectionInfo().url || 'unknown')
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
    })

    // Connection lost
    this.webSocket.onDisconnect(() => {
      addBreadcrumb('connection', 'WebSocket disconnected', 'warning')
      this.connectionStore.setConnectionStatus('disconnected')
      this.scheduleReconnect()
    })

    // Connection error
    this.webSocket.onError((error) => {
      const errorMessage = error.message || 'Unknown WebSocket error'
      addBreadcrumb('connection', `WebSocket error: ${errorMessage}`, 'error')
      
      captureError(createAppError(
        `WebSocket error: ${errorMessage}`,
        'websocket',
        'medium',
        { errorInfo: errorMessage },
        {
          title: 'Connection Issue',
          message: 'There was a problem with the connection to the VS Code extension.',
          reportable: false
        }
      ))

      this.connectionStore.setConnectionStatus('error', errorMessage)
    })

    // Health status changes
    this.webSocket.onHealthChange((health) => {
      this.connectionStore.updateLatency(health.latency)
      
      if (!health.isHealthy) {
        addBreadcrumb('connection', 'Connection health degraded', 'warning', {
          latency: health.latency,
          consecutiveFailures: health.consecutiveFailures
        })
      }
    })

    // Message handling
    this.webSocket.onMessage((message) => {
      // Handle global messages here if needed
      if (message.type === 'status' && message.data?.type === 'serverInfo') {
        addBreadcrumb('connection', 'Received server info', 'info', message.data)
      }
    })
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.connectionStore.canReconnect || this.reconnectTimer) {
      return
    }

    const delay = this.connectionStore.nextReconnectDelay
    addBreadcrumb('connection', `Scheduling reconnect in ${delay}ms`, 'info')

    this.connectionStore.incrementReconnectAttempts()
    this.connectionStore.setConnectionStatus('reconnecting')

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  /**
   * Get the WebSocket instance for direct use
   */
  getWebSocket() {
    return this.webSocket
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.webSocket.isConnected.value
  }

  /**
   * Get connection status
   */
  get connectionStatus() {
    return this.connectionStore.connectionStatus
  }
}

// Create singleton instance
export const connectionService = new ConnectionService()