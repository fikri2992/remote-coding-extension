import { ref, onUnmounted, type Ref } from 'vue'
import type {
  FileSystemNode,
  FileContent,
  FileOperation,
  FileOperationResult,
  FileSearchOptions,
  FileSearchResult,
  FileWatchOptions,
  FileWatchEvent,
  FileSystemStats,
  FileTreeState,
  FileFilterOptions
} from '../types/filesystem'

import { connectionService } from '../services/connection'
import {
  FILE_OPERATION_TIMEOUT,
  FILE_SEARCH_MAX_RESULTS,
  STORAGE_KEYS
} from '../utils/constants'
import {
  validateFileOperation,
  validateFileSearchOptions,
  validateFileName,
  validateDirectoryName,
  validateOperationPath,
  createFileValidationError,
  sanitizeFilePath,
  isSafePath
} from '../utils/filesystem-validator'

export interface FileSystemComposable {
  // State
  fileTree: Ref<FileTreeState>
  currentPath: Ref<string | null>
  selectedNode: Ref<FileSystemNode | null>
  isLoading: Ref<boolean>
  stats: Ref<FileSystemStats>
  watchedPaths: Ref<Set<string>>

  // File tree operations
  loadFileTree: (rootPath?: string) => Promise<FileSystemNode[]>
  refreshFileTree: (path?: string) => Promise<void>
  expandNode: (path: string) => Promise<void>
  collapseNode: (path: string) => void
  selectNode: (path: string) => void
  getNodeByPath: (path: string) => FileSystemNode | null

  // File operations
  createFile: (path: string, content?: string) => Promise<FileOperationResult>
  createDirectory: (path: string) => Promise<FileOperationResult>
  deleteFile: (path: string) => Promise<FileOperationResult>
  deleteDirectory: (path: string, recursive?: boolean) => Promise<FileOperationResult>
  renameFile: (oldPath: string, newPath: string) => Promise<FileOperationResult>
  moveFile: (sourcePath: string, targetPath: string) => Promise<FileOperationResult>
  copyFile: (sourcePath: string, targetPath: string) => Promise<FileOperationResult>

  // File content operations
  readFile: (path: string) => Promise<FileContent>
  writeFile: (path: string, content: string, encoding?: string) => Promise<FileOperationResult>
  appendToFile: (path: string, content: string) => Promise<FileOperationResult>

  // Search and filtering
  searchFiles: (options: FileSearchOptions) => Promise<FileSearchResult[]>
  filterNodes: (options: FileFilterOptions) => FileSystemNode[]
  findNodesByName: (name: string, caseSensitive?: boolean) => FileSystemNode[]
  findNodesByType: (type: 'file' | 'directory') => FileSystemNode[]

  // File watching
  watchPath: (path: string, options?: FileWatchOptions) => Promise<void>
  unwatchPath: (path: string) => Promise<void>
  onFileChange: (callback: (event: FileWatchEvent) => void) => void

  // Utilities
  getFileStats: (path: string) => Promise<FileSystemNode>
  validatePath: (path: string) => boolean
  normalizePath: (path: string) => string
  getParentPath: (path: string) => string
  getFileName: (path: string) => string
  getFileExtension: (path: string) => string
  isDirectory: (path: string) => boolean
  exists: (path: string) => Promise<boolean>
}

export function useFileSystem(): FileSystemComposable {
  const webSocket = connectionService.getWebSocket()
  
  if (!webSocket) {
    throw new Error('WebSocket not initialized. Make sure connectionService.initialize() is called first.')
  }

  // State
  const fileTree = ref<FileTreeState>({
    nodes: new Map(),
    expandedPaths: new Set(),
    selectedPath: null,
    loadingPaths: new Set(),
    rootPaths: []
  })

  const currentPath = ref<string | null>(null)
  const selectedNode = ref<FileSystemNode | null>(null)
  const isLoading = ref(false)
  const watchedPaths = ref<Set<string>>(new Set())

  const stats = ref<FileSystemStats>({
    totalFiles: 0,
    totalDirectories: 0,
    totalSize: 0,
    lastUpdated: new Date()
  })

  // Event callbacks
  const fileChangeCallbacks = ref<Array<(event: FileWatchEvent) => void>>([])



  // File tree operations
  const loadFileTree = async (rootPath?: string): Promise<FileSystemNode[]> => {
    isLoading.value = true
    
    try {
      const path = rootPath || '.'
      
      // Check WebSocket connection status
      if (!webSocket.isConnected.value) {
        console.warn('⚠️ WebSocket not connected, attempting to load file tree anyway...')
        // Try to wait a bit for connection
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        if (!webSocket.isConnected.value) {
          throw new Error('WebSocket connection not available. Please check if the VS Code extension is running.')
        }
      }
      
      console.log(`📁 Loading file tree for path: ${path}`)
      
      const result = await webSocket.sendMessageWithResponse({
        type: 'command',
        command: 'vscode.workspace.getFileTree',
        args: [path],
        timestamp: Date.now()
      }, 15000) // Increase timeout to 15 seconds
      
      console.log('📁 File tree response received:', result)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load file tree')
      }
      
      const nodes = Array.isArray(result.data) ? result.data : [result.data]
      
      // Clear existing tree if loading new root
      if (rootPath) {
        fileTree.value.nodes.clear()
        fileTree.value.rootPaths = []
      }

      // Process and store nodes
      const processedNodes = await processFileNodes(nodes, path)
      
      // Update root paths
      if (!fileTree.value.rootPaths.includes(path)) {
        fileTree.value.rootPaths.push(path)
      }

      updateStats()
      console.log(`✅ File tree loaded successfully: ${processedNodes.length} nodes`)
      return processedNodes
    } catch (error) {
      console.error('❌ Failed to load file tree:', error)
      
      // Provide more specific error information
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          console.error('🕐 Timeout error - the VS Code extension may not be responding')
        } else if (error.message.includes('WebSocket')) {
          console.error('🔌 WebSocket connection error - check if the extension is running')
        }
      }
      
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const refreshFileTree = async (path?: string): Promise<void> => {
    const targetPath = path || currentPath.value || '.'

    fileTree.value.loadingPaths.add(targetPath)
    
    try {
      const result = await webSocket.sendMessageWithResponse({
        type: 'command',
        command: 'vscode.workspace.refreshFileTree',
        args: [targetPath],
        timestamp: Date.now()
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to refresh file tree')
      }
      
      const nodes = Array.isArray(result.data) ? result.data : [result.data]
      
      await processFileNodes(nodes, targetPath)
      updateStats()
    } catch (error) {
      console.error('Failed to refresh file tree:', error)
      throw error
    } finally {
      fileTree.value.loadingPaths.delete(targetPath)
    }
  }

  const expandNode = async (path: string): Promise<void> => {
    const node = fileTree.value.nodes.get(path)
    if (!node || node.type !== 'directory' || node.isExpanded) return

    fileTree.value.loadingPaths.add(path)
    
    try {
      const result = await webSocket.sendMessageWithResponse({
        type: 'command',
        command: 'vscode.workspace.getDirectoryContents',
        args: [path],
        timestamp: Date.now()
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to expand directory')
      }
      
      const children = Array.isArray(result.data) ? result.data : []
      
      const processedChildren = await processFileNodes(children, path)
      
      // Update node
      node.children = processedChildren
      node.isExpanded = true
      fileTree.value.expandedPaths.add(path)
      
      persistTreeState()
    } catch (error) {
      console.error('Failed to expand node:', error)
      throw error
    } finally {
      fileTree.value.loadingPaths.delete(path)
    }
  }

  const collapseNode = (path: string): void => {
    const node = fileTree.value.nodes.get(path)
    if (!node || !node.isExpanded) return

    node.isExpanded = false
    fileTree.value.expandedPaths.delete(path)
    persistTreeState()
  }

  const selectNode = (path: string): void => {
    const node = fileTree.value.nodes.get(path)
    if (!node) return

    fileTree.value.selectedPath = path
    selectedNode.value = node
    currentPath.value = path
    persistTreeState()
  }

  const getNodeByPath = (path: string): FileSystemNode | null => {
    return fileTree.value.nodes.get(normalizePath(path)) || null
  }

  // File operations
  const createFile = async (path: string, content = ''): Promise<FileOperationResult> => {
    const normalizedPath = normalizePath(path)
    const fileName = getFileName(normalizedPath)
    
    // Validate file name
    const nameValidation = validateFileName(fileName)
    if (!nameValidation.isValid) {
      throw createFileValidationError(nameValidation.error || 'Invalid file name', normalizedPath, 'create')
    }

    // Validate path safety
    if (!isSafePath(normalizedPath)) {
      throw createFileValidationError('Unsafe file path', normalizedPath, 'create')
    }

    const operation: FileOperation = {
      type: 'create',
      path: normalizedPath,
      content,
      isDirectory: false
    }

    // Validate operation
    const operationValidation = validateFileOperation(operation)
    if (!operationValidation.isValid) {
      throw createFileValidationError(operationValidation.error || 'Invalid operation', normalizedPath, 'create')
    }

    return executeFileOperation(operation)
  }

  const createDirectory = async (path: string): Promise<FileOperationResult> => {
    const normalizedPath = normalizePath(path)
    const dirName = getFileName(normalizedPath)
    
    // Validate directory name
    const nameValidation = validateDirectoryName(dirName)
    if (!nameValidation.isValid) {
      throw createFileValidationError(nameValidation.error || 'Invalid directory name', normalizedPath, 'create')
    }

    // Validate path safety
    if (!isSafePath(normalizedPath)) {
      throw createFileValidationError('Unsafe directory path', normalizedPath, 'create')
    }

    const operation: FileOperation = {
      type: 'create',
      path: normalizedPath,
      isDirectory: true
    }

    // Validate operation
    const operationValidation = validateFileOperation(operation)
    if (!operationValidation.isValid) {
      throw createFileValidationError(operationValidation.error || 'Invalid operation', normalizedPath, 'create')
    }

    return executeFileOperation(operation)
  }

  const deleteFile = async (path: string): Promise<FileOperationResult> => {
    const normalizedPath = normalizePath(path)
    
    // Validate path for delete operation
    const pathValidation = validateOperationPath(normalizedPath, 'delete')
    if (!pathValidation.isValid) {
      throw createFileValidationError(pathValidation.error || 'Invalid path for delete', normalizedPath, 'delete')
    }

    const operation: FileOperation = {
      type: 'delete',
      path: normalizedPath,
      isDirectory: false
    }

    // Validate operation
    const operationValidation = validateFileOperation(operation)
    if (!operationValidation.isValid) {
      throw createFileValidationError(operationValidation.error || 'Invalid operation', normalizedPath, 'delete')
    }

    return executeFileOperation(operation)
  }

  const deleteDirectory = async (path: string, recursive = false): Promise<FileOperationResult> => {
    const operation: FileOperation = {
      type: 'delete',
      path: normalizePath(path),
      isDirectory: true
    }

    return executeFileOperation(operation, { recursive })
  }

  const renameFile = async (oldPath: string, newPath: string): Promise<FileOperationResult> => {
    const operation: FileOperation = {
      type: 'rename',
      path: normalizePath(oldPath),
      newPath: normalizePath(newPath)
    }

    return executeFileOperation(operation)
  }

  const moveFile = async (sourcePath: string, targetPath: string): Promise<FileOperationResult> => {
    const operation: FileOperation = {
      type: 'move',
      path: normalizePath(sourcePath),
      newPath: normalizePath(targetPath)
    }

    return executeFileOperation(operation)
  }

  const copyFile = async (sourcePath: string, targetPath: string): Promise<FileOperationResult> => {
    const operation: FileOperation = {
      type: 'copy',
      path: normalizePath(sourcePath),
      newPath: normalizePath(targetPath)
    }

    return executeFileOperation(operation)
  }

  // File content operations
  const readFile = async (path: string): Promise<FileContent> => {
    try {
      const result = await webSocket.sendMessageWithResponse({
        type: 'command',
        command: 'vscode.workspace.readFile',
        args: [normalizePath(path)],
        timestamp: Date.now()
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to read file')
      }
      
      const data = result.data
      
      return {
        path: normalizePath(path),
        content: data.content || '',
        encoding: data.encoding || 'utf8',
        language: data.language,
        size: data.size || 0,
        modified: new Date(data.modified || Date.now())
      }
    } catch (error) {
      console.error('Failed to read file:', error)
      throw error
    }
  }

  const writeFile = async (path: string, content: string, encoding = 'utf8'): Promise<FileOperationResult> => {
    const operation: FileOperation = {
      type: 'create', // Use create for write operations
      path: normalizePath(path),
      content
    }

    return executeFileOperation(operation, { encoding })
  }

  const appendToFile = async (path: string, content: string): Promise<FileOperationResult> => {
    try {
      // Read existing content first
      const existingContent = await readFile(path)
      const newContent = existingContent.content + content
      
      return writeFile(path, newContent)
    } catch (error) {
      // If file doesn't exist, create it with the content
      if (error instanceof Error && error.message.includes('not found')) {
        return writeFile(path, content)
      }
      throw error
    }
  }

  // Search and filtering
  const searchFiles = async (options: FileSearchOptions): Promise<FileSearchResult[]> => {
    // Validate search options
    const validation = validateFileSearchOptions(options)
    if (!validation.isValid) {
      throw createFileValidationError(validation.error || 'Invalid search options')
    }

    try {
      const searchOptions = {
        ...options,
        maxResults: options.maxResults || FILE_SEARCH_MAX_RESULTS
      }

      const result = await webSocket.sendMessageWithResponse({
        type: 'command',
        command: 'vscode.workspace.searchFiles',
        args: [searchOptions],
        timestamp: Date.now()
      })
      
      if (!result.success) {
        console.error('Search failed:', result.error)
        return []
      }
      
      return Array.isArray(result.data) ? result.data : []
    } catch (error) {
      console.error('Failed to search files:', error)
      return []
    }
  }

  const filterNodes = (options: FileFilterOptions): FileSystemNode[] => {
    const allNodes = Array.from(fileTree.value.nodes.values())
    
    return allNodes.filter(node => {
      // Filter by hidden files
      if (!options.showHidden && node.name.startsWith('.')) {
        return false
      }

      // Filter by file types
      if (options.fileTypes && options.fileTypes.length > 0) {
        const extension = getFileExtension(node.path)
        if (!options.fileTypes.includes(extension)) {
          return false
        }
      }

      // Filter by size range
      if (options.sizeRange && node.size !== undefined) {
        if (options.sizeRange.min !== undefined && node.size < options.sizeRange.min) {
          return false
        }
        if (options.sizeRange.max !== undefined && node.size > options.sizeRange.max) {
          return false
        }
      }

      // Filter by date range
      if (options.dateRange && node.modified) {
        if (options.dateRange.from && node.modified < options.dateRange.from) {
          return false
        }
        if (options.dateRange.to && node.modified > options.dateRange.to) {
          return false
        }
      }

      return true
    }).sort((a, b) => {
      const sortBy = options.sortBy || 'name'
      const sortOrder = options.sortOrder || 'asc'
      const multiplier = sortOrder === 'asc' ? 1 : -1

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * multiplier
        case 'size':
          return ((a.size || 0) - (b.size || 0)) * multiplier
        case 'modified':
          const aTime = a.modified?.getTime() || 0
          const bTime = b.modified?.getTime() || 0
          return (aTime - bTime) * multiplier
        case 'type':
          return a.type.localeCompare(b.type) * multiplier
        default:
          return 0
      }
    })
  }

  const findNodesByName = (name: string, caseSensitive = false): FileSystemNode[] => {
    const searchName = caseSensitive ? name : name.toLowerCase()
    const allNodes = Array.from(fileTree.value.nodes.values())
    
    return allNodes.filter(node => {
      const nodeName = caseSensitive ? node.name : node.name.toLowerCase()
      return nodeName.includes(searchName)
    })
  }

  const findNodesByType = (type: 'file' | 'directory'): FileSystemNode[] => {
    const allNodes = Array.from(fileTree.value.nodes.values())
    return allNodes.filter(node => node.type === type)
  }

  // File watching
  const watchPath = async (path: string, options: FileWatchOptions = {}): Promise<void> => {
    try {
      const result = await webSocket.sendMessageWithResponse({
        type: 'command',
        command: 'vscode.workspace.watchPath',
        args: [normalizePath(path), options],
        timestamp: Date.now()
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to watch path')
      }
      
      watchedPaths.value.add(normalizePath(path))
    } catch (error) {
      console.error('Failed to watch path:', error)
      throw error
    }
  }

  const unwatchPath = async (path: string): Promise<void> => {
    try {
      const result = await webSocket.sendMessageWithResponse({
        type: 'command',
        command: 'vscode.workspace.unwatchPath',
        args: [normalizePath(path)],
        timestamp: Date.now()
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to unwatch path')
      }
      
      watchedPaths.value.delete(normalizePath(path))
    } catch (error) {
      console.error('Failed to unwatch path:', error)
      throw error
    }
  }

  const onFileChange = (callback: (event: FileWatchEvent) => void): void => {
    fileChangeCallbacks.value.push(callback)
  }

  // Utilities
  const getFileStats = async (path: string): Promise<FileSystemNode> => {
    try {
      const result = await webSocket.sendMessageWithResponse({
        type: 'command',
        command: 'vscode.workspace.getFileStats',
        args: [normalizePath(path)],
        timestamp: Date.now()
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get file stats')
      }
      
      return result.data as FileSystemNode
    } catch (error) {
      console.error('Failed to get file stats:', error)
      throw error
    }
  }

  const validatePath = (path: string): boolean => {
    if (!path || typeof path !== 'string') return false
    
    // Use the comprehensive validation from filesystem-validator
    return isSafePath(path) && validateOperationPath(path, 'read').isValid
  }

  const normalizePath = (path: string): string => {
    if (!path) return ''
    
    // Use the sanitization from filesystem-validator
    return sanitizeFilePath(path)
  }

  const getParentPath = (path: string): string => {
    const normalized = normalizePath(path)
    const lastSlash = normalized.lastIndexOf('/')
    return lastSlash > 0 ? normalized.substring(0, lastSlash) : '/'
  }

  const getFileName = (path: string): string => {
    const normalized = normalizePath(path)
    const lastSlash = normalized.lastIndexOf('/')
    return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized
  }

  const getFileExtension = (path: string): string => {
    const fileName = getFileName(path)
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : ''
  }

  const isDirectory = (path: string): boolean => {
    const node = getNodeByPath(path)
    return node?.type === 'directory' || false
  }

  const exists = async (path: string): Promise<boolean> => {
    try {
      await getFileStats(path)
      return true
    } catch {
      return false
    }
  }

  // Private helper functions
  const executeFileOperation = async (
    operation: FileOperation, 
    options: any = {}
  ): Promise<FileOperationResult> => {
    try {
      const commandMap = {
        create: operation.isDirectory ? 'vscode.workspace.createDirectory' : 'vscode.workspace.createFile',
        delete: operation.isDirectory ? 'vscode.workspace.deleteDirectory' : 'vscode.workspace.deleteFile',
        rename: 'vscode.workspace.renameFile',
        move: 'vscode.workspace.moveFile',
        copy: 'vscode.workspace.copyFile'
      }

      const command = commandMap[operation.type]
      const args = [operation.path]
      
      if (operation.newPath) {
        args.push(operation.newPath)
      }
      
      if (operation.content !== undefined) {
        args.push(operation.content)
      }

      if (Object.keys(options).length > 0) {
        args.push(options)
      }

      const result = await webSocket.sendMessageWithResponse({
        type: 'command',
        command,
        args,
        timestamp: Date.now()
      }, FILE_OPERATION_TIMEOUT)

      if (!result.success) {
        throw new Error(result.error || 'File operation failed')
      }

      // Update file tree after successful operation
      await refreshFileTree(getParentPath(operation.path))
      
      if (operation.newPath) {
        await refreshFileTree(getParentPath(operation.newPath))
      }

      const operationResult: FileOperationResult = {
        success: true,
        operation,
        timestamp: new Date()
      }

      return operationResult
    } catch (error) {
      const operationResult: FileOperationResult = {
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }

      return operationResult
    }
  }

  const processFileNodes = async (nodes: any[], parentPath?: string): Promise<FileSystemNode[]> => {
    const processedNodes: FileSystemNode[] = []

    for (const nodeData of nodes) {
      const node: FileSystemNode = {
        path: normalizePath(nodeData.path || nodeData.uri),
        name: nodeData.name || getFileName(nodeData.path || nodeData.uri),
        type: nodeData.type || (nodeData.isDirectory ? 'directory' : 'file'),
        size: nodeData.size,
        modified: nodeData.modified ? new Date(nodeData.modified) : new Date(),
        created: nodeData.created ? new Date(nodeData.created) : new Date(),
        permissions: nodeData.permissions,
        parent: parentPath || '',
        isExpanded: fileTree.value.expandedPaths.has(nodeData.path || nodeData.uri),
        children: nodeData.children ? await processFileNodes(nodeData.children, nodeData.path || nodeData.uri) : []
      }

      fileTree.value.nodes.set(node.path, node)
      processedNodes.push(node)
    }

    return processedNodes
  }



  const updateStats = (): void => {
    const allNodes = Array.from(fileTree.value.nodes.values())
    
    stats.value = {
      totalFiles: allNodes.filter(n => n.type === 'file').length,
      totalDirectories: allNodes.filter(n => n.type === 'directory').length,
      totalSize: allNodes.reduce((sum, n) => sum + (n.size || 0), 0),
      lastUpdated: new Date()
    }
  }

  const persistTreeState = (): void => {
    try {
      const state = {
        expandedPaths: Array.from(fileTree.value.expandedPaths),
        selectedPath: fileTree.value.selectedPath,
        rootPaths: fileTree.value.rootPaths
      }
      
      localStorage.setItem(`${STORAGE_KEYS.SETTINGS}-file-tree-state`, JSON.stringify(state))
    } catch (error) {
      console.error('Failed to persist tree state:', error)
    }
  }

  const loadPersistedTreeState = (): void => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEYS.SETTINGS}-file-tree-state`)
      if (saved) {
        const state = JSON.parse(saved)
        fileTree.value.expandedPaths = new Set(state.expandedPaths || [])
        fileTree.value.selectedPath = state.selectedPath || null
        fileTree.value.rootPaths = state.rootPaths || []
      }
    } catch (error) {
      console.error('Failed to load persisted tree state:', error)
    }
  }

  // Handle file change events from WebSocket
  const handleFileChangeEvent = (event: FileWatchEvent): void => {
    // Update file tree based on the event
    switch (event.type) {
      case 'created':
      case 'modified':
        refreshFileTree(getParentPath(event.path)).catch(console.error)
        break
      case 'deleted':
        fileTree.value.nodes.delete(event.path)
        if (fileTree.value.selectedPath === event.path) {
          fileTree.value.selectedPath = null
          selectedNode.value = null
        }
        break
      case 'renamed':
        if (event.oldPath) {
          const oldNode = fileTree.value.nodes.get(event.oldPath)
          if (oldNode) {
            fileTree.value.nodes.delete(event.oldPath)
            oldNode.path = event.path
            oldNode.name = getFileName(event.path)
            fileTree.value.nodes.set(event.path, oldNode)
          }
        }
        break
    }

    // Trigger callbacks
    fileChangeCallbacks.value.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error('Error in file change callback:', error)
      }
    })

    updateStats()
  }

  // Set up WebSocket message handling for file events
  webSocket.onMessage((message) => {
    if (message.type === 'broadcast' && message.data?.type === 'fileChange') {
      handleFileChangeEvent(message.data.event)
    }
  })

  // Load persisted state
  loadPersistedTreeState()

  // Cleanup on unmount
  onUnmounted(() => {
    // Unwatch all paths
    watchedPaths.value.forEach(path => {
      unwatchPath(path).catch(console.error)
    })
  })

  return {
    // State
    fileTree,
    currentPath,
    selectedNode,
    isLoading,
    stats,
    watchedPaths,

    // File tree operations
    loadFileTree,
    refreshFileTree,
    expandNode,
    collapseNode,
    selectNode,
    getNodeByPath,

    // File operations
    createFile,
    createDirectory,
    deleteFile,
    deleteDirectory,
    renameFile,
    moveFile,
    copyFile,

    // File content operations
    readFile,
    writeFile,
    appendToFile,

    // Search and filtering
    searchFiles,
    filterNodes,
    findNodesByName,
    findNodesByType,

    // File watching
    watchPath,
    unwatchPath,
    onFileChange,

    // Utilities
    getFileStats,
    validatePath,
    normalizePath,
    getParentPath,
    getFileName,
    getFileExtension,
    isDirectory,
    exists
  }
}