import type { FileSystemNode } from '../../types/filesystem'

// Main component props
export interface FileSystemMenuProps {
  initialPath?: string
  showPreview?: boolean
  allowMultiSelect?: boolean
  height?: string | number
  className?: string
}

// File tree panel props
export interface FileTreePanelProps {
  searchQuery: string
  selectedPath: string | null
  expandedPaths: Set<string>
  loadingPaths: Set<string>
  fileTree: Map<string, FileSystemNode>
}

// File tree node props
export interface FileTreeNodeProps {
  node: FileSystemNode
  level: number
  isSelected: boolean
  isExpanded: boolean
  isLoading: boolean
  searchQuery?: string
}

// File preview panel props
export interface FilePreviewPanelProps {
  selectedPath: string | null
  previewContent: FilePreviewContent | null
  loading: boolean
  error: string | null
  visible: boolean
}

// Preview content types
export interface FilePreviewContent {
  path: string
  type: 'text' | 'image' | 'binary' | 'directory'
  content?: string
  metadata: FileMetadata
  language?: string
  size: number
  encoding?: string
}

export interface FileMetadata {
  name: string
  path: string
  size: number
  modified: Date
  created: Date
  type: 'file' | 'directory'
  permissions?: FilePermissions
  isHidden?: boolean
  extension?: string
  mimeType?: string
}

export interface FilePermissions {
  readable: boolean
  writable: boolean
  executable: boolean
}

// Text preview props
export interface TextPreviewProps {
  content: string
  language: string
  path: string
  maxLines?: number
  showLineNumbers?: boolean
}

// Image preview props
export interface ImagePreviewProps {
  src: string
  alt: string
  maxWidth?: number
  maxHeight?: number
  showMetadata?: boolean
}

// Binary file info props
export interface BinaryFileInfoProps {
  metadata: FileMetadata
  showDetails?: boolean
}

// Context menu types
export interface ContextMenuProps {
  x: number
  y: number
  node: FileSystemNode | null
  actions: ContextMenuAction[]
}

export interface ContextMenuAction {
  id: string
  label: string
  icon: string
  shortcut?: string
  disabled?: boolean
  separator?: boolean
}

export interface ContextMenuEvent {
  node: FileSystemNode
  x: number
  y: number
}

// Store state interfaces
export interface FileSystemMenuState {
  // Tree state
  fileTree: Map<string, FileSystemNode>
  selectedPath: string | null
  expandedPaths: Set<string>
  loadingPaths: Set<string>
  
  // Search state
  searchQuery: string
  searchResults: FileSystemNode[]
  isSearchActive: boolean
  
  // Preview state
  previewContent: FilePreviewContent | null
  previewLoading: boolean
  previewError: string | null
  previewVisible: boolean
  
  // UI state
  splitPaneSize: number
  contextMenu: ContextMenuState
  
  // Connection state
  isConnected: boolean
  isLoading: boolean
  lastSync: Date | null
}

export interface ContextMenuState {
  show: boolean
  x: number
  y: number
  node: FileSystemNode | null
}

// Search interfaces
export interface SearchOptions {
  query: string
  caseSensitive: boolean
  useRegex: boolean
  includeContent: boolean
  fileTypes: string[]
  maxResults: number
}

export interface SearchResult {
  path: string
  name: string
  type: 'file' | 'directory'
  matches: SearchMatch[]
  score: number
}

export interface SearchMatch {
  type: 'filename' | 'path' | 'content'
  text: string
  startIndex: number
  endIndex: number
  line?: number
  column?: number
}

// Event interfaces
export interface FileSystemEvent {
  type: 'file-changed' | 'file-created' | 'file-deleted' | 'file-renamed'
  path: string
  oldPath?: string
  timestamp: Date
  metadata?: FileMetadata
}

// Error interfaces
export interface FileSystemError extends Error {
  code: string
  path?: string
  operation?: string
  recoverable: boolean
}

// Clipboard interfaces
export interface ClipboardOperation {
  type: 'copy-path' | 'copy-relative-path' | 'copy-content'
  path: string
  content?: string
}

// VS Code integration interfaces
export interface VSCodeCommand {
  command: string
  args: any[]
  title?: string
}

export interface VSCodeFileOperation {
  type: 'open' | 'reveal'
  path: string
  options?: {
    preview?: boolean
    selection?: {
      start: { line: number; character: number }
      end: { line: number; character: number }
    }
  }
}

// Performance optimization interfaces
export interface VirtualScrollConfig {
  itemHeight: number
  containerHeight: number
  overscan: number
  estimatedItemCount: number
}

export interface CacheConfig {
  maxSize: number
  ttl: number // Time to live in milliseconds
}

// Accessibility interfaces
export interface AccessibilityProps {
  'aria-label': string
  'aria-expanded'?: boolean
  'aria-selected'?: boolean
  'aria-level'?: number
  'role': 'tree' | 'treeitem' | 'button' | 'menuitem'
  'tabindex': number
}

// Keyboard navigation interfaces
export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: string
  description: string
}

// Theme interfaces
export interface ThemeColors {
  background: string
  foreground: string
  border: string
  hover: string
  selected: string
  focus: string
  error: string
  warning: string
  success: string
}