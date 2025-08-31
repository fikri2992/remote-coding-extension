import { addBreadcrumb, captureError, createAppError } from './error-handler'

export class ConnectionService {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isInitialized = false
  private isConnected = false
  private connectionUrl = ''
  private hasShownConnectionError = false // Track if we've already shown the connection error
  private connectionAttempts = 0
  private maxConnectionAttempts = 3
  private isManualConnection = false // Track if connection was initiated manually
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
  async connect(isManual = false): Promise<void> {
    this.isManualConnection = isManual
    this.connectionAttempts++
    
    try {
      // Determine WebSocket URL
      const wsUrl = this.getWebSocketUrl()
      this.connectionUrl = wsUrl
      addBreadcrumb('connection', `Attempting to connect to ${wsUrl} (attempt ${this.connectionAttempts})`, 'info')

      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        this.isConnected = true
        this.hasShownConnectionError = false // Reset error flag on successful connection
        this.connectionAttempts = 0 // Reset attempts on successful connection
        addBreadcrumb('connection', 'WebSocket connection established', 'info')
        this.eventHandlers.onConnect?.()
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onclose = (event) => {
        this.isConnected = false
        addBreadcrumb('connection', `WebSocket disconnected (code: ${event.code})`, 'warning')
        this.eventHandlers.onDisconnect?.()
        
        // Only auto-reconnect if it was a manual connection or if we haven't exceeded max attempts
        if (this.isManualConnection && this.connectionAttempts < this.maxConnectionAttempts) {
          this.scheduleReconnect()
        }
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
      
      // Only show error notification for manual connections or first automatic attempt
      if ((this.isManualConnection || this.connectionAttempts === 1) && !this.hasShownConnectionError) {
        this.hasShownConnectionError = true
        captureError(createAppError(
          `Failed to connect to WebSocket server: ${errorMessage}`,
          'websocket',
          'medium', // Reduced from 'high' to allow throttling
          { 
            url: this.getWebSocketUrl(),
            additionalData: {
              attempt: this.connectionAttempts,
              isManual: this.isManualConnection
            }
          },
          {
            title: 'Connection Error',
            message: this.isManualConnection 
              ? 'Unable to connect to the VS Code extension server. Please ensure the extension is running.'
              : 'Unable to connect to the VS Code extension server. Some features may not work properly.',
            reportable: true,
            recoveryActions: [
              {
                label: 'Retry Connection',
                action: () => this.connect(true),
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

      // Only schedule reconnect for manual connections and within attempt limits
      if (this.isManualConnection && this.connectionAttempts < this.maxConnectionAttempts) {
        this.scheduleReconnect()
      }
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
    this.connectionAttempts = 0 // Reset attempts on manual disconnect
    this.isManualConnection = false // Reset manual flag
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
      url: this.connectionUrl,
      attempts: this.connectionAttempts,
      maxAttempts: this.maxConnectionAttempts,
      isManual: this.isManualConnection
    }
  }

  /**
   * Reset connection state (useful for manual retry)
   */
  resetConnectionState(): void {
    this.hasShownConnectionError = false
    this.connectionAttempts = 0
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
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
    if (this.reconnectTimer || this.connectionAttempts >= this.maxConnectionAttempts) {
      return
    }

    // Exponential backoff: 3s, 6s, 12s
    const delay = Math.min(3000 * Math.pow(2, this.connectionAttempts - 1), 12000)
    addBreadcrumb('connection', `Scheduling reconnect in ${delay}ms (attempt ${this.connectionAttempts + 1}/${this.maxConnectionAttempts})`, 'info')

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(this.isManualConnection)
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