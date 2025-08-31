import { addBreadcrumb, captureError, createAppError } from './error-handler'

export class ConnectionService {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isInitialized = false
  private isConnected = false
  private connectionUrl = ''
  private hasShownConnectionError = false // Track if we've already shown the connection error
  private eventHandlers: {
    onConnect?: () => void
    onDisconnect?: () => void
    onMessage?: (data: any) => void
    onError?: (error: any) => void
  } = {}

  /**
   * Set event handlers
   */
  public setEventHandlers(handlers: {
    onConnect?: () => void
    onDisconnect?: () => void
    onMessage?: (data: any) => void
    onError?: (error: any) => void
  }) {
    this.eventHandlers = handlers
  }

  /**
   * Initialize the connection service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    addBreadcrumb('connection', 'Initializing connection service', 'info')

    // Don't automatically connect - let users connect manually
    // await this.connect()

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
      this.connectionUrl = wsUrl
      addBreadcrumb('connection', `Attempting to connect to ${wsUrl}`, 'info')

      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        this.isConnected = true
        this.hasShownConnectionError = false // Reset error flag on successful connection
        addBreadcrumb('connection', 'WebSocket connection established', 'info')
        this.eventHandlers.onConnect?.()
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onclose = () => {
        this.isConnected = false
        addBreadcrumb('connection', 'WebSocket disconnected', 'warning')
        this.eventHandlers.onDisconnect?.()
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        addBreadcrumb('connection', `WebSocket error: ${error}`, 'error')
        this.eventHandlers.onError?.(error)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.eventHandlers.onMessage?.(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error'
      addBreadcrumb('connection', `Connection failed: ${errorMessage}`, 'error')
      
      // Only show the error notification once, not on every retry
      if (!this.hasShownConnectionError) {
        this.hasShownConnectionError = true
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
                  console.log('Check if the Web Automation Tunnel extension is running')
                }
              }
            ]
          }
        ))
      }

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

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.isConnected = false
    this.hasShownConnectionError = false // Reset error flag on manual disconnect
  }

  /**
   * Send message through WebSocket
   */
  send(message: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('Cannot send message: WebSocket not connected')
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      url: this.connectionUrl
    }
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
      return `ws://localhost:${defaultPort}`
    }

    // For development or standalone mode
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = parseInt(window.location.port) + 1 // WebSocket port is typically HTTP port + 1
    
    return `${protocol}//${host}:${port}`
  }



  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return
    }

    const delay = 3000 // 3 seconds
    addBreadcrumb('connection', `Scheduling reconnect in ${delay}ms`, 'info')

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  /**
   * Subscribe to messages of a specific type
   */
  onMessage(type: string, callback: (message: any) => void) {
    const originalHandler = this.eventHandlers.onMessage
    this.eventHandlers.onMessage = (message) => {
      originalHandler?.(message)
      if (message.type === type) {
        callback(message)
      }
    }
  }

  /**
   * Get the WebSocket instance for direct use
   */
  getWebSocket() {
    return this.ws
  }




}

// Create singleton instance
export const connectionService = new ConnectionService()