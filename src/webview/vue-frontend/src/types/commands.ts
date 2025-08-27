export interface VSCodeCommand {
  command: string
  title: string
  category?: string
  description?: string
  args?: any[]
  when?: string
}

export interface CommandResult {
  success: boolean
  data?: any
  error?: string
  executionTime: number
  timestamp: number
}

export interface CommandHistoryItem {
  id: string
  command: string
  args?: any[] | undefined
  result: CommandResult
  timestamp: number
  favorite?: boolean
}

export interface CommandCache {
  command: string
  args?: any[] | undefined
  result: any
  timestamp: number
  ttl: number
}

export interface CommandValidationResult {
  isValid: boolean
  error?: string
  suggestions?: string[]
}

export interface QuickCommand {
  id: string
  name: string
  command: string
  args?: any[]
  description?: string
  icon?: string
  category?: string
  shortcut?: string
}

export interface CommandExecutionOptions {
  timeout?: number
  cache?: boolean
  cacheTtl?: number
  retries?: number
  validateArgs?: boolean
}

export interface CommandStats {
  totalExecuted: number
  successCount: number
  errorCount: number
  averageExecutionTime: number
  mostUsedCommands: Array<{
    command: string
    count: number
    lastUsed: number
  }>
}

export type CommandStatus = 'idle' | 'executing' | 'success' | 'error'

export interface CommandState {
  status: CommandStatus
  isExecuting: boolean
  lastCommand: string | null
  lastResult: CommandResult | null
  history: CommandHistoryItem[]
  favorites: string[]
  cache: Map<string, CommandCache>
  stats: CommandStats
}