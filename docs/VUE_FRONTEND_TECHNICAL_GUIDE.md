# Vue Frontend Technical Guide

## Overview

The Vue frontend is a sophisticated single-page application (SPA) built with Vue 3, TypeScript, and modern web technologies. It serves as the user interface for the Web Automation Tunnel VS Code extension, providing real-time interaction with VS Code through WebSocket connections.

## Architecture Overview

### Technology Stack

- **Vue 3** - Progressive JavaScript framework with Composition API
- **TypeScript** - Type-safe JavaScript development
- **Pinia** - State management library for Vue
- **Vue Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and development server
- **WebSocket** - Real-time bidirectional communication

### Project Structure

```
src/webview/vue-frontend/
├── src/
│   ├── components/          # Reusable Vue components
│   │   ├── common/         # Generic UI components
│   │   ├── layout/         # Layout components (header, sidebar, footer)
│   │   ├── file-system-menu/ # File system navigation components
│   │   ├── files/          # File management components
│   │   └── automation/     # Command execution components
│   ├── composables/        # Vue composition functions
│   ├── stores/             # Pinia state management
│   ├── services/           # Business logic and external integrations
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions and validators
│   ├── views/              # Page-level components
│   ├── router/             # Vue Router configuration
│   ├── App.vue             # Root application component
│   └── main.ts             # Application entry point
├── public/                 # Static assets
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## Core Architecture Patterns

### 1. Composition API Pattern

The application uses Vue 3's Composition API for better code organization and reusability:

```typescript
// Example composable pattern
export function useFileSystem(): FileSystemComposable {
  const fileTree = ref<FileTreeState>({
    nodes: new Map(),
    expandedPaths: new Set(),
    selectedPath: null,
    loadingPaths: new Set(),
    rootPaths: []
  })

  const loadFileTree = async (rootPath?: string): Promise<FileSystemNode[]> => {
    // Implementation
  }

  return {
    fileTree,
    loadFileTree,
    // ... other methods
  }
}
```

### 2. State Management with Pinia

Centralized state management using Pinia stores:

```typescript
// Connection store example
export const useConnectionStore = defineStore('connection', () => {
  const isConnected = ref(false)
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  
  const connect = async (url: string) => {
    // Connection logic
  }
  
  return {
    isConnected,
    connectionStatus,
    connect
  }
})
```

### 3. Service Layer Pattern

Business logic is separated into service classes:

```typescript
export class ConnectionService {
  private ws: WebSocket | null = null
  
  async initialize(): Promise<void> {
    // Service initialization
  }
  
  send(message: any): void {
    // Message sending logic
  }
}
```

## WebSocket Communication Architecture

### Connection Management

The application maintains a persistent WebSocket connection to the VS Code extension:

```typescript
// Connection service handles WebSocket lifecycle
export const connectionService = new ConnectionService()

// Automatic reconnection with exponential backoff
private scheduleReconnect(): void {
  const delay = 3000 // Base delay
  this.reconnectTimer = setTimeout(() => {
    this.connect()
  }, delay)
}
```

### Message Protocol

WebSocket messages follow a structured protocol:

```typescript
interface WebSocketMessage {
  type: 'command' | 'response' | 'broadcast' | 'status' | 'ping' | 'pong'
  id?: string
  command?: string
  args?: any[]
  data?: any
  error?: string
  timestamp: number
}
```

### Message Types

1. **Command Messages** - Execute VS Code commands
2. **Response Messages** - Command execution results
3. **Broadcast Messages** - Server-initiated notifications
4. **Status Messages** - Connection health information
5. **Ping/Pong Messages** - Connection heartbeat

## Component Architecture

### Component Hierarchy

```
App.vue
├── AppHeader.vue
├── AppSidebar.vue
├── Main Content Area
│   └── Router View
│       ├── HomeView.vue
│       ├── AutomationView.vue
│       ├── FilesView.vue
│       ├── GitView.vue
│       ├── TerminalView.vue
│       └── ChatView.vue
├── AppFooter.vue
├── NotificationToast.vue
└── DebugPanel.vue (dev only)
```

### Component Communication

1. **Props Down** - Parent to child data flow
2. **Events Up** - Child to parent communication
3. **Provide/Inject** - Deep component communication
4. **Store Access** - Global state management

### File System Menu Component

A sophisticated file tree component with advanced features:

```typescript
interface FileSystemMenuProps {
  initialPath?: string
  showPreview?: boolean
  allowMultiSelect?: boolean
  height?: string | number
  className?: string
}
```

Features:
- Virtual scrolling for large directories
- Real-time file watching
- Context menus with actions
- Search and filtering
- Drag and drop support
- Keyboard navigation
- Accessibility compliance

## State Management

### Store Structure

```typescript
// Store exports
export { useConnectionStore } from './connection'
export { useWorkspaceStore } from './workspace'
export { useUIStore } from './ui'
export { useSettingsStore } from './settings'
export { useFileSystemMenuStore } from './fileSystemMenu'
```

### Store Plugins

Custom Pinia plugins enhance functionality:

1. **Persistence Plugin** - Saves state to localStorage
2. **Debug Plugin** - Development debugging tools
3. **Error Handling Plugin** - Centralized error management
4. **Initialization Plugin** - Async store setup

### State Persistence

```typescript
pinia.use(createPersistencePlugin({
  exclude: ['connection'], // Don't persist connection state
  include: ['settings', 'ui'] // Only persist settings and UI state
}))
```

## Error Handling

### Comprehensive Error Management

The application implements a multi-layered error handling system:

```typescript
// Enhanced error class
export class AppError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory = 'unknown',
    public severity: ErrorSeverity = 'medium',
    public context: Partial<ErrorContext> = {},
    public userFriendly?: Partial<UserFriendlyError>,
    public recoverable = true
  ) {
    super(message)
  }
}
```

### Error Categories

- **UI Errors** - Component and rendering issues
- **WebSocket Errors** - Connection and communication problems
- **File System Errors** - File operation failures
- **Validation Errors** - Input validation failures
- **Unknown Errors** - Unclassified errors

### Error Recovery

```typescript
// Recovery actions for user-friendly errors
recoveryActions: [
  {
    label: 'Retry Connection',
    action: () => this.connect(),
    primary: true
  },
  {
    label: 'Check Extension Status',
    action: () => console.log('Check extension')
  }
]
```

## Performance Optimizations

### Code Splitting

Vite configuration enables automatic code splitting:

```typescript
rollupOptions: {
  output: {
    manualChunks: (id) => {
      if (id.includes('node_modules')) {
        if (id.includes('vue')) return 'vue-vendor'
        return 'vendor'
      }
      if (id.includes('file-system-menu')) return 'file-system-menu'
      if (id.includes('stores')) return 'stores'
    }
  }
}
```

### Virtual Scrolling

Large file lists use virtual scrolling for performance:

```typescript
interface VirtualScrollConfig {
  itemHeight: number
  containerHeight: number
  overscan: number
  estimatedItemCount: number
}
```

### Lazy Loading

Components and routes are lazy-loaded:

```typescript
component: () => import('../views/FilesView.vue')
```

## Development Workflow

### Build Scripts

```json
{
  "dev": "vite --host",
  "build": "npm run type-check && vite build",
  "build:dev": "vite build --mode development",
  "build:prod": "vite build --mode production",
  "type-check": "vue-tsc --noEmit --skipLibCheck",
  "lint": "eslint . --ext .vue,.js,.jsx,.ts,.tsx",
  "format": "prettier --write src/"
}
```

### Development Server

```typescript
server: {
  port: 5173,
  host: true,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true
    },
    '/ws': {
      target: 'ws://localhost:8081',
      ws: true
    }
  }
}
```

### Environment Configuration

```typescript
// Environment variables
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8081
VITE_APP_VERSION=0.0.1
VITE_ERROR_REPORTING_ENDPOINT=/api/errors
```

## Testing Strategy

### Unit Testing

Components and composables are tested using Vitest:

```typescript
// Example test structure
describe('useFileSystem', () => {
  it('should load file tree', async () => {
    const { loadFileTree } = useFileSystem()
    const result = await loadFileTree('/')
    expect(result).toBeDefined()
  })
})
```

### Integration Testing

WebSocket communication and store interactions are integration tested.

### Manual Testing

The application includes a manual testing checklist for UI interactions.

## Security Considerations

### Input Validation

All user inputs are validated using dedicated validators:

```typescript
export function validateFileName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'File name cannot be empty' }
  }
  
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
  if (invalidChars.test(name)) {
    return { isValid: false, error: 'File name contains invalid characters' }
  }
  
  return { isValid: true }
}
```

### Path Sanitization

File paths are sanitized to prevent directory traversal:

```typescript
export function sanitizeFilePath(path: string): string {
  return path
    .replace(/\\/g, '/') // Normalize separators
    .replace(/\/+/g, '/') // Remove duplicate separators
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\/+$/, '') // Remove trailing slashes
}
```

### WebSocket Security

- Message validation before processing
- Rate limiting on message sending
- Automatic connection timeout handling

## Accessibility

### ARIA Support

Components implement proper ARIA attributes:

```typescript
interface AccessibilityProps {
  'aria-label': string
  'aria-expanded'?: boolean
  'aria-selected'?: boolean
  'aria-level'?: number
  'role': 'tree' | 'treeitem' | 'button' | 'menuitem'
  'tabindex': number
}
```

### Keyboard Navigation

Full keyboard navigation support:

```typescript
interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: string
  description: string
}
```

### Screen Reader Support

- Semantic HTML structure
- Proper heading hierarchy
- Descriptive labels and instructions

## Deployment

### Build Process

1. **Type Checking** - Validate TypeScript types
2. **Linting** - Check code quality
3. **Building** - Compile and bundle
4. **Optimization** - Minify and compress

### Output Structure

```
out/webview/vue-frontend/
├── assets/
│   ├── vue-vendor-[hash].js
│   ├── vendor-[hash].js
│   ├── file-system-menu-[hash].js
│   └── main-[hash].css
├── index.html
└── manifest.json
```

### Integration with VS Code Extension

The built frontend is served by the VS Code extension's HTTP server and loaded in a webview panel.

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failures**
   - Check extension is running
   - Verify port configuration
   - Check firewall settings

2. **File Operations Not Working**
   - Verify workspace permissions
   - Check file path validation
   - Review error logs

3. **Performance Issues**
   - Enable virtual scrolling
   - Check for memory leaks
   - Optimize component rendering

### Debug Tools

- Vue DevTools integration
- Console logging with levels
- Performance monitoring
- Network request tracking

## Future Enhancements

### Planned Features

1. **Mobile Responsiveness** - Touch-friendly interface
2. **Offline Support** - Service worker integration
3. **Plugin System** - Extensible component architecture
4. **Advanced Search** - Full-text search capabilities
5. **Collaboration Features** - Real-time multi-user editing

### Performance Improvements

1. **Web Workers** - Background processing
2. **Streaming** - Large file handling
3. **Caching** - Intelligent data caching
4. **Compression** - WebSocket message compression

This technical guide provides a comprehensive overview of the Vue frontend architecture, enabling developers to understand, maintain, and extend the application effectively.