import { ref, computed, onUnmounted, type Ref } from 'vue'
import type { 
  CommandResult, 
  CommandHistoryItem, 
  CommandCache, 
  CommandExecutionOptions,
  CommandStats,
  CommandStatus
} from '../types/commands'
import type { CommandMessage } from '../types/websocket'
import { useWebSocket } from './useWebSocket'
import { 
  validateCommandArgs, 
  sanitizeCommandArgs, 
  createCommandValidationError,
  getCommandSuggestions 
} from '../utils/command-validator'
import { 
  COMMAND_TIMEOUT, 
  COMMAND_CACHE_TTL, 
  COMMAND_MAX_HISTORY, 
  COMMAND_MAX_RETRIES,
  COMMAND_RETRY_DELAY,
  STORAGE_KEYS 
} from '../utils/constants'

export interface CommandsComposable {
  // State
  isExecuting: Ref<boolean>
  status: Ref<CommandStatus>
  lastResult: Ref<CommandResult | null>
  history: Ref<CommandHistoryItem[]>
  favorites: Ref<string[]>
  stats: Ref<CommandStats>

  // Methods
  executeCommand: (command: string, args?: any[], options?: CommandExecutionOptions) => Promise<any>
  executeCommandWithResponse: (command: string, args?: any[], options?: CommandExecutionOptions) => Promise<any>
  getAvailableCommands: () => Promise<string[]>
  validateCommand: (command: string, args?: any[]) => boolean
  addToFavorites: (command: string) => void
  removeFromFavorites: (command: string) => void
  clearHistory: () => void
  clearCache: () => void
  getCommandSuggestions: (partial: string) => string[]
  
  // Quick commands
  openFile: (path?: string) => Promise<void>
  saveFile: () => Promise<void>
  saveAllFiles: () => Promise<void>
  formatDocument: () => Promise<void>
  newFile: () => Promise<void>
  showCommands: () => Promise<void>
  toggleTerminal: () => Promise<void>
  reloadWindow: () => Promise<void>
}

export function useCommands(): CommandsComposable {
  const webSocket = useWebSocket()
  
  // State
  const isExecuting = ref(false)
  const status = ref<CommandStatus>('idle')
  const lastResult = ref<CommandResult | null>(null)
  const history = ref<CommandHistoryItem[]>([])
  const favorites = ref<string[]>([])
  const cache = ref<Map<string, CommandCache>>(new Map())
  const stats = ref<CommandStats>({
    totalExecuted: 0,
    successCount: 0,
    errorCount: 0,
    averageExecutionTime: 0,
    mostUsedCommands: []
  })

  // Computed
  const canExecute = computed(() => !isExecuting.value && webSocket.isConnected.value)

  // Core command execution
  const executeCommand = async (
    command: string, 
    args?: any[], 
    options: CommandExecutionOptions = {}
  ): Promise<any> => {
    const {
      timeout = COMMAND_TIMEOUT,
      cache: useCache = false,
      cacheTtl = COMMAND_CACHE_TTL,
      retries = COMMAND_MAX_RETRIES,
      validateArgs: shouldValidateArgs = true
    } = options

    // Validate command
    if (shouldValidateArgs) {
      const validation = validateCommandArgs(command, args)
      if (!validation.isValid) {
        throw createCommandValidationError(validation.error ?? 'Invalid command', command, args)
      }
    }

    // Check cache first
    if (useCache) {
      const cached = getCachedResult(command, args)
      if (cached) {
        return cached.result
      }
    }

    // Sanitize arguments
    const sanitizedArgs = sanitizeCommandArgs(args)

    // Execute with retries
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await executeCommandInternal(command, sanitizedArgs, timeout)
        
        // Cache successful result
        if (useCache && result.success) {
          setCachedResult(command, sanitizedArgs, result.data, cacheTtl)
        }

        return result.data
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, COMMAND_RETRY_DELAY * (attempt + 1)))
        }
      }
    }

    throw lastError
  } 
 // Internal command execution
  const executeCommandInternal = async (
    command: string, 
    args?: any[], 
    timeout: number = COMMAND_TIMEOUT
  ): Promise<CommandResult> => {
    if (!canExecute.value) {
      throw new Error('Cannot execute command: WebSocket not connected or another command is executing')
    }

    isExecuting.value = true
    status.value = 'executing'
    
    const startTime = Date.now()
    const historyId = `cmd_${startTime}_${Math.random().toString(36).substr(2, 9)}`

    try {
      const message: CommandMessage = {
        type: 'command',
        command,
        args,
        timestamp: startTime
      }

      const response = await webSocket.sendMessageWithResponse(message, timeout)
      const executionTime = Date.now() - startTime

      const result: CommandResult = {
        success: true,
        data: response,
        executionTime,
        timestamp: startTime
      }

      // Update state
      lastResult.value = result
      status.value = 'success'
      
      // Add to history
      addToHistory({
        id: historyId,
        command,
        args,
        result,
        timestamp: startTime
      })

      // Update stats
      updateStats(command, result)

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      const result: CommandResult = {
        success: false,
        error: errorMessage,
        executionTime,
        timestamp: startTime
      }

      // Update state
      lastResult.value = result
      status.value = 'error'

      // Add to history
      addToHistory({
        id: historyId,
        command,
        args,
        result,
        timestamp: startTime
      })

      // Update stats
      updateStats(command, result)

      throw error
    } finally {
      isExecuting.value = false
      // Reset status after a delay
      setTimeout(() => {
        if (status.value !== 'executing') {
          status.value = 'idle'
        }
      }, 2000)
    }
  }

  // Command execution with response handling
  const executeCommandWithResponse = async (
    command: string, 
    args?: any[], 
    options: CommandExecutionOptions = {}
  ): Promise<any> => {
    return executeCommand(command, args, options)
  }

  // Get available commands
  const getAvailableCommands = async (): Promise<string[]> => {
    try {
      const response = await executeCommand('vscode.getCommands')
      return Array.isArray(response) ? response : []
    } catch (error) {
      console.error('Failed to get available commands:', error)
      return getCommandSuggestions('')
    }
  }

  // Validate command
  const validateCommand = (command: string, args?: any[]): boolean => {
    const validation = validateCommandArgs(command, args)
    return validation.isValid
  }

  // History management
  const addToHistory = (item: CommandHistoryItem): void => {
    history.value.unshift(item)
    
    // Limit history size
    if (history.value.length > COMMAND_MAX_HISTORY) {
      history.value = history.value.slice(0, COMMAND_MAX_HISTORY)
    }

    persistHistory()
  }

  const clearHistory = (): void => {
    history.value = []
    persistHistory()
  }

  // Favorites management
  const addToFavorites = (command: string): void => {
    if (!favorites.value.includes(command)) {
      favorites.value.push(command)
      persistFavorites()
    }
  }

  const removeFromFavorites = (command: string): void => {
    const index = favorites.value.indexOf(command)
    if (index > -1) {
      favorites.value.splice(index, 1)
      persistFavorites()
    }
  }

  // Cache management
  const getCachedResult = (command: string, args?: any[]): CommandCache | null => {
    const key = createCacheKey(command, args)
    const cached = cache.value.get(key)
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached
    }
    
    // Remove expired cache
    if (cached) {
      cache.value.delete(key)
    }
    
    return null
  }

  const setCachedResult = (command: string, args: any[] | undefined, result: any, ttl: number): void => {
    const key = createCacheKey(command, args)
    cache.value.set(key, {
      command,
      args,
      result,
      timestamp: Date.now(),
      ttl
    })
  }

  const createCacheKey = (command: string, args?: any[]): string => {
    return `${command}:${JSON.stringify(args ?? [])}`
  }

  const clearCache = (): void => {
    cache.value.clear()
  }

  // Stats management
  const updateStats = (command: string, result: CommandResult): void => {
    stats.value.totalExecuted++
    
    if (result.success) {
      stats.value.successCount++
    } else {
      stats.value.errorCount++
    }

    // Update average execution time
    const totalTime = stats.value.averageExecutionTime * (stats.value.totalExecuted - 1) + result.executionTime
    stats.value.averageExecutionTime = totalTime / stats.value.totalExecuted

    // Update most used commands
    const existingCommand = stats.value.mostUsedCommands.find(c => c.command === command)
    if (existingCommand) {
      existingCommand.count++
      existingCommand.lastUsed = Date.now()
    } else {
      stats.value.mostUsedCommands.push({
        command,
        count: 1,
        lastUsed: Date.now()
      })
    }

    // Sort and limit most used commands
    stats.value.mostUsedCommands.sort((a, b) => b.count - a.count)
    stats.value.mostUsedCommands = stats.value.mostUsedCommands.slice(0, 20)

    persistStats()
  }

  // Quick command shortcuts
  const openFile = async (path?: string): Promise<void> => {
    if (path) {
      await executeCommand('vscode.open', [path])
    } else {
      await executeCommand('workbench.action.files.openFile')
    }
  }

  const saveFile = async (): Promise<void> => {
    await executeCommand('workbench.action.files.save')
  }

  const saveAllFiles = async (): Promise<void> => {
    await executeCommand('workbench.action.files.saveAll')
  }

  const formatDocument = async (): Promise<void> => {
    await executeCommand('editor.action.formatDocument')
  }

  const newFile = async (): Promise<void> => {
    await executeCommand('workbench.action.files.newUntitledFile')
  }

  const showCommands = async (): Promise<void> => {
    await executeCommand('workbench.action.showCommands')
  }

  const toggleTerminal = async (): Promise<void> => {
    await executeCommand('workbench.action.terminal.toggleTerminal')
  }

  const reloadWindow = async (): Promise<void> => {
    await executeCommand('workbench.action.reloadWindow')
  }

  // Persistence functions
  const loadPersistedData = (): void => {
    try {
      // Load history
      const savedHistory = localStorage.getItem(`${STORAGE_KEYS.SETTINGS}-command-history`)
      if (savedHistory) {
        history.value = JSON.parse(savedHistory)
      }

      // Load favorites
      const savedFavorites = localStorage.getItem(`${STORAGE_KEYS.SETTINGS}-command-favorites`)
      if (savedFavorites) {
        favorites.value = JSON.parse(savedFavorites)
      }

      // Load stats
      const savedStats = localStorage.getItem(`${STORAGE_KEYS.SETTINGS}-command-stats`)
      if (savedStats) {
        stats.value = { ...stats.value, ...JSON.parse(savedStats) }
      }
    } catch (error) {
      console.error('Failed to load persisted command data:', error)
    }
  }

  const persistHistory = (): void => {
    try {
      localStorage.setItem(`${STORAGE_KEYS.SETTINGS}-command-history`, JSON.stringify(history.value))
    } catch (error) {
      console.error('Failed to persist command history:', error)
    }
  }

  const persistFavorites = (): void => {
    try {
      localStorage.setItem(`${STORAGE_KEYS.SETTINGS}-command-favorites`, JSON.stringify(favorites.value))
    } catch (error) {
      console.error('Failed to persist command favorites:', error)
    }
  }

  const persistStats = (): void => {
    try {
      localStorage.setItem(`${STORAGE_KEYS.SETTINGS}-command-stats`, JSON.stringify(stats.value))
    } catch (error) {
      console.error('Failed to persist command stats:', error)
    }
  }

  // Load persisted data
  loadPersistedData()

  // Cleanup on unmount
  onUnmounted(() => {
    clearCache()
  })

  return {
    // State
    isExecuting,
    status,
    lastResult,
    history,
    favorites,
    stats,

    // Methods
    executeCommand,
    executeCommandWithResponse,
    getAvailableCommands,
    validateCommand,
    addToFavorites,
    removeFromFavorites,
    clearHistory,
    clearCache,
    getCommandSuggestions,

    // Quick commands
    openFile,
    saveFile,
    saveAllFiles,
    formatDocument,
    newFile,
    showCommands,
    toggleTerminal,
    reloadWindow
  }
}