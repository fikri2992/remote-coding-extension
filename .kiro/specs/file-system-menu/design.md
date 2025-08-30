# File System Menu Design Document

## Overview

The File System Menu is a read-only file browser component that provides users with an intuitive interface to navigate, preview, and copy files within their VS Code workspace. The component integrates with the existing WebSocket architecture and file system composable to deliver real-time file system synchronization and efficient file operations.

The design follows a split-pane layout with a file tree on the left and a content preview pane on the right, optimized for both navigation efficiency and content discovery.

## Architecture

### Component Hierarchy

```
FileSystemMenu (Main Container)
├── FileSystemToolbar
│   ├── SearchInput
│   ├── ViewToggleButtons
│   └── ConnectionStatus
├── FileSystemSplitPane
│   ├── FileTreePanel
│   │   ├── FileTreeHeader
│   │   ├── FileTreeSearch
│   │   ├── FileTreeView
│   │   │   ├── FileTreeNode (recursive)
│   │   │   │   ├── FileIcon
│   │   │   │   ├── FileName
│   │   │   │   └── FileActions
│   │   │   └── VirtualScrollContainer
│   │   └── FileTreeFooter
│   └── FilePreviewPanel
│       ├── PreviewHeader
│       ├── PreviewContent
│       │   ├── TextPreview
│       │   ├── ImagePreview
│       │   ├── BinaryFileInfo
│       │   └── EmptyState
│       └── PreviewFooter
└── ContextMenu
    ├── CopyPathAction
    ├── CopyRelativePathAction
    ├── CopyContentAction
    ├── OpenInEditorAction
    └── RevealInExplorerAction
```

### State Management Architecture

```typescript
// Main store structure
interface FileSystemMenuState {
  // Tree state
  fileTree: FileTreeState
  selectedPath: string | null
  expandedPaths: Set<string>
  
  // UI state
  searchQuery: string
  isSearchActive: boolean
  previewVisible: boolean
  splitPaneSize: number
  
  // Preview state
  previewContent: FilePreviewContent | null
  previewLoading: boolean
  previewError: string | null
  
  // Connection state
  isConnected: boolean
  isLoading: boolean
  lastSync: Date | null
}

interface FilePreviewContent {
  path: string
  type: 'text' | 'image' | 'binary' | 'directory'
  content?: string
  metadata: FileMetadata
  language?: string
  size: number
}
```

## Components and Interfaces

### 1. FileSystemMenu (Main Container)

**Purpose:** Root component that orchestrates the entire file system menu functionality.

**Key Responsibilities:**
- Initialize file system composable and WebSocket connections
- Manage global state and coordinate between child components
- Handle keyboard shortcuts and global event listeners
- Provide error boundary and loading states

**Props Interface:**
```typescript
interface FileSystemMenuProps {
  initialPath?: string
  showPreview?: boolean
  allowMultiSelect?: boolean
  height?: string | number
  className?: string
}
```

**State Management:**
- Uses Pinia store for centralized state management
- Integrates with existing connection store for WebSocket state
- Implements local storage persistence for UI preferences

### 2. FileTreePanel

**Purpose:** Left panel containing the hierarchical file tree with search and navigation capabilities.

**Key Features:**
- Virtual scrolling for performance with large directories
- Lazy loading of directory contents
- Real-time search with debounced input
- Keyboard navigation support
- Context menu integration

**Component Structure:**
```typescript
interface FileTreePanelProps {
  searchQuery: string
  selectedPath: string | null
  onSelect: (path: string) => void
  onExpand: (path: string) => void
  onCollapse: (path: string) => void
}

interface FileTreeNodeProps {
  node: FileSystemNode
  level: number
  isSelected: boolean
  isExpanded: boolean
  onSelect: (path: string) => void
  onToggle: (path: string) => void
  onContextMenu: (event: MouseEvent, path: string) => void
}
```

### 3. FilePreviewPanel

**Purpose:** Right panel displaying file content previews and metadata.

**Preview Types:**
- **Text Preview:** Syntax-highlighted code with line numbers
- **Image Preview:** Responsive image display with zoom controls
- **Binary File Info:** File metadata and type information
- **Directory Summary:** Contents count and size information
- **Empty State:** Placeholder when no file is selected

**Component Interface:**
```typescript
interface FilePreviewPanelProps {
  selectedPath: string | null
  content: FilePreviewContent | null
  loading: boolean
  error: string | null
}

interface TextPreviewProps {
  content: string
  language: string
  path: string
  maxLines?: number
}

interface ImagePreviewProps {
  src: string
  alt: string
  maxWidth?: number
  maxHeight?: number
}
```

### 4. ContextMenu

**Purpose:** Provides contextual actions for files and directories.

**Menu Structure:**
```typescript
interface ContextMenuAction {
  id: string
  label: string
  icon: string
  shortcut?: string
  disabled?: boolean
  separator?: boolean
  action: (path: string) => void | Promise<void>
}

// File context menu actions
const fileActions: ContextMenuAction[] = [
  { id: 'copy-path', label: 'Copy Path', icon: 'copy', shortcut: 'Ctrl+C' },
  { id: 'copy-relative-path', label: 'Copy Relative Path', icon: 'copy' },
  { id: 'copy-content', label: 'Copy File Content', icon: 'file-text', shortcut: 'Ctrl+Shift+C' },
  { id: 'separator-1', separator: true },
  { id: 'open-editor', label: 'Open in Editor', icon: 'edit', shortcut: 'Enter' },
  { id: 'reveal-explorer', label: 'Reveal in Explorer', icon: 'folder-open' }
]

// Directory context menu actions
const directoryActions: ContextMenuAction[] = [
  { id: 'copy-path', label: 'Copy Path', icon: 'copy', shortcut: 'Ctrl+C' },
  { id: 'copy-relative-path', label: 'Copy Relative Path', icon: 'copy' },
  { id: 'separator-1', separator: true },
  { id: 'reveal-explorer', label: 'Reveal in Explorer', icon: 'folder-open' }
]
```

## Data Models

### File System Integration

**WebSocket Message Protocol:**
```typescript
// File tree loading
interface FileTreeRequest extends WebSocketMessage {
  type: 'command'
  command: 'vscode.workspace.getFileTree'
  args: [string] // root path
}

// File content loading
interface FileContentRequest extends WebSocketMessage {
  type: 'command'
  command: 'vscode.workspace.readFile'
  args: [string] // file path
}

// File watching
interface FileWatchRequest extends WebSocketMessage {
  type: 'command'
  command: 'vscode.workspace.watchPath'
  args: [string, FileWatchOptions]
}
```

**File System Events:**
```typescript
interface FileSystemEvent {
  type: 'file-changed' | 'file-created' | 'file-deleted' | 'file-renamed'
  path: string
  oldPath?: string
  timestamp: Date
  metadata?: FileMetadata
}
```

### Search and Filtering

**Search Implementation:**
```typescript
interface SearchOptions {
  query: string
  caseSensitive: boolean
  useRegex: boolean
  includeContent: boolean
  fileTypes: string[]
  maxResults: number
}

interface SearchResult {
  path: string
  name: string
  type: 'file' | 'directory'
  matches: SearchMatch[]
  score: number
}

interface SearchMatch {
  type: 'filename' | 'path' | 'content'
  text: string
  startIndex: number
  endIndex: number
  line?: number
  column?: number
}
```

## Error Handling

### Error Categories and Recovery

**Connection Errors:**
```typescript
interface ConnectionError extends AppError {
  category: 'connection'
  recoveryActions: [
    { label: 'Retry Connection', action: () => reconnect() },
    { label: 'Refresh Tree', action: () => refreshFileTree() }
  ]
}
```

**File Access Errors:**
```typescript
interface FileAccessError extends AppError {
  category: 'file-access'
  path: string
  operation: 'read' | 'preview' | 'metadata'
  recoveryActions: [
    { label: 'Retry', action: () => retryOperation() },
    { label: 'Skip File', action: () => selectNextFile() }
  ]
}
```

**Search Errors:**
```typescript
interface SearchError extends AppError {
  category: 'search'
  query: string
  recoveryActions: [
    { label: 'Clear Search', action: () => clearSearch() },
    { label: 'Modify Query', action: () => focusSearchInput() }
  ]
}
```

### Error Boundaries

**Component-Level Error Handling:**
- FileTreePanel: Graceful degradation when tree loading fails
- FilePreviewPanel: Show error state when preview fails
- SearchInput: Handle invalid regex patterns and timeout errors
- ContextMenu: Disable actions when operations are not available

## Testing Strategy

### Unit Testing

**Component Testing:**
```typescript
// FileTreeNode component tests
describe('FileTreeNode', () => {
  test('renders file icon and name correctly')
  test('handles expand/collapse for directories')
  test('shows loading state during expansion')
  test('applies correct selection styling')
  test('triggers context menu on right-click')
})

// FilePreviewPanel component tests
describe('FilePreviewPanel', () => {
  test('displays text content with syntax highlighting')
  test('shows image preview for image files')
  test('displays metadata for binary files')
  test('handles loading and error states')
  test('updates content when selection changes')
})
```

**Composable Testing:**
```typescript
// File system composable tests
describe('useFileSystem', () => {
  test('loads file tree from WebSocket')
  test('handles file tree expansion')
  test('processes file change events')
  test('implements search functionality')
  test('manages clipboard operations')
})
```

### Integration Testing

**WebSocket Integration:**
```typescript
describe('FileSystem WebSocket Integration', () => {
  test('sends correct messages for file operations')
  test('handles server responses appropriately')
  test('processes real-time file change events')
  test('recovers from connection failures')
})
```

**VS Code Integration:**
```typescript
describe('VS Code Integration', () => {
  test('opens files in VS Code editor')
  test('reveals files in VS Code explorer')
  test('copies paths to system clipboard')
  test('handles VS Code command failures')
})
```

### Performance Testing

**Large File Tree Testing:**
```typescript
describe('Performance with Large Trees', () => {
  test('virtual scrolling with 10,000+ files')
  test('search performance with large datasets')
  test('memory usage during extended navigation')
  test('UI responsiveness during bulk operations')
})
```

## Performance Optimizations

### Virtual Scrolling Implementation

**Tree Virtualization:**
```typescript
interface VirtualScrollConfig {
  itemHeight: number
  containerHeight: number
  overscan: number
  estimatedItemCount: number
}

class VirtualTreeRenderer {
  private visibleRange: { start: number; end: number }
  private itemPositions: Map<string, number>
  
  calculateVisibleItems(scrollTop: number): FileSystemNode[]
  updateItemPositions(nodes: FileSystemNode[]): void
  getItemOffset(index: number): number
}
```

### Lazy Loading Strategy

**Directory Loading:**
- Load only visible directory contents
- Implement progressive loading for large directories
- Cache expanded directory contents with TTL
- Preload adjacent directories for smooth navigation

**Content Preview:**
- Lazy load file content only when selected
- Implement content streaming for large files
- Cache recently viewed file content
- Debounce preview updates during rapid navigation

### Memory Management

**Cleanup Strategies:**
```typescript
class FileSystemMemoryManager {
  private contentCache: LRUCache<string, FileContent>
  private previewCache: LRUCache<string, PreviewData>
  
  cleanupCollapsedDirectories(): void
  evictOldContent(): void
  optimizeTreeStructure(): void
}
```

## Accessibility

### Keyboard Navigation

**Navigation Patterns:**
- Arrow keys: Navigate between tree items
- Enter/Space: Select item and show preview
- Tab: Move between tree and preview panels
- Escape: Close context menus and clear selection
- Ctrl+F: Focus search input
- Ctrl+C: Copy selected item path

**Screen Reader Support:**
```typescript
interface AccessibilityProps {
  'aria-label': string
  'aria-expanded'?: boolean
  'aria-selected'?: boolean
  'aria-level'?: number
  'role': 'tree' | 'treeitem' | 'button'
  'tabindex': number
}
```

### Visual Accessibility

**High Contrast Support:**
- Ensure sufficient color contrast ratios
- Provide alternative visual indicators for color-coded information
- Support system high contrast mode
- Implement focus indicators for keyboard navigation

**Responsive Design:**
- Support zoom levels up to 200%
- Maintain functionality on mobile devices
- Provide collapsible panels for small screens
- Implement touch-friendly interaction targets

## Security Considerations

### Path Validation

**Security Measures:**
```typescript
class PathValidator {
  validatePath(path: string): ValidationResult
  sanitizePath(path: string): string
  isPathSafe(path: string): boolean
  preventDirectoryTraversal(path: string): boolean
}
```

### Content Sanitization

**File Content Security:**
- Sanitize file content before preview display
- Prevent XSS attacks in text preview
- Validate file types before processing
- Implement content size limits for previews

### Clipboard Security

**Clipboard Operations:**
- Validate content before copying to clipboard
- Implement size limits for clipboard operations
- Sanitize paths before clipboard access
- Handle clipboard permission errors gracefully

## Deployment and Configuration

### Build Configuration

**Webpack Optimization:**
```javascript
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        fileSystem: {
          name: 'file-system-menu',
          test: /[\\/]file-system[\\/]/,
          priority: 10
        }
      }
    }
  }
}
```

### Environment Configuration

**Development vs Production:**
```typescript
interface FileSystemConfig {
  maxFileSize: number // Max file size for preview
  maxDirectoryItems: number // Max items to load per directory
  searchDebounceMs: number // Search input debounce
  cacheSize: number // LRU cache size
  virtualScrollItemHeight: number // Virtual scroll item height
  previewTimeout: number // Preview loading timeout
}
```

This design provides a comprehensive foundation for implementing a read-only file system menu that integrates seamlessly with the existing VS Code extension architecture while delivering excellent performance and user experience.


## GIT MANAGEMENT

- Create a branch for this tasks: `feature/vue-frontend-modernization`
- Commit every task with proper message and description on what we're doing
- Setup every task with proper commit message and description