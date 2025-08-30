export class SimpleConnectionService {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isConnected = false

  async initialize(): Promise<void> {
    console.log('Initializing simple connection service')
    await this.connect()
  }

  async connect(): Promise<void> {
    try {
      const wsUrl = this.getWebSocketUrl()
      console.log(`Attempting to connect to ${wsUrl}`)

      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.isConnected = true
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.isConnected = false
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('Received message:', message)
        } catch (error) {
          console.error('Failed to parse message:', error)
        }
      }

    } catch (error) {
      console.error('Connection failed:', error)
      this.scheduleReconnect()
    }
  }

  private getWebSocketUrl(): string {
    // Check if we're running in VS Code webview
    if (typeof window !== 'undefined' && (window as any).vscode) {
      return 'ws://localhost:8081'
    }

    // For development or standalone mode
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = 8081 // Default WebSocket port
    
    return `${protocol}//${host}:${port}`
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect...')
      this.connect()
    }, 3000)
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.isConnected = false
  }

  send(message: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('Cannot send message: WebSocket not connected')
    }
  }
}

export const simpleConnectionService = new SimpleConnectionService()