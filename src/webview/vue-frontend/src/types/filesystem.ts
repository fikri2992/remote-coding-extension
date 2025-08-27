export interface FileSystemNode {
  path: string
  name: string
  type: 'file' | 'directory'
  size?: number
  modified: Date
  created: Date
  permissions?: FilePermissions
  children?: FileSystemNode[]
  isExpanded?: boolean
  isLoading?: boolean
  parent: string
}

export interface FilePermissions {
  readable: boolean
  writable: boolean
  executable: boolean
}

export interface FileContent {
  path: string
  content: string
  encoding?: string
  language?: string
  size: number
  modified: Date
}

export interface FileOperation {
  type: 'create' | 'delete' | 'rename' | 'move' | 'copy'
  path: string
  newPath?: string
  content?: string
  isDirectory?: boolean
}

export interface FileOperationResult {
  success: boolean
  operation: FileOperation
  error?: string
  timestamp: Date
}

export interface FileSearchOptions {
  query: string
  includeFiles?: boolean
  includeDirectories?: boolean
  caseSensitive?: boolean
  useRegex?: boolean
  maxResults?: number
  excludePatterns?: string[]
  includePatterns?: string[]
}

export interface FileSearchResult {
  path: string
  name: string
  type: 'file' | 'directory'
  matches?: FileSearchMatch[]
  score?: number
}

export interface FileSearchMatch {
  line: number
  column: number
  text: string
  context?: string
}

export interface FileWatchOptions {
  recursive?: boolean
  includeFiles?: boolean
  includeDirectories?: boolean
  excludePatterns?: string[]
}

export interface FileWatchEvent {
  type: 'created' | 'modified' | 'deleted' | 'renamed'
  path: string
  oldPath?: string
  timestamp: Date
}

export interface FileSystemStats {
  totalFiles: number
  totalDirectories: number
  totalSize: number
  lastUpdated: Date
}

export interface FileTreeState {
  nodes: Map<string, FileSystemNode>
  expandedPaths: Set<string>
  selectedPath: string | null
  loadingPaths: Set<string>
  rootPaths: string[]
}

export interface FileFilterOptions {
  showHidden?: boolean
  fileTypes?: string[]
  sizeRange?: { min?: number; max?: number }
  dateRange?: { from?: Date; to?: Date }
  sortBy?: 'name' | 'size' | 'modified' | 'type'
  sortOrder?: 'asc' | 'desc'
}