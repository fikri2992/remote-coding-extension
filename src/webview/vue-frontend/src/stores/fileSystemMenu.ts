import { defineStore } from 'pinia'
import { ref, computed, watch, onUnmounted } from 'vue'
import type { 
  FileSystemMenuState, 
  FilePreviewContent, 
  FileMetadata,
  ContextMenuState,
  ClipboardOperation,
  VSCodeFileOperation,
  FileSystemEvent
} from '../components/file-system-menu/types'
import type { FileSystemNode, FileWatchEvent } from '../types/filesystem'
import { useFileSystem } from '../composables/useFileSystem'
import { useConnectionStore } from './connection'
import { connectionService } from '../services/connection'

export const useFileSystemMenuStore = defineStore('fileSystemMenu', () => {
  // Composables
  const fileSystem = useFileSystem()
  const connectionStore = useConnectionStore()

  // State
  const fileTree = ref<Map<string, FileSystemNode>>(new Map())
  const selectedPath = ref<string | null>(null)
  const expandedPaths = ref<Set<string>>(new Set())
  const loadingPaths = ref<Set<string>>(new Set())
  
  // Search state
  const searchQuery = ref('')
  const searchResults = ref<FileSystemNode[]>([])
  const isSearchActive = ref(false)
  const searchLoading = ref(false)
  const searchError = ref<string | null>(null)
  
  // Preview state
  const previewContent = ref<FilePreviewContent | null>(null)
  const previewLoading = ref(false)
  const previewError = ref<string | null>(null)
  const previewVisible = ref(true)
  
  // UI state
  const splitPaneSize = ref(300)
  const contextMenu = ref<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    node: null
  })
  
  // Connection state integration
  const isConnected = computed(() => connectionStore.isConnected)
  const connectionStatus = computed(() => connectionStore.connectionStatus)
  const isLoading = ref(false)
  const lastSync = ref<Date | null>(null)
  const reconnectAttempts = computed(() => connectionStore.reconnectAttempts)
  
  // File watching state
  const watchedPaths = ref<Set<string>>(new Set())
  const fileChangeEvents = ref<FileSystemEvent[]>([])
  const maxEventHistory = 100

  // Getters
  const state = computed((): FileSystemMenuState => ({
    fileTree: fileTree.value,
    selectedPath: selectedPath.value,
    expandedPaths: expandedPaths.value,
    loadingPaths: loadingPaths.value,
    searchQuery: searchQuery.value,
    searchResults: searchResults.value,
    isSearchActive: isSearchActive.value,
    previewContent: previewContent.value,
    previewLoading: previewLoading.value,
    previewError: previewError.value,
    previewVisible: previewVisible.value,
    splitPaneSize: splitPaneSize.value,
    contextMenu: contextMenu.value,
    isConnected: isConnected.value,
    isLoading: isLoading.value,
    lastSync: lastSync.value
  }))

  const filteredFileTree = computed(() => {
    if (!isSearchActive.value || !searchQuery.value.trim()) {
      return Array.from(fileTree.value.values())
    }
    return searchResults.value
  })

  const selectedNode = computed(() => {
    return selectedPath.value ? fileTree.value.get(selectedPath.value) : null
  })

  const canReconnect = computed(() => {
    return !isConnected.value && connectionStore.canReconnect
  })

  // Actions
  const initialize = async (initialPath?: string) => {
    try {
      isLoading.value = true
      
      // Wait for connection if not connected
      if (!isConnected.value) {
        console.log('Waiting for WebSocket connection...')
        await waitForConnection()
      }
      
      // Load persisted state
      loadPersistedState()
      
      // Set up file change event handling
      setupFileWatching()
      
      // Load file tree
      const nodes = await fileSystem.loadFileTree(initialPath)
      
      // Update file tree
      fileTree.value.clear()
      nodes.forEach(node => {
        fileTree.value.set(node.path, node)
        // Add children to the map as well
        if (node.children) {
          addChildrenToMap(node.children)
        }
      })
      
      // Start watching the root path
      if (initialPath) {
        await startWatchingPath(initialPath)
      }
      
      lastSync.value = new Date()
    } catch (error) {
      console.error('Failed to initialize file system menu:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const addChildrenToMap = (children: FileSystemNode[]) => {
    children.forEach(child => {
      fileTree.value.set(child.path, child)
      if (child.children) {
        addChildrenToMap(child.children)
      }
    })
  }

  const selectNode = async (path: string) => {
    selectedPath.value = path
    
    // Load preview content
    await loadPreviewContent(path)
    
    // Persist state
    persistState()
  }

  const expandNode = async (path: string) => {
    if (expandedPaths.value.has(path)) return
    
    try {
      loadingPaths.value.add(path)
      
      // Expand node using file system composable
      await fileSystem.expandNode(path)
      
      // Update expanded paths
      expandedPaths.value.add(path)
      
      // Update file tree with new children
      const node = fileSystem.getNodeByPath(path)
      if (node) {
        fileTree.value.set(path, node)
        if (node.children) {
          addChildrenToMap(node.children)
        }
      }
      
      persistState()
    } catch (error) {
      console.error('Failed to expand node:', error)
      throw error
    } finally {
      loadingPaths.value.delete(path)
    }
  }

  const collapseNode = (path: string) => {
    expandedPaths.value.delete(path)
    
    // Update node in file tree
    const node = fileTree.value.get(path)
    if (node) {
      node.isExpanded = false
      fileTree.value.set(path, node)
    }
    
    persistState()
  }

  const setSearchQuery = (query: string) => {
    searchQuery.value = query
    isSearchActive.value = query.trim().length > 0
    searchError.value = null
    
    if (isSearchActive.value) {
      performSearch(query)
    } else {
      searchResults.value = []
    }
  }

  const performSearch = async (query: string) => {
    if (!isConnected.value) {
      searchError.value = 'Not connected to server'
      return
    }

    try {
      searchLoading.value = true
      searchError.value = null
      
      const results = await fileSystem.searchFiles({
        query,
        includeFiles: true,
        includeDirectories: true,
        caseSensitive: false,
        useRegex: false,
        maxResults: 100
      })
      
      // Convert search results to FileSystemNode format
      searchResults.value = results.map(result => {
        const existingNode = fileTree.value.get(result.path)
        return existingNode || {
          path: result.path,
          name: result.name,
          type: result.type,
          size: 0,
          modified: new Date(),
          created: new Date(),
          parent: fileSystem.getParentPath(result.path)
        }
      })
    } catch (error) {
      console.error('Search failed:', error)
      searchError.value = error instanceof Error ? error.message : 'Search failed'
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }

  const clearSearch = () => {
    searchQuery.value = ''
    searchResults.value = []
    isSearchActive.value = false
    searchError.value = null
  }

  const loadPreviewContent = async (path: string) => {
    if (!path) {
      previewContent.value = null
      return
    }
    
    try {
      previewLoading.value = true
      previewError.value = null
      
      const node = fileTree.value.get(path)
      if (!node) {
        throw new Error('Node not found')
      }
      
      const metadata: FileMetadata = {
        name: node.name,
        path: node.path,
        size: node.size || 0,
        modified: node.modified,
        created: node.created,
        type: node.type,
        permissions: node.permissions,
        isHidden: node.name.startsWith('.'),
        extension: getFileExtension(node.name),
        mimeType: getMimeType(node.name)
      }
      
      if (node.type === 'directory') {
        previewContent.value = {
          path: node.path,
          type: 'directory',
          metadata,
          size: node.size || 0
        }
      } else {
        // Determine file type
        const extension = getFileExtension(node.name).toLowerCase()
        
        if (isImageFile(extension)) {
          previewContent.value = {
            path: node.path,
            type: 'image',
            metadata,
            size: node.size || 0
          }
        } else if (isTextFile(extension)) {
          // Load file content
          const fileContent = await fileSystem.readFile(path)
          previewContent.value = {
            path: node.path,
            type: 'text',
            content: fileContent.content,
            metadata,
            language: getLanguageFromExtension(extension),
            size: fileContent.size,
            encoding: fileContent.encoding
          }
        } else {
          previewContent.value = {
            path: node.path,
            type: 'binary',
            metadata,
            size: node.size || 0
          }
        }
      }
    } catch (error) {
      console.error('Failed to load preview content:', error)
      previewError.value = error instanceof Error ? error.message : 'Failed to load preview'
      previewContent.value = null
    } finally {
      previewLoading.value = false
    }
  }

  const togglePreview = () => {
    previewVisible.value = !previewVisible.value
    persistState()
  }

  const setSplitPaneSize = (size: number) => {
    splitPaneSize.value = Math.max(200, Math.min(600, size))
    persistState()
  }

  const showContextMenu = (x: number, y: number, node: FileSystemNode) => {
    contextMenu.value = {
      show: true,
      x,
      y,
      node
    }
  }

  const hideContextMenu = () => {
    contextMenu.value.show = false
  }

  const executeContextAction = async (actionId: string) => {
    const node = contextMenu.value.node
    if (!node) return
    
    try {
      switch (actionId) {
        case 'copy-path':
          await copyPath(node.path)
          break
        case 'copy-relative-path':
          await copyRelativePath(node.path)
          break
        case 'copy-content':
          await copyFileContent(node.path)
          break
        case 'open-editor':
          await openInEditor(node.path)
          break
        case 'reveal-explorer':
          await revealInExplorer(node.path)
          break
        default:
          console.warn('Unknown context action:', actionId)
      }
    } catch (error) {
      console.error('Context action failed:', error)
    }
  }

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      // Could emit a success notification here
    } catch (error) {
      console.error('Failed to copy path:', error)
      throw error
    }
  }

  const copyRelativePath = async (path: string) => {
    try {
      // Calculate relative path from workspace root
      const relativePath = path.startsWith('./') ? path : `./${path.replace(/^\/+/, '')}`
      await navigator.clipboard.writeText(relativePath)
      // Could emit a success notification here
    } catch (error) {
      console.error('Failed to copy relative path:', error)
      throw error
    }
  }

  const copyFileContent = async (path: string) => {
    try {
      const node = fileTree.value.get(path)
      if (!node || node.type !== 'file') {
        throw new Error('Cannot copy content of non-file')
      }
      
      const extension = getFileExtension(node.name).toLowerCase()
      if (!isTextFile(extension)) {
        throw new Error('Cannot copy content of binary file')
      }
      
      const fileContent = await fileSystem.readFile(path)
      await navigator.clipboard.writeText(fileContent.content)
      // Could emit a success notification here
    } catch (error) {
      console.error('Failed to copy file content:', error)
      throw error
    }
  }

  const openInEditor = async (path: string) => {
    if (!isConnected.value) {
      throw new Error('Not connected to VS Code')
    }

    try {
      const operation: VSCodeFileOperation = {
        type: 'open',
        path,
        options: {
          preview: false
        }
      }
      
      // Send command via WebSocket using the connection service
      const result = await connectionService.getWebSocket().sendMessageWithResponse({
        type: 'command',
        command: 'vscode.window.showTextDocument',
        args: [path, { preview: false }],
        timestamp: Date.now()
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to open file in editor')
      }

      console.log('File opened in editor:', path)
    } catch (error) {
      console.error('Failed to open file in editor:', error)
      throw error
    }
  }

  const revealInExplorer = async (path: string) => {
    if (!isConnected.value) {
      throw new Error('Not connected to VS Code')
    }

    try {
      const operation: VSCodeFileOperation = {
        type: 'reveal',
        path
      }
      
      // Send command via WebSocket using the connection service
      const result = await connectionService.getWebSocket().sendMessageWithResponse({
        type: 'command',
        command: 'vscode.commands.executeCommand',
        args: ['revealInExplorer', path],
        timestamp: Date.now()
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to reveal file in explorer')
      }

      console.log('File revealed in explorer:', path)
    } catch (error) {
      console.error('Failed to reveal file in explorer:', error)
      throw error
    }
  }

  const refreshFileTree = async () => {
    if (!isConnected.value) {
      throw new Error('Not connected to server')
    }

    try {
      isLoading.value = true
      await fileSystem.refreshFileTree()
      
      // Update file tree from file system
      const allNodes = Array.from(fileSystem.fileTree.value.nodes.values())
      fileTree.value.clear()
      allNodes.forEach(node => {
        fileTree.value.set(node.path, node)
      })
      
      lastSync.value = new Date()
    } catch (error) {
      console.error('Failed to refresh file tree:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // WebSocket integration methods
  const waitForConnection = async (timeout = 10000): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (isConnected.value) {
        resolve()
        return
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, timeout)

      const unwatch = watch(isConnected, (connected) => {
        if (connected) {
          clearTimeout(timeoutId)
          unwatch()
          resolve()
        }
      })
    })
  }

  const handleConnectionChange = async (connected: boolean) => {
    if (connected) {
      // Reconnected - refresh file tree
      try {
        await refreshFileTree()
        // Re-establish file watching
        for (const path of watchedPaths.value) {
          await fileSystem.watchPath(path)
        }
      } catch (error) {
        console.error('Failed to refresh after reconnection:', error)
      }
    } else {
      // Disconnected - clear loading states
      isLoading.value = false
      searchLoading.value = false
      previewLoading.value = false
      loadingPaths.value.clear()
    }
  }

  const setupFileWatching = () => {
    // Set up file change event handling
    fileSystem.onFileChange(handleFileChangeEvent)
  }

  const startWatchingPath = async (path: string) => {
    try {
      await fileSystem.watchPath(path, {
        recursive: true,
        includeSubdirectories: true
      })
      watchedPaths.value.add(path)
    } catch (error) {
      console.error('Failed to start watching path:', error)
    }
  }

  const stopWatchingPath = async (path: string) => {
    try {
      await fileSystem.unwatchPath(path)
      watchedPaths.value.delete(path)
    } catch (error) {
      console.error('Failed to stop watching path:', error)
    }
  }

  const handleFileChangeEvent = (event: FileWatchEvent) => {
    // Convert FileWatchEvent to FileSystemEvent
    const fileSystemEvent: FileSystemEvent = {
      type: event.type === 'created' ? 'file-created' :
            event.type === 'modified' ? 'file-changed' :
            event.type === 'deleted' ? 'file-deleted' :
            event.type === 'renamed' ? 'file-renamed' : 'file-changed',
      path: event.path,
      oldPath: event.oldPath,
      timestamp: new Date(),
      metadata: event.metadata
    }

    // Add to event history
    fileChangeEvents.value.unshift(fileSystemEvent)
    if (fileChangeEvents.value.length > maxEventHistory) {
      fileChangeEvents.value = fileChangeEvents.value.slice(0, maxEventHistory)
    }

    // Update file tree based on event
    switch (fileSystemEvent.type) {
      case 'file-created':
        // Refresh parent directory
        refreshParentDirectory(fileSystemEvent.path)
        break
      case 'file-deleted':
        // Remove from file tree
        fileTree.value.delete(fileSystemEvent.path)
        // Clear selection if deleted file was selected
        if (selectedPath.value === fileSystemEvent.path) {
          selectedPath.value = null
          previewContent.value = null
        }
        break
      case 'file-changed':
        // Refresh file metadata and preview if selected
        if (selectedPath.value === fileSystemEvent.path) {
          loadPreviewContent(fileSystemEvent.path)
        }
        break
      case 'file-renamed':
        // Handle rename
        if (fileSystemEvent.oldPath) {
          const oldNode = fileTree.value.get(fileSystemEvent.oldPath)
          if (oldNode) {
            fileTree.value.delete(fileSystemEvent.oldPath)
            oldNode.path = fileSystemEvent.path
            oldNode.name = fileSystem.getFileName(fileSystemEvent.path)
            fileTree.value.set(fileSystemEvent.path, oldNode)
            
            // Update selection if renamed file was selected
            if (selectedPath.value === fileSystemEvent.oldPath) {
              selectedPath.value = fileSystemEvent.path
            }
          }
        }
        break
    }
  }

  const refreshParentDirectory = async (filePath: string) => {
    const parentPath = fileSystem.getParentPath(filePath)
    const parentNode = fileTree.value.get(parentPath)
    
    if (parentNode && parentNode.isExpanded) {
      try {
        await expandNode(parentPath)
      } catch (error) {
        console.error('Failed to refresh parent directory:', error)
      }
    }
  }

  // Utility functions
  const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.')
    return lastDot > 0 ? filename.substring(lastDot + 1) : ''
  }

  const getMimeType = (filename: string): string => {
    const extension = getFileExtension(filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'json': 'application/json',
      'html': 'text/html',
      'css': 'text/css',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'zip': 'application/zip'
    }
    return mimeTypes[extension] || 'application/octet-stream'
  }

  const isTextFile = (extension: string): boolean => {
    const textExtensions = [
      'txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'vue', 'json', 'html', 'css', 'scss', 'less',
      'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'sh', 'bat', 'cmd',
      'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'swift',
      'kt', 'scala', 'clj', 'hs', 'elm', 'dart', 'r', 'sql', 'graphql', 'proto'
    ]
    return textExtensions.includes(extension.toLowerCase())
  }

  const isImageFile = (extension: string): boolean => {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp', 'ico']
    return imageExtensions.includes(extension.toLowerCase())
  }

  const getLanguageFromExtension = (extension: string): string => {
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'vue': 'vue',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'md': 'markdown',
      'py': 'python',
      'rb': 'ruby',
      'php': 'php',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'sh': 'bash',
      'bat': 'batch',
      'cmd': 'batch',
      'sql': 'sql',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml'
    }
    return languageMap[extension.toLowerCase()] || 'text'
  }

  // Persistence
  const persistState = () => {
    try {
      const stateToSave = {
        selectedPath: selectedPath.value,
        expandedPaths: Array.from(expandedPaths.value),
        previewVisible: previewVisible.value,
        splitPaneSize: splitPaneSize.value
      }
      localStorage.setItem('fileSystemMenu-state', JSON.stringify(stateToSave))
    } catch (error) {
      console.error('Failed to persist state:', error)
    }
  }

  const loadPersistedState = () => {
    try {
      const saved = localStorage.getItem('fileSystemMenu-state')
      if (saved) {
        const state = JSON.parse(saved)
        selectedPath.value = state.selectedPath || null
        expandedPaths.value = new Set(state.expandedPaths || [])
        previewVisible.value = state.previewVisible !== false
        splitPaneSize.value = state.splitPaneSize || 300
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error)
    }
  }

  // Watch for connection changes
  watch(isConnected, handleConnectionChange)

  // Cleanup on unmount
  onUnmounted(() => {
    // Stop watching all paths
    watchedPaths.value.forEach(path => {
      stopWatchingPath(path).catch(console.error)
    })
  })

  return {
    // State
    fileTree,
    selectedPath,
    expandedPaths,
    loadingPaths,
    searchQuery,
    searchResults,
    isSearchActive,
    searchLoading,
    searchError,
    previewContent,
    previewLoading,
    previewError,
    previewVisible,
    splitPaneSize,
    contextMenu,
    isConnected,
    connectionStatus,
    isLoading,
    lastSync,
    reconnectAttempts,
    watchedPaths,
    fileChangeEvents,
    
    // Getters
    state,
    filteredFileTree,
    selectedNode,
    canReconnect,
    
    // Actions
    initialize,
    selectNode,
    expandNode,
    collapseNode,
    setSearchQuery,
    performSearch,
    clearSearch,
    loadPreviewContent,
    togglePreview,
    setSplitPaneSize,
    showContextMenu,
    hideContextMenu,
    executeContextAction,
    copyPath,
    copyRelativePath,
    copyFileContent,
    openInEditor,
    revealInExplorer,
    refreshFileTree,
    
    // WebSocket integration
    waitForConnection,
    handleConnectionChange,
    setupFileWatching,
    startWatchingPath,
    stopWatchingPath,
    handleFileChangeEvent,
    refreshParentDirectory
  }
})