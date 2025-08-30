# File System Menu Documentation

## Overview

The File System Menu is a comprehensive read-only file browser component that provides users with an intuitive interface to navigate, preview, and copy files within their VS Code workspace. It integrates seamlessly with the existing WebSocket architecture and delivers real-time file system synchronization.

## Features

### Core Functionality
- **Hierarchical File Tree**: Browse workspace files and directories in a tree structure
- **File Preview**: View file content with syntax highlighting for text files and image preview
- **Search**: Find files and directories with real-time filtering
- **Copy Operations**: Copy file paths, relative paths, and file content to clipboard
- **VS Code Integration**: Open files in VS Code editor and reveal in explorer
- **Real-time Updates**: Automatic synchronization with file system changes

### User Interface
- **Split Pane Layout**: Resizable panels for tree view and preview
- **Context Menus**: Right-click actions for files and directories
- **Keyboard Navigation**: Full keyboard support with shortcuts
- **Error Handling**: Graceful error recovery with user-friendly messages
- **Connection Status**: Visual indicators for WebSocket connection state

## Architecture

### Component Structure

```
FileSystemMenu (Main Container)
├── FileTreePanel (Left Panel)
│   ├── Search Input
│   ├── File Tree View
│   └── Virtual Scrolling
├── FilePreviewPanel (Right Panel)
│   ├── Text Preview (with syntax highlighting)
│   ├── Image Preview
│   ├── Binary File Info
│   └── Directory Summary
└── Context Menu
    ├── Copy Actions
    ├── VS Code Integration
    └── File Operations
```

### State Management

The File System Menu uses Pinia for centralized state management with the following stores:

- **FileSystemMenuStore**: Core file system operations and state
- **ConnectionStore**: WebSocket connection management
- **UIStore**: User interface state and notifications

### WebSocket Integration

The component integrates with the VS Code extension through WebSocket communication:

- **File Tree Loading**: Loads directory contents on-demand
- **File Content Reading**: Fetches file content for preview
- **File Watching**: Real-time file system change notifications
- **VS Code Commands**: Opens files and reveals in explorer

## Usage

### Basic Integration

```vue
<template>
  <FileSystemMenu
    :initial-path="workspacePath"
    :show-preview="true"
    :allow-multi-select="false"
    height="100%"
  />
</template>

<script setup>
import FileSystemMenu from '@/components/file-system-menu/FileSystemMenu.vue'

const workspacePath = ref('.')
</script>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialPath` | `string` | `'.'` | Initial path to load in the file tree |
| `showPreview` | `boolean` | `true` | Whether to show the preview panel |
| `allowMultiSelect` | `boolean` | `false` | Enable multiple file selection |
| `height` | `string \| number` | `'100%'` | Component height |
| `className` | `string` | `''` | Additional CSS classes |

### Events

The component emits the following events:

- `file-select`: When a file is selected
- `directory-expand`: When a directory is expanded
- `search-query`: When search query changes
- `error`: When an error occurs

## API Reference

### FileSystemMenuStore

#### State

```typescript
interface FileSystemMenuState {
  fileTree: Map<string, FileSystemNode>
  selectedPath: string | null
  expandedPaths: Set<string>
  searchQuery: string
  previewContent: FilePreviewContent | null
  isConnected: boolean
  isLoading: boolean
}
```

#### Actions

- `initialize(initialPath?: string)`: Initialize the file system menu
- `selectNode(path: string)`: Select a file or directory
- `expandNode(path: string)`: Expand a directory
- `collapseNode(path: string)`: Collapse a directory
- `setSearchQuery(query: string)`: Set search query
- `copyPath(path: string)`: Copy file path to clipboard
- `copyFileContent(path: string)`: Copy file content to clipboard
- `openInEditor(path: string)`: Open file in VS Code editor
- `revealInExplorer(path: string)`: Reveal file in VS Code explorer

### File System Node

```typescript
interface FileSystemNode {
  path: string
  name: string
  type: 'file' | 'directory'
  size?: number
  modified: Date
  created: Date
  parent?: string
  children?: FileSystemNode[]
  isExpanded?: boolean
  permissions?: string
}
```

### File Preview Content

```typescript
interface FilePreviewContent {
  path: string
  type: 'text' | 'image' | 'binary' | 'directory'
  content?: string
  metadata: FileMetadata
  language?: string
  size: number
  encoding?: string
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Copy selected file path |
| `Ctrl+Shift+C` | Copy selected file content |
| `Enter` | Open selected file in VS Code |
| `Space` | Toggle file preview |
| `Escape` | Close context menu |
| `Ctrl+F` | Focus search input |
| `Arrow Keys` | Navigate file tree |

## Error Handling

The File System Menu implements comprehensive error handling:

### Error Boundaries
- Component-level error boundaries prevent crashes
- Fallback UI components for graceful degradation
- Error reporting and recovery actions

### Connection Errors
- Visual connection status indicators
- Automatic reconnection attempts
- Graceful handling of disconnected state

### File Operation Errors
- User-friendly error messages
- Specific error handling for different scenarios
- Recovery suggestions and retry options

## Performance Optimizations

### Virtual Scrolling
- Handles large directory structures efficiently
- Renders only visible items
- Smooth scrolling performance

### Lazy Loading
- Loads directory contents on-demand
- Progressive loading for large directories
- Efficient memory usage

### Caching
- LRU cache for file content
- Persistent state storage
- Optimized re-rendering

### Bundle Optimization
- Code splitting by feature
- Tree shaking for unused code
- Optimized chunk sizes

## Accessibility

### Keyboard Navigation
- Full keyboard accessibility
- Proper tab order and focus management
- Screen reader support

### Visual Accessibility
- High contrast mode support
- Sufficient color contrast ratios
- Clear focus indicators
- Responsive design

### ARIA Support
- Proper ARIA labels and roles
- Screen reader announcements
- Semantic HTML structure

## Testing

### Unit Tests
- Component behavior testing
- Store action testing
- Utility function testing

### Integration Tests
- WebSocket communication testing
- File system operation testing
- Error handling testing

### Performance Tests
- Large file tree handling
- Memory usage monitoring
- Rendering performance

## Configuration

### Environment Variables

```env
# WebSocket connection
VITE_WS_BASE_URL=ws://localhost:8081

# API endpoints
VITE_API_BASE_URL=http://localhost:8080

# Feature flags
VITE_ENABLE_FILE_WATCHING=true
VITE_ENABLE_VIRTUAL_SCROLLING=true
```

### Build Configuration

The component is optimized for production builds with:

- Code splitting by feature
- CSS optimization
- Asset optimization
- Bundle analysis

## Troubleshooting

### Common Issues

#### Connection Problems
- **Symptom**: "Not connected to VS Code" message
- **Solution**: Ensure VS Code extension is running and WebSocket server is active

#### File Loading Issues
- **Symptom**: Files not loading or empty tree
- **Solution**: Check workspace path and file permissions

#### Performance Issues
- **Symptom**: Slow rendering with large directories
- **Solution**: Enable virtual scrolling and check browser performance

#### Search Not Working
- **Symptom**: Search returns no results
- **Solution**: Verify WebSocket connection and search query format

### Debug Mode

Enable debug mode for detailed logging:

```javascript
// In browser console
localStorage.setItem('fileSystemMenu-debug', 'true')
```

### Error Reporting

Errors are automatically captured and can be reported through:
- Browser console logs
- Error boundary fallbacks
- User notification system

## Migration Guide

### From Legacy File Explorer

If migrating from an older file explorer component:

1. Update import statements
2. Replace component props
3. Update event handlers
4. Test keyboard navigation
5. Verify error handling

### Breaking Changes

- Context menu API changes
- Store structure updates
- Event emission changes

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Run tests: `npm run test`

### Code Style

- Follow Vue 3 Composition API patterns
- Use TypeScript for type safety
- Follow ESLint configuration
- Write comprehensive tests

### Pull Request Guidelines

- Include tests for new features
- Update documentation
- Follow commit message conventions
- Ensure CI passes

## License

This component is part of the VS Code extension project and follows the same license terms.