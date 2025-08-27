# Component API and Composable Reference

## Overview

This document provides comprehensive API documentation for all Vue.js components and composables in the frontend application. Each section includes usage examples, type definitions, and best practices.

## Composables API

### useWebSocket

Manages WebSocket connections and real-time communication with the VS Code extension.

#### Interface

```typescript
interface WebSocketComposable {
  // Reactive State
  isConnected: Ref<boolean>
  connectionStatus: Ref<'disconnected' | 'connecting' | 'connected' | 'error'>
  lastMessage: Ref<WebSocketMessage | null>
  messageQueue: Ref<WebSocketMessage[]>
  latency: Ref<number>
  
  // Methods
  connect: (url: string) => Promise<void>
  disconnect: () => void
  sendMessage: (message: WebSocketMessage) => Promise<void>
  
  // Event Handlers
  onMessage: (callback: (message: WebSocketMessage) => void) => void
  onConnect: (callback: () => void) => void
  onDisconnect: (callback: (reason: string) => void) => void
  onError: (callback: (error: Error) => void) => void
}
```

#### Usage Example

```typescript
import { useWebSocket } from '@/composables/useWebSocket'

export default defineComponent({
  setup() {
    const {
      isConnected,
      connectionStatus,
      connect,
      disconnect,
      sendMessage,
      onMessage
    } = useWebSocket()
    
    // Connect on component mount
    onMounted(async () => {
      await connect('ws://localhost:3001')
    })
    
    // Handle incoming messages
    onMessage((message) => {
      if (message.type === 'response') {
        console.log('Received response:', message.data)
      }
    })
    
    // Send a command
    const executeCommand = async (command: string, args: any[] = []) => {
      await sendMessage({
        type: 'command',
        command,
        args,
        timestamp: Date.now()
      })
    }
    
    return {
      isConnected,
      connectionStatus,
      executeCommand,
      disconnect
    }
  }
})
```

#### Configuration Options

```typescript
interface WebSocketConfig {
  reconnectAttempts?: number // Default: 5
  reconnectDelay?: number    // Default: 1000ms
  heartbeatInterval?: number // Default: 30000ms
  messageTimeout?: number    // Default: 10000ms
}
```

### useCommands

Handles VS Code command execution and management.

#### Interface

```typescript
interface CommandsComposable {
  // Reactive State
  isExecuting: Ref<boolean>
  lastResult: Ref<any>
  commandHistory: Ref<CommandHistoryItem[]>
  availableCommands: Ref<string[]>
  favorites: Ref<string[]>
  
  // Methods
  executeCommand: (command: string, args?: any[]) => Promise<any>
  getAvailableCommands: () => Promise<string[]>
  addToFavorites: (command: string) => void
  removeFromFavorites: (command: string) => void
  clearHistory: () => void
  
  // Quick Commands
  openFile: (path: string) => Promise<void>
  saveFile: () => Promise<void>
  formatDocument: () => Promise<void>
  showQuickPick: (items: string[]) => Promise<string | undefined>
}
```

#### Usage Example

```typescript
import { useCommands } from '@/composables/useCommands'

export default defineComponent({
  setup() {
    const {
      isExecuting,
      lastResult,
      commandHistory,
      executeCommand,
      addToFavorites,
      openFile
    } = useCommands()
    
    const handleCommandExecution = async (command: string) => {
      try {
        const result = await executeCommand(command)
        console.log('Command result:', result)
      } catch (error) {
        console.error('Command failed:', error)
      }
    }
    
    const openSpecificFile = async () => {
      await openFile('/workspace/src/main.ts')
    }
    
    return {
      isExecuting,
      commandHistory,
      handleCommandExecution,
      openSpecificFile,
      addToFavorites
    }
  }
})
```

### useFileSystem

Manages file system operations and file tree navigation.

#### Interface

```typescript
interface FileSystemComposable {
  // Reactive State
  fileTree: Ref<FileNode[]>
  currentPath: Ref<string>
  selectedFiles: Ref<string[]>
  isLoading: Ref<boolean>
  searchResults: Ref<FileNode[]>
  
  // Methods
  loadFileTree: (path?: string) => Promise<void>
  createFile: (path: string, content?: string) => Promise<void>
  createFolder: (path: string) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  renameFile: (oldPath: string, newPath: string) => Promise<void>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  searchFiles: (query: string, options?: SearchOptions) => Promise<FileNode[]>
  
  // Navigation
  navigateTo: (path: string) => void
  goUp: () => void
  selectFile: (path: string, multi?: boolean) => void
  clearSelection: () => void
}
```

#### Usage Example

```typescript
import { useFileSystem } from '@/composables/useFileSystem'

export default defineComponent({
  setup() {
    const {
      fileTree,
      currentPath,
      selectedFiles,
      isLoading,
      loadFileTree,
      createFile,
      readFile,
      searchFiles
    } = useFileSystem()
    
    // Load file tree on mount
    onMounted(async () => {
      await loadFileTree('/workspace')
    })
    
    const handleFileCreate = async (fileName: string) => {
      const fullPath = `${currentPath.value}/${fileName}`
      await createFile(fullPath, '// New file content')
      await loadFileTree() // Refresh tree
    }
    
    const handleFileSearch = async (query: string) => {
      const results = await searchFiles(query, {
        includeContent: true,
        fileTypes: ['.ts', '.js', '.vue']
      })
      return results
    }
    
    return {
      fileTree,
      currentPath,
      selectedFiles,
      isLoading,
      handleFileCreate,
      handleFileSearch
    }
  }
})
```

### useGit

Handles Git operations and repository management.

#### Interface

```typescript
interface GitComposable {
  // Reactive State
  gitStatus: Ref<GitStatus | null>
  branches: Ref<GitBranch[]>
  commitHistory: Ref<GitCommit[]>
  currentBranch: Ref<string>
  isLoading: Ref<boolean>
  
  // Methods
  getStatus: () => Promise<GitStatus>
  getBranches: () => Promise<GitBranch[]>
  getCommitHistory: (limit?: number) => Promise<GitCommit[]>
  stageFiles: (files: string[]) => Promise<void>
  unstageFiles: (files: string[]) => Promise<void>
  commit: (message: string) => Promise<void>
  push: (remote?: string, branch?: string) => Promise<void>
  pull: (remote?: string, branch?: string) => Promise<void>
  switchBranch: (branchName: string) => Promise<void>
  createBranch: (branchName: string) => Promise<void>
  deleteBranch: (branchName: string) => Promise<void>
  
  // Diff Operations
  getDiff: (file: string) => Promise<string>
  getStagedDiff: (file: string) => Promise<string>
}
```

#### Usage Example

```typescript
import { useGit } from '@/composables/useGit'

export default defineComponent({
  setup() {
    const {
      gitStatus,
      branches,
      currentBranch,
      getStatus,
      stageFiles,
      commit,
      push,
      switchBranch
    } = useGit()
    
    // Load Git status on mount
    onMounted(async () => {
      await getStatus()
    })
    
    const handleCommit = async (message: string, files: string[]) => {
      try {
        await stageFiles(files)
        await commit(message)
        await getStatus() // Refresh status
      } catch (error) {
        console.error('Commit failed:', error)
      }
    }
    
    const handleBranchSwitch = async (branchName: string) => {
      await switchBranch(branchName)
      await getStatus() // Refresh status
    }
    
    return {
      gitStatus,
      branches,
      currentBranch,
      handleCommit,
      handleBranchSwitch
    }
  }
})
```

### useTerminal

Manages terminal sessions and command execution.

#### Interface

```typescript
interface TerminalComposable {
  // Reactive State
  sessions: Ref<TerminalSession[]>
  activeSession: Ref<string | null>
  isConnected: Ref<boolean>
  
  // Methods
  createSession: (name?: string) => Promise<string>
  closeSession: (sessionId: string) => Promise<void>
  switchSession: (sessionId: string) => void
  executeCommand: (sessionId: string, command: string) => Promise<void>
  sendInput: (sessionId: string, input: string) => Promise<void>
  clearHistory: (sessionId: string) => Promise<void>
  
  // Session Management
  renameSession: (sessionId: string, name: string) => void
  getSessionHistory: (sessionId: string) => TerminalHistoryItem[]
  
  // Events
  onOutput: (callback: (sessionId: string, output: string) => void) => void
  onSessionCreated: (callback: (session: TerminalSession) => void) => void
  onSessionClosed: (callback: (sessionId: string) => void) => void
}
```

#### Usage Example

```typescript
import { useTerminal } from '@/composables/useTerminal'

export default defineComponent({
  setup() {
    const {
      sessions,
      activeSession,
      createSession,
      executeCommand,
      sendInput,
      onOutput
    } = useTerminal()
    
    // Create initial session
    onMounted(async () => {
      const sessionId = await createSession('Main Terminal')
      switchSession(sessionId)
    })
    
    // Handle terminal output
    onOutput((sessionId, output) => {
      console.log(`Session ${sessionId} output:`, output)
    })
    
    const runCommand = async (command: string) => {
      if (activeSession.value) {
        await executeCommand(activeSession.value, command)
      }
    }
    
    const handleInput = async (input: string) => {
      if (activeSession.value) {
        await sendInput(activeSession.value, input)
      }
    }
    
    return {
      sessions,
      activeSession,
      runCommand,
      handleInput
    }
  }
})
```

### useChat

Handles chat/messaging functionality and real-time communication.

#### Interface

```typescript
interface ChatComposable {
  // Reactive State
  messages: Ref<ChatMessage[]>
  isConnected: Ref<boolean>
  isTyping: Ref<boolean>
  typingUsers: Ref<string[]>
  onlineUsers: Ref<string[]>
  
  // Methods
  sendMessage: (content: string, type?: MessageType) => Promise<void>
  sendFile: (file: File) => Promise<void>
  markAsRead: (messageId: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  editMessage: (messageId: string, newContent: string) => Promise<void>
  clearHistory: () => Promise<void>
  
  // Typing Indicators
  startTyping: () => void
  stopTyping: () => void
  
  // Events
  onNewMessage: (callback: (message: ChatMessage) => void) => void
  onMessageUpdated: (callback: (message: ChatMessage) => void) => void
  onUserJoined: (callback: (userId: string) => void) => void
  onUserLeft: (callback: (userId: string) => void) => void
  onTypingStart: (callback: (userId: string) => void) => void
  onTypingStop: (callback: (userId: string) => void) => void
}
```

#### Usage Example

```typescript
import { useChat } from '@/composables/useChat'

export default defineComponent({
  setup() {
    const {
      messages,
      isConnected,
      typingUsers,
      sendMessage,
      sendFile,
      startTyping,
      stopTyping,
      onNewMessage
    } = useChat()
    
    // Handle new messages
    onNewMessage((message) => {
      console.log('New message:', message)
      // Show notification if needed
    })
    
    const handleSendMessage = async (content: string) => {
      if (content.trim()) {
        await sendMessage(content)
      }
    }
    
    const handleFileUpload = async (file: File) => {
      await sendFile(file)
    }
    
    const handleTyping = (isTyping: boolean) => {
      if (isTyping) {
        startTyping()
      } else {
        stopTyping()
      }
    }
    
    return {
      messages,
      isConnected,
      typingUsers,
      handleSendMessage,
      handleFileUpload,
      handleTyping
    }
  }
})
```

## Component API

### Layout Components

#### AppHeader

Main application header with navigation and controls.

```typescript
interface AppHeaderProps {
  title?: string
  showConnectionStatus?: boolean
  showUserMenu?: boolean
}

interface AppHeaderEmits {
  'toggle-sidebar': []
  'user-action': [action: string]
  'theme-change': [theme: 'light' | 'dark' | 'system']
}
```

**Usage:**
```vue
<AppHeader 
  title="VS Code Frontend"
  :show-connection-status="true"
  @toggle-sidebar="handleSidebarToggle"
  @theme-change="handleThemeChange"
/>
```

#### AppSidebar

Collapsible navigation sidebar.

```typescript
interface AppSidebarProps {
  collapsed?: boolean
  activeSection?: string
  sections?: NavigationSection[]
}

interface AppSidebarEmits {
  'section-change': [section: string]
  'collapse-change': [collapsed: boolean]
}
```

**Usage:**
```vue
<AppSidebar 
  :collapsed="sidebarCollapsed"
  :active-section="currentSection"
  :sections="navigationSections"
  @section-change="handleSectionChange"
/>
```

### Automation Components

#### CommandPanel

VS Code command execution interface.

```typescript
interface CommandPanelProps {
  availableCommands?: string[]
  favorites?: string[]
  history?: CommandHistoryItem[]
}

interface CommandPanelEmits {
  'execute-command': [command: string, args?: any[]]
  'add-favorite': [command: string]
  'remove-favorite': [command: string]
}
```

**Usage:**
```vue
<CommandPanel 
  :available-commands="commands"
  :favorites="favoriteCommands"
  :history="commandHistory"
  @execute-command="handleCommandExecution"
  @add-favorite="addToFavorites"
/>
```

#### ServerStatus

Real-time server status display.

```typescript
interface ServerStatusProps {
  isConnected?: boolean
  serverUrl?: string
  latency?: number
  lastConnected?: Date
}

interface ServerStatusEmits {
  'connect': []
  'disconnect': []
  'restart': []
}
```

**Usage:**
```vue
<ServerStatus 
  :is-connected="connectionStore.isConnected"
  :server-url="connectionStore.serverUrl"
  :latency="connectionStore.latency"
  @connect="handleConnect"
  @disconnect="handleDisconnect"
/>
```

### File System Components

#### FileExplorer

Main file system navigation component.

```typescript
interface FileExplorerProps {
  fileTree?: FileNode[]
  currentPath?: string
  selectedFiles?: string[]
  showHidden?: boolean
}

interface FileExplorerEmits {
  'file-select': [path: string, multi: boolean]
  'file-open': [path: string]
  'file-create': [path: string, type: 'file' | 'folder']
  'file-delete': [paths: string[]]
  'file-rename': [oldPath: string, newPath: string]
  'path-change': [path: string]
}
```

**Usage:**
```vue
<FileExplorer 
  :file-tree="fileSystemStore.fileTree"
  :current-path="fileSystemStore.currentPath"
  :selected-files="fileSystemStore.selectedFiles"
  @file-open="handleFileOpen"
  @file-create="handleFileCreate"
/>
```

#### FileViewer

File content display and editing component.

```typescript
interface FileViewerProps {
  filePath?: string
  content?: string
  language?: string
  readOnly?: boolean
  showLineNumbers?: boolean
}

interface FileViewerEmits {
  'content-change': [content: string]
  'save': [content: string]
  'close': []
}
```

**Usage:**
```vue
<FileViewer 
  :file-path="selectedFile"
  :content="fileContent"
  :language="fileLanguage"
  @content-change="handleContentChange"
  @save="handleFileSave"
/>
```

### Git Components

#### GitDashboard

Git repository status overview.

```typescript
interface GitDashboardProps {
  gitStatus?: GitStatus
  currentBranch?: string
  branches?: GitBranch[]
}

interface GitDashboardEmits {
  'refresh': []
  'stage-files': [files: string[]]
  'unstage-files': [files: string[]]
  'commit': [message: string]
  'push': []
  'pull': []
  'branch-switch': [branch: string]
}
```

**Usage:**
```vue
<GitDashboard 
  :git-status="gitStore.status"
  :current-branch="gitStore.currentBranch"
  :branches="gitStore.branches"
  @stage-files="handleStageFiles"
  @commit="handleCommit"
/>
```

#### DiffViewer

File difference visualization component.

```typescript
interface DiffViewerProps {
  filePath?: string
  oldContent?: string
  newContent?: string
  showSideBySide?: boolean
}

interface DiffViewerEmits {
  'stage-hunk': [hunkIndex: number]
  'unstage-hunk': [hunkIndex: number]
  'discard-changes': [filePath: string]
}
```

**Usage:**
```vue
<DiffViewer 
  :file-path="selectedFile"
  :old-content="originalContent"
  :new-content="modifiedContent"
  :show-side-by-side="true"
  @stage-hunk="handleStageHunk"
/>
```

### Terminal Components

#### TerminalPanel

Terminal interface with session management.

```typescript
interface TerminalPanelProps {
  sessions?: TerminalSession[]
  activeSession?: string
  theme?: 'light' | 'dark'
}

interface TerminalPanelEmits {
  'session-create': [name?: string]
  'session-close': [sessionId: string]
  'session-switch': [sessionId: string]
  'command-execute': [sessionId: string, command: string]
  'input-send': [sessionId: string, input: string]
}
```

**Usage:**
```vue
<TerminalPanel 
  :sessions="terminalStore.sessions"
  :active-session="terminalStore.activeSession"
  theme="dark"
  @session-create="handleSessionCreate"
  @command-execute="handleCommandExecute"
/>
```

### Chat Components

#### ChatInterface

Real-time messaging interface.

```typescript
interface ChatInterfaceProps {
  messages?: ChatMessage[]
  onlineUsers?: string[]
  typingUsers?: string[]
  currentUser?: string
}

interface ChatInterfaceEmits {
  'message-send': [content: string]
  'file-send': [file: File]
  'typing-start': []
  'typing-stop': []
  'message-delete': [messageId: string]
  'message-edit': [messageId: string, content: string]
}
```

**Usage:**
```vue
<ChatInterface 
  :messages="chatStore.messages"
  :online-users="chatStore.onlineUsers"
  :typing-users="chatStore.typingUsers"
  @message-send="handleMessageSend"
  @file-send="handleFileSend"
/>
```

### Common Utility Components

#### LoadingSpinner

Customizable loading indicator.

```typescript
interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
  message?: string
  overlay?: boolean
}
```

**Usage:**
```vue
<LoadingSpinner 
  size="medium"
  message="Loading files..."
  :overlay="true"
/>
```

#### ErrorBoundary

Error handling wrapper component.

```typescript
interface ErrorBoundaryProps {
  fallback?: string | Component
  onError?: (error: Error, info: string) => void
}

interface ErrorBoundaryEmits {
  'error': [error: Error, info: string]
  'retry': []
}
```

**Usage:**
```vue
<ErrorBoundary @error="handleError" @retry="handleRetry">
  <YourComponent />
</ErrorBoundary>
```

#### NotificationToast

User feedback notification system.

```typescript
interface NotificationToastProps {
  notifications?: Notification[]
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  autoClose?: boolean
  duration?: number
}

interface NotificationToastEmits {
  'notification-close': [id: string]
  'notification-action': [id: string, action: string]
}
```

**Usage:**
```vue
<NotificationToast 
  :notifications="uiStore.notifications"
  position="top-right"
  :auto-close="true"
  :duration="5000"
  @notification-close="handleNotificationClose"
/>
```

## Type Definitions

### Common Types

```typescript
// WebSocket Message Types
interface WebSocketMessage {
  type: 'command' | 'response' | 'broadcast' | 'status'
  id?: string
  command?: string
  args?: any[]
  data?: any
  error?: string
  timestamp: number
}

// File System Types
interface FileNode {
  path: string
  name: string
  type: 'file' | 'directory'
  size?: number
  modified?: Date
  children?: FileNode[]
  isExpanded?: boolean
}

// Git Types
interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFile[]
  unstaged: GitFile[]
  untracked: string[]
  hasChanges: boolean
}

interface GitFile {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | 'C'
  staged: boolean
}

// Terminal Types
interface TerminalSession {
  id: string
  name: string
  isActive: boolean
  history: TerminalHistoryItem[]
  cwd: string
}

interface TerminalHistoryItem {
  command: string
  output: string
  timestamp: Date
  exitCode?: number
}

// Chat Types
interface ChatMessage {
  id: string
  userId: string
  content: string
  type: 'text' | 'file' | 'system'
  timestamp: Date
  edited?: boolean
  reactions?: MessageReaction[]
}
```

## Best Practices

### Composable Usage

1. **Single Responsibility**: Each composable should handle one specific domain
2. **Reactive State**: Use `ref` and `reactive` appropriately
3. **Error Handling**: Always include proper error handling
4. **Cleanup**: Use `onUnmounted` for cleanup when necessary
5. **Type Safety**: Provide comprehensive TypeScript types

### Component Development

1. **Props Validation**: Use TypeScript interfaces for props
2. **Event Naming**: Use kebab-case for event names
3. **Slot Usage**: Provide slots for customization
4. **Accessibility**: Include proper ARIA attributes
5. **Performance**: Use `v-memo` and `v-once` when appropriate

### State Management

1. **Store Organization**: Keep stores focused and modular
2. **Computed Properties**: Use computed for derived state
3. **Actions**: Keep actions pure and predictable
4. **Persistence**: Use localStorage/sessionStorage when needed
5. **Reactivity**: Avoid breaking reactivity chains

This API reference provides the foundation for working with the Vue.js frontend components and composables. Always refer to the TypeScript definitions in the source code for the most up-to-date information.