# Vue.js Frontend Developer Guide

## Overview

This guide provides comprehensive documentation for the Vue.js frontend architecture that replaces the legacy vanilla JavaScript implementation. The new architecture leverages modern web development practices with Vue 3, TypeScript, and a component-based approach.

## Architecture Overview

### Technology Stack

- **Framework**: Vue.js 3 with Composition API
- **Build Tool**: Vite for fast development and optimized builds
- **State Management**: Pinia for centralized state management
- **Routing**: Vue Router for single-page application navigation
- **Styling**: Tailwind CSS for utility-first styling
- **UI Components**: PrimeVue for rich component library
- **Language**: TypeScript for type safety
- **Linting**: ESLint + Vue ESLint plugin
- **Formatting**: Prettier for code formatting

### Project Structure

```
src/
├── main.ts                 # Application entry point
├── App.vue                 # Root component
├── router/
│   └── index.ts           # Vue Router configuration
├── stores/
│   ├── connection.ts      # WebSocket connection state
│   ├── workspace.ts       # VS Code workspace state
│   ├── ui.ts             # UI state and preferences
│   └── settings.ts       # Application settings
├── composables/
│   ├── useWebSocket.ts    # WebSocket connection logic
│   ├── useCommands.ts     # VS Code command execution
│   ├── useFileSystem.ts   # File system operations
│   ├── useGit.ts         # Git operations
│   ├── useTerminal.ts    # Terminal functionality
│   └── useChat.ts        # Chat/messaging functionality
├── components/
│   ├── layout/           # Layout components
│   ├── automation/       # Server management components
│   ├── files/           # File system components
│   ├── git/             # Git operation components
│   ├── terminal/        # Terminal interface components
│   ├── chat/            # Chat/messaging components
│   └── common/          # Reusable utility components
├── views/
│   ├── HomeView.vue
│   ├── AutomationView.vue
│   ├── FilesView.vue
│   ├── GitView.vue
│   ├── TerminalView.vue
│   └── ChatView.vue
├── services/
│   ├── websocket.ts      # WebSocket service implementation
│   ├── api.ts           # HTTP API service
│   └── storage.ts       # Local storage utilities
├── types/
│   ├── websocket.ts     # WebSocket message types
│   ├── workspace.ts     # Workspace state types
│   ├── git.ts          # Git operation types
│   └── common.ts       # Common type definitions
└── utils/
    ├── constants.ts     # Application constants
    ├── helpers.ts      # Utility functions
    └── validators.ts   # Input validation functions
```

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- VS Code (recommended)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd <project-directory>

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Format code
npm run format
```

### Development Scripts

```json
{
  "dev": "vite",
  "build": "vue-tsc && vite build",
  "preview": "vite preview",
  "lint": "eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix",
  "format": "prettier --write src/",
  "type-check": "vue-tsc --noEmit"
}
```

## State Management with Pinia

### Store Structure

Each store follows a consistent pattern:

```typescript
// stores/example.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useExampleStore = defineStore('example', () => {
  // State
  const state = ref<ExampleState>({
    // initial state
  })
  
  // Getters (computed)
  const computedValue = computed(() => {
    return state.value.someProperty
  })
  
  // Actions
  const updateState = (newData: Partial<ExampleState>) => {
    state.value = { ...state.value, ...newData }
  }
  
  return {
    state,
    computedValue,
    updateState
  }
})
```

### Available Stores

#### Connection Store (`useConnectionStore`)
Manages WebSocket connection state and server communication.

```typescript
const connectionStore = useConnectionStore()

// State
connectionStore.isConnected
connectionStore.serverUrl
connectionStore.connectionId
connectionStore.latency

// Actions
await connectionStore.connect(url)
connectionStore.disconnect()
connectionStore.updateLatency(latency)
```

#### Workspace Store (`useWorkspaceStore`)
Manages VS Code workspace information and file system state.

```typescript
const workspaceStore = useWorkspaceStore()

// State
workspaceStore.workspaceFolders
workspaceStore.activeEditor
workspaceStore.fileTree
workspaceStore.gitStatus

// Actions
workspaceStore.updateWorkspaceInfo(info)
workspaceStore.updateFileTree(tree)
workspaceStore.setActiveEditor(editor)
```

#### UI Store (`useUIStore`)
Manages user interface state and preferences.

```typescript
const uiStore = useUIStore()

// State
uiStore.sidebarCollapsed
uiStore.theme
uiStore.activeView
uiStore.notifications

// Actions
uiStore.toggleSidebar()
uiStore.setTheme(theme)
uiStore.showNotification(message, type)
```

#### Settings Store (`useSettingsStore`)
Manages application configuration and user preferences.

```typescript
const settingsStore = useSettingsStore()

// State
settingsStore.preferences
settingsStore.serverConfig
settingsStore.shortcuts

// Actions
settingsStore.updatePreferences(prefs)
settingsStore.saveSettings()
settingsStore.resetToDefaults()
```

## Composables

Composables encapsulate reusable business logic and provide reactive interfaces to services.

### useWebSocket

Manages WebSocket connections and real-time communication.

```typescript
import { useWebSocket } from '@/composables/useWebSocket'

const {
  isConnected,
  connectionStatus,
  lastMessage,
  connect,
  disconnect,
  sendMessage,
  onMessage,
  onConnect,
  onDisconnect
} = useWebSocket()

// Usage
await connect('ws://localhost:3001')
sendMessage({ type: 'command', command: 'getWorkspaceInfo' })

onMessage((message) => {
  console.log('Received:', message)
})
```

### useCommands

Handles VS Code command execution and management.

```typescript
import { useCommands } from '@/composables/useCommands'

const {
  isExecuting,
  lastResult,
  executeCommand,
  getAvailableCommands,
  openFile,
  saveFile,
  formatDocument
} = useCommands()

// Usage
const result = await executeCommand('workbench.action.files.openFile', ['/path/to/file'])
await openFile('/path/to/file')
await formatDocument()
```

### useFileSystem

Manages file system operations and file tree navigation.

```typescript
import { useFileSystem } from '@/composables/useFileSystem'

const {
  fileTree,
  currentPath,
  selectedFiles,
  isLoading,
  loadFileTree,
  createFile,
  deleteFile,
  renameFile,
  readFile,
  writeFile,
  searchFiles
} = useFileSystem()

// Usage
await loadFileTree('/workspace')
await createFile('/workspace/newfile.txt', 'content')
const content = await readFile('/workspace/file.txt')
```

### useGit

Handles Git operations and repository management.

```typescript
import { useGit } from '@/composables/useGit'

const {
  gitStatus,
  branches,
  commitHistory,
  isLoading,
  getStatus,
  getBranches,
  getCommitHistory,
  stageFiles,
  commit,
  push,
  pull,
  switchBranch
} = useGit()

// Usage
await getStatus()
await stageFiles(['file1.txt', 'file2.txt'])
await commit('feat: add new feature')
await push()
```

### useTerminal

Manages terminal sessions and command execution.

```typescript
import { useTerminal } from '@/composables/useTerminal'

const {
  sessions,
  activeSession,
  isConnected,
  createSession,
  switchSession,
  executeCommand,
  sendInput,
  clearHistory
} = useTerminal()

// Usage
const sessionId = await createSession()
await executeCommand(sessionId, 'npm install')
await sendInput(sessionId, 'y\n')
```

### useChat

Handles chat/messaging functionality and real-time communication.

```typescript
import { useChat } from '@/composables/useChat'

const {
  messages,
  isConnected,
  isTyping,
  sendMessage,
  markAsRead,
  clearHistory,
  onNewMessage,
  onTypingStart,
  onTypingStop
} = useChat()

// Usage
await sendMessage('Hello, world!')
onNewMessage((message) => {
  console.log('New message:', message)
})
```

## Component Development

### Component Structure

Follow this structure for all Vue components:

```vue
<template>
  <!-- Template with semantic HTML and Tailwind classes -->
  <div class="component-container">
    <h2 class="text-xl font-semibold mb-4">{{ title }}</h2>
    <!-- Component content -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ComponentProps } from '@/types/common'

// Props
interface Props {
  title: string
  data?: any[]
}

const props = withDefaults(defineProps<Props>(), {
  data: () => []
})

// Emits
const emit = defineEmits<{
  update: [value: any]
  action: [type: string, payload: any]
}>()

// State
const isLoading = ref(false)
const error = ref<string | null>(null)

// Computed
const processedData = computed(() => {
  return props.data.map(item => ({
    ...item,
    processed: true
  }))
})

// Methods
const handleAction = (type: string, payload: any) => {
  emit('action', type, payload)
}

// Lifecycle
onMounted(() => {
  // Component initialization
})
</script>

<style scoped>
/* Component-specific styles (minimal, prefer Tailwind) */
.component-container {
  /* Custom styles only when Tailwind is insufficient */
}
</style>
```

### Styling Guidelines

#### Tailwind CSS Usage

- Use Tailwind utility classes for all styling
- Follow mobile-first responsive design principles
- Use consistent spacing and color schemes
- Leverage Tailwind's design tokens

```vue
<template>
  <!-- Mobile-first responsive design -->
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Card Title
        </h3>
        <p class="text-gray-600 dark:text-gray-300">
          Card content
        </p>
      </div>
    </div>
  </div>
</template>
```

#### PrimeVue Integration

Use PrimeVue components for complex UI elements:

```vue
<template>
  <DataTable 
    :value="data" 
    :paginator="true" 
    :rows="10"
    :loading="isLoading"
    class="p-datatable-sm"
  >
    <Column field="name" header="Name" sortable />
    <Column field="status" header="Status">
      <template #body="{ data }">
        <Tag 
          :value="data.status" 
          :severity="getStatusSeverity(data.status)" 
        />
      </template>
    </Column>
  </DataTable>
</template>
```

## Error Handling

### Global Error Handler

The application includes a global error handler for unhandled errors:

```typescript
// main.ts
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error:', err)
  
  // Send to error reporting service
  errorReportingService.captureException(err, {
    component: instance?.$options.name,
    errorInfo: info
  })
}
```

### Error Boundaries

Use error boundary components to handle component-level errors:

```vue
<template>
  <ErrorBoundary>
    <YourComponent />
  </ErrorBoundary>
</template>
```

### Async Error Handling

Handle async operations with proper error catching:

```typescript
const handleAsyncOperation = async () => {
  try {
    isLoading.value = true
    error.value = null
    
    const result = await someAsyncOperation()
    
    // Handle success
    return result
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An error occurred'
    console.error('Operation failed:', err)
  } finally {
    isLoading.value = false
  }
}
```

## Testing Guidelines

### Component Testing

When tests are required, use Vue Test Utils:

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import YourComponent from '@/components/YourComponent.vue'

describe('YourComponent', () => {
  it('renders correctly', () => {
    const wrapper = mount(YourComponent, {
      props: {
        title: 'Test Title'
      }
    })
    
    expect(wrapper.text()).toContain('Test Title')
  })
  
  it('emits events correctly', async () => {
    const wrapper = mount(YourComponent)
    
    await wrapper.find('button').trigger('click')
    
    expect(wrapper.emitted('action')).toBeTruthy()
  })
})
```

### Manual Testing

Focus on manual testing for this project:

1. Test component functionality in browser
2. Verify responsive design across devices
3. Test WebSocket connectivity
4. Validate VS Code integration
5. Check accessibility compliance

## Performance Optimization

### Code Splitting

Implement route-based code splitting:

```typescript
const routes = [
  {
    path: '/automation',
    component: () => import('../views/AutomationView.vue')
  }
]
```

### Virtual Scrolling

Use virtual scrolling for large lists:

```vue
<template>
  <VirtualList
    :items="largeDataSet"
    :item-height="50"
    :container-height="400"
    v-slot="{ item }"
  >
    <ListItem :data="item" />
  </VirtualList>
</template>
```

### Reactive Performance

- Use `shallowRef` for large objects
- Implement `computed` for derived state
- Use `watchEffect` for side effects
- Provide proper `key` attributes

## Build Configuration

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-vendor': ['primevue', 'primeicons']
        }
      }
    }
  }
})
```

### Environment Configuration

Use environment variables for configuration:

```typescript
// .env.development
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001

// .env.production
VITE_API_URL=https://api.production.com
VITE_WS_URL=wss://ws.production.com
```

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Build Output

The build process generates:
- Optimized JavaScript bundles
- CSS files with Tailwind optimizations
- Static assets with proper caching headers
- Source maps for debugging

## Contributing

### Code Style

- Follow TypeScript strict mode
- Use functional programming patterns
- Keep functions under 100 lines
- Use descriptive variable names
- Implement proper error handling

### Git Workflow

- Create feature branches from `dev`
- Use conventional commit messages
- Keep commits atomic and focused
- Rebase before merging
- Update documentation with changes

### Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add proper commit messages
4. Request code review
5. Address feedback
6. Merge after approval