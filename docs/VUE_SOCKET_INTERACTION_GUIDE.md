# Vue.js Socket Interaction Technical Guide

## Overview

This guide details the technical implementation of Vue.js components and WebSocket communication in the Web Automation Tunnel frontend. It covers the interaction patterns, data flow, and socket management strategies used throughout the application.

## WebSocket Architecture

### Connection Management

#### ConnectionService Class

The `ConnectionService` is a singleton that manages the WebSocket lifecycle:

```typescript
export class ConnectionService {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isInitialized = false
  private isConnected = false
  private connectionUrl = ''
  private eventHandlers: {
    onConnect?: () => void
    onDisconnect?: () => void
    onMessage?: (data: any) => void
    onError?: (error: any) => void
  } = {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    await this.connect()
    this.isInitialized = true
  }

  private getWebSocketUrl(): string {
    // VS Code webview detection
    if (typeof window !== 'undefined' && (window as any).vscode) {
      return `ws://localhost:8081` // Default WebSocket port
    }
    
    // Development/standalone mode
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = parseInt(window.location.port) + 1
    
    return `${protocol}//${host}:${port}`
  }
}
```

#### Connection Store Integration

The Pinia store manages connection state reactively:

```typescript
export const useConnectionStore = defineStore('connection', () => {
  const isConnected = ref(false)
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const latency = ref(0)
  const reconnectAttempts = ref(0)

  const setConnected = (id: string) => {
    isConnected.value = true
    connectionId.value = id
    connectionStatus.value = 'connected'
    lastConnected.value = new Date()
    resetReconnectAttempts()
  }

  const setConnectionStatus = (status: ConnectionStatus, error?: string) => {
    connectionStatus.value = status
    if (error) lastError.value = error
    
    if (status === 'disconnected' || status === 'error') {
      isConnected.value = false
      connectionId.value = null
    }
  }

  return {
    isConnected,
    connectionStatus,
    latency,
    setConnected,
    setConnectionStatus
  }
})
```

### WebSocket Composable

The `useWebSocket` composable provides a reactive interface for WebSocket operations:

```typescript
export function useWebSocket(): WebSocketComposable {
  const socket = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const messageQueue = ref<QueuedMessage[]>([])
  const health = ref<ConnectionHealth>({
    latency: 0,
    lastPingTime: 0,
    lastPongTime: 0,
    isHealthy: true,
    consecutiveFailures: 0
  })

  const connect = async (url: string, config?: Partial<WebSocketConfig>) => {
    currentUrl.value = url
    currentConfig.value = { ...defaultConfig, ...config, url }
    connectionStatus.value = 'connecting'

    socket.value = new WebSocket(url)
    
    socket.value.onopen = () => {
      isConnected.value = true
      connectionStatus.value = 'connected'
      startHealthMonitoring()
      processMessageQueue()
    }

    socket.value.onmessage = event => {
      const message: WebSocketMessage = JSON.parse(event.data)
      handleMessage(message)
    }
  }

  const sendMessage = async (message: WebSocketMessage): Promise<void> => {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      // Queue message for later delivery
      if (messageQueue.value.length < maxQueueSize) {
        messageQueue.value.push({
          message,
          timestamp: Date.now(),
          retryCount: 0
        })
      }
      return
    }

    socket.value.send(JSON.stringify(message))
  }

  return {
    isConnected,
    connectionStatus,
    health,
    connect,
    sendMessage
  }
}
```

## Component-Socket Interaction Patterns

### 1. Command Execution Pattern

Components execute VS Code commands through WebSocket messages:

```typescript
// In a Vue component
<script setup lang="ts">
import { useCommands } from '@/composables/useCommands'

const { executeCommand, isExecuting, lastResult } = useCommands()

const runCommand = async () => {
  try {
    const result = await executeCommand('vscode.workspace.openFolder', ['/path/to/folder'])
    console.log('Command result:', result)
  } catch (error) {
    console.error('Command failed:', error)
  }
}
</script>
```

The `useCommands` composable handles the WebSocket communication:

```typescript
export function useCommands(): CommandsComposable {
  const isExecuting = ref(false)
  const lastResult = ref<CommandResult | null>(null)

  const executeCommand = async (command: string, args?: any[]): Promise<any> => {
    isExecuting.value = true
    
    try {
      const message: WebSocketMessage = {
        type: 'command',
        command,
        args: args || [],
        timestamp: Date.now()
      }

      const result = await connectionService.sendMessageWithResponse(message)
      
      lastResult.value = {
        success: result.success,
        data: result.data,
        error: result.error,
        executionTime: Date.now() - message.timestamp,
        timestamp: Date.now()
      }

      return result.data
    } catch (error) {
      lastResult.value = {
        success: false,
        error: error.message,
        executionTime: 0,
        timestamp: Date.now()
      }
      throw error
    } finally {
      isExecuting.value = false
    }
  }

  return {
    isExecuting,
    lastResult,
    executeCommand
  }
}
```

### 2. File System Operations Pattern

File operations use a dedicated composable with validation:

```typescript
export function useFileSystem(): FileSystemComposable {
  const fileTree = ref<FileTreeState>({
    nodes: new Map(),
    expandedPaths: new Set(),
    selectedPath: null,
    loadingPaths: new Set(),
    rootPaths: []
  })

  const createFile = async (path: string, content = ''): Promise<FileOperationResult> => {
    // Validate file path and name
    const validation = validateFileName(getFileName(path))
    if (!validation.isValid) {
      throw new Error(validation.error)
    }

    const operation: FileOperation = {
      type: 'create',
      path: normalizePath(path),
      content,
      isDirectory: false
    }

    return executeFileOperation(operation)
  }

  const executeFileOperation = async (operation: FileOperation): Promise<FileOperationResult> => {
    const commandMap = {
      create: operation.isDirectory ? 'vscode.workspace.createDirectory' : 'vscode.workspace.createFile',
      delete: 'vscode.workspace.deleteFile',
      rename: 'vscode.workspace.renameFile'
    }

    const result = await connectionService.sendMessageWithResponse({
      type: 'command',
      command: commandMap[operation.type],
      args: [operation.path, operation.content],
      timestamp: Date.now()
    })

    // Update file tree after successful operation
    if (result.success) {
      await refreshFileTree(getParentPath(operation.path))
    }

    return {
      success: result.success,
      operation,
      error: result.error,
      timestamp: new Date()
    }
  }

  return {
    fileTree,
    createFile,
    executeFileOperation
  }
}
```

### 3. Real-time Event Handling Pattern

Components can listen for real-time events from the server:

```typescript
// File watcher component
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useFileSystem } from '@/composables/useFileSystem'

const { onFileChange } = useFileSystem()

onMounted(() => {
  // Listen for file change events
  onFileChange((event: FileWatchEvent) => {
    console.log('File changed:', event)
    
    switch (event.type) {
      case 'created':
        // Handle file creation
        break
      case 'modified':
        // Handle file modification
        break
      case 'deleted':
        // Handle file deletion
        break
    }
  })
})
</script>
```

The composable sets up WebSocket event listeners:

```typescript
export function useFileSystem() {
  const fileChangeCallbacks = ref<Array<(event: FileWatchEvent) => void>>([])

  const onFileChange = (callback: (event: FileWatchEvent) => void): void => {
    fileChangeCallbacks.value.push(callback)
  }

  // Set up WebSocket message handling
  connectionService.onMessage('broadcast', (message: any) => {
    if (message.type === 'broadcast' && message.data?.type === 'fileChange') {
      const event: FileWatchEvent = {
        type: message.data.event.type,
        path: message.data.event.path,
        timestamp: new Date(message.data.event.timestamp)
      }
      
      // Trigger all callbacks
      fileChangeCallbacks.value.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error in file change callback:', error)
        }
      })
    }
  })

  return { onFileChange }
}
```

## Message Protocol Specification

### Message Types

#### 1. Command Messages
Execute VS Code commands or extension operations:

```typescript
interface CommandMessage {
  type: 'command'
  id?: string // Optional for fire-and-forget commands
  command: string // VS Code command name
  args?: any[] // Command arguments
  timestamp: number
}

// Example
{
  type: 'command',
  id: 'cmd_123',
  command: 'vscode.workspace.openFolder',
  args: ['/path/to/folder'],
  timestamp: 1640995200000
}
```

#### 2. Response Messages
Results from command execution:

```typescript
interface ResponseMessage {
  type: 'response'
  id: string // Matches command ID
  success: boolean
  data?: any // Command result data
  error?: string // Error message if failed
  timestamp: number
}

// Example
{
  type: 'response',
  id: 'cmd_123',
  success: true,
  data: { folderPath: '/path/to/folder' },
  timestamp: 1640995201000
}
```

#### 3. Broadcast Messages
Server-initiated notifications:

```typescript
interface BroadcastMessage {
  type: 'broadcast'
  eventType: string // Event category
  data: any // Event-specific data
  timestamp: number
}

// File change example
{
  type: 'broadcast',
  eventType: 'fileChange',
  data: {
    type: 'created',
    path: '/path/to/new/file.txt',
    metadata: { size: 1024, modified: '2023-01-01T00:00:00Z' }
  },
  timestamp: 1640995202000
}
```

#### 4. Health Messages
Connection monitoring:

```typescript
// Ping
{
  type: 'ping',
  timestamp: 1640995203000
}

// Pong
{
  type: 'pong',
  timestamp: 1640995203000 // Original ping timestamp
}
```

### Message Validation

All messages are validated before processing:

```typescript
export function isValidWebSocketMessage(message: any): message is WebSocketMessage {
  if (!message || typeof message !== 'object') return false
  
  if (!message.type || typeof message.type !== 'string') return false
  
  if (!message.timestamp || typeof message.timestamp !== 'number') return false
  
  // Type-specific validation
  switch (message.type) {
    case 'command':
      return typeof message.command === 'string'
    case 'response':
      return typeof message.id === 'string'
    default:
      return true
  }
}
```

## Error Handling in Socket Communication

### Connection Error Recovery

```typescript
export function useWebSocket() {
  const attemptReconnect = (): void => {
    if (reconnectAttempts.value >= maxReconnectAttempts) {
      connectionStatus.value = 'error'
      return
    }

    reconnectAttempts.value++
    connectionStatus.value = 'reconnecting'

    // Exponential backoff with jitter
    const baseInterval = 1000
    const backoffMultiplier = Math.pow(2, reconnectAttempts.value - 1)
    const jitter = Math.random() * 0.3 + 0.85
    const delay = Math.min(baseInterval * backoffMultiplier * jitter, 30000)

    setTimeout(() => {
      if (currentUrl.value) {
        connect(currentUrl.value, currentConfig.value)
      }
    }, delay)
  }
}
```

### Message Error Handling

```typescript
const sendMessageWithResponse = async (message: WebSocketMessage, timeout = 5000): Promise<any> => {
  return new Promise((resolve, reject) => {
    const messageId = generateMessageId()
    message.id = messageId

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      pendingResponses.delete(messageId)
      reject(new Error(`Message timeout after ${timeout}ms`))
    }, timeout)

    // Store pending response handler
    pendingResponses.set(messageId, { resolve, reject, timeout: timeoutHandle })

    // Send message
    try {
      socket.value?.send(JSON.stringify(message))
    } catch (error) {
      clearTimeout(timeoutHandle)
      pendingResponses.delete(messageId)
      reject(error)
    }
  })
}
```

## Performance Optimizations

### Message Queuing

Messages are queued when the connection is unavailable:

```typescript
const messageQueue = ref<QueuedMessage[]>([])
const maxQueueSize = 100

const sendMessage = async (message: WebSocketMessage): Promise<void> => {
  if (!isConnected.value) {
    if (messageQueue.value.length < maxQueueSize) {
      messageQueue.value.push({
        message,
        timestamp: Date.now(),
        retryCount: 0
      })
    } else {
      throw new Error('Message queue is full')
    }
    return
  }

  socket.value?.send(JSON.stringify(message))
}

const processMessageQueue = (): void => {
  const messagesToProcess = [...messageQueue.value]
  messageQueue.value = []

  messagesToProcess.forEach(queuedMessage => {
    try {
      socket.value?.send(JSON.stringify(queuedMessage.message))
    } catch (error) {
      // Re-queue with retry limit
      if (queuedMessage.retryCount < 3) {
        queuedMessage.retryCount++
        messageQueue.value.push(queuedMessage)
      }
    }
  })
}
```

### Connection Health Monitoring

```typescript
const startHealthMonitoring = (): void => {
  // Send periodic pings
  heartbeatTimer.value = setInterval(() => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      const pingMessage: PingMessage = {
        type: 'ping',
        timestamp: Date.now()
      }
      
      health.value.lastPingTime = pingMessage.timestamp
      socket.value.send(JSON.stringify(pingMessage))
    }
  }, 30000) // 30 second intervals

  // Monitor health status
  healthCheckTimer.value = setInterval(() => {
    const now = Date.now()
    const timeSinceLastPong = now - health.value.lastPongTime
    
    if (timeSinceLastPong > 60000) { // 60 seconds
      health.value.consecutiveFailures++
      if (health.value.consecutiveFailures >= 3) {
        health.value.isHealthy = false
      }
    }
  }, 10000) // Check every 10 seconds
}
```

## Component Integration Examples

### File System Menu Component

```vue
<template>
  <div class="file-system-menu">
    <div class="search-bar">
      <input 
        v-model="searchQuery" 
        @input="handleSearch"
        placeholder="Search files..."
      />
    </div>
    
    <div class="file-tree" @contextmenu="handleContextMenu">
      <FileTreeNode
        v-for="node in filteredNodes"
        :key="node.path"
        :node="node"
        :level="0"
        :is-selected="selectedPath === node.path"
        :is-expanded="expandedPaths.has(node.path)"
        @select="selectNode"
        @expand="expandNode"
        @collapse="collapseNode"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useFileSystem } from '@/composables/useFileSystem'
import FileTreeNode from './FileTreeNode.vue'

const {
  fileTree,
  selectedPath,
  expandedPaths,
  loadFileTree,
  selectNode,
  expandNode,
  collapseNode,
  searchFiles
} = useFileSystem()

const searchQuery = ref('')

const filteredNodes = computed(() => {
  if (!searchQuery.value) {
    return Array.from(fileTree.value.nodes.values())
      .filter(node => !node.parent) // Root nodes only
  }
  
  return searchResults.value
})

const handleSearch = debounce(async (query: string) => {
  if (query.length > 2) {
    searchResults.value = await searchFiles({
      query,
      caseSensitive: false,
      maxResults: 100
    })
  }
}, 300)

onMounted(async () => {
  await loadFileTree()
})
</script>
```

### Terminal Component with WebSocket

```vue
<template>
  <div class="terminal-container">
    <div class="terminal-tabs">
      <div 
        v-for="session in sessions"
        :key="session.id"
        :class="{ active: activeSessionId === session.id }"
        @click="switchSession(session.id)"
      >
        {{ session.name }}
      </div>
      <button @click="createNewSession">+</button>
    </div>
    
    <div class="terminal-output" ref="outputContainer">
      <div 
        v-for="output in currentOutput"
        :key="output.id"
        :class="['output-line', output.type]"
      >
        {{ output.content }}
      </div>
    </div>
    
    <div class="terminal-input">
      <input 
        v-model="currentInput"
        @keydown.enter="sendCommand"
        @keydown.up="navigateHistory('up')"
        @keydown.down="navigateHistory('down')"
        placeholder="Enter command..."
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useTerminal } from '@/composables/useTerminal'

const {
  sessions,
  activeSessionId,
  output,
  createSession,
  switchSession,
  sendCommand: sendTerminalCommand,
  getHistory,
  navigateHistory
} = useTerminal()

const currentInput = ref('')
const outputContainer = ref<HTMLElement>()

const currentOutput = computed(() => {
  return activeSessionId.value ? output.value.get(activeSessionId.value) || [] : []
})

const sendCommand = async () => {
  if (!currentInput.value.trim() || !activeSessionId.value) return
  
  await sendTerminalCommand(activeSessionId.value, currentInput.value)
  currentInput.value = ''
  
  // Auto-scroll to bottom
  await nextTick()
  if (outputContainer.value) {
    outputContainer.value.scrollTop = outputContainer.value.scrollHeight
  }
}

const createNewSession = async () => {
  const session = await createSession({
    name: `Terminal ${sessions.value.length + 1}`,
    cwd: process.cwd()
  })
  switchSession(session.id)
}
</script>
```

This comprehensive guide covers the technical implementation details of Vue.js components and WebSocket communication, providing developers with the knowledge needed to understand, maintain, and extend the socket-based interaction patterns in the Web Automation Tunnel frontend.