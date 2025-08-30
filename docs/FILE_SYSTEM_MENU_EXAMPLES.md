# File System Menu Usage Examples

## Basic Usage

### Simple Integration

```vue
<template>
  <div class="app-container">
    <FileSystemMenu />
  </div>
</template>

<script setup lang="ts">
import FileSystemMenu from '@/components/file-system-menu/FileSystemMenu.vue'
</script>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
}
</style>
```

### With Custom Configuration

```vue
<template>
  <div class="file-browser">
    <FileSystemMenu
      :initial-path="projectRoot"
      :show-preview="showPreview"
      :allow-multi-select="false"
      height="600px"
      class="custom-file-menu"
      @file-select="handleFileSelect"
      @error="handleError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FileSystemMenu from '@/components/file-system-menu/FileSystemMenu.vue'
import type { FileSystemNode } from '@/types/filesystem'

const projectRoot = ref('./src')
const showPreview = ref(true)

const handleFileSelect = (node: FileSystemNode) => {
  console.log('Selected file:', node.path)
}

const handleError = (error: Error) => {
  console.error('File system error:', error)
}
</script>
```

## Advanced Usage

### With Error Boundary

```vue
<template>
  <div class="file-system-container">
    <ErrorBoundary
      :fallback-component="FileSystemErrorFallback"
      @error="handleFileSystemError"
    >
      <FileSystemMenu
        :initial-path="workspacePath"
        :show-preview="true"
        height="100%"
      />
    </ErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConnectionStore, useUIStore } from '@/stores'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
import FileSystemMenu from '@/components/file-system-menu/FileSystemMenu.vue'

const connectionStore = useConnectionStore()
const uiStore = useUIStore()

const workspacePath = computed(() => connectionStore.workspacePath || '.')

const FileSystemErrorFallback = {
  template: `
    <div class="error-fallback">
      <h3>File System Unavailable</h3>
      <p>The file system menu encountered an error.</p>
      <button @click="retry">Retry</button>
    </div>
  `,
  methods: {
    retry() {
      window.location.reload()
    }
  }
}

const handleFileSystemError = (error: Error) => {
  uiStore.addNotification(
    'File system error occurred. Please try refreshing.',
    'error'
  )
}
</script>
```

### Custom Context Menu Actions

```vue
<template>
  <FileSystemMenu
    :initial-path="workspacePath"
    @context-menu="handleContextMenu"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useFileSystemMenuStore } from '@/stores/fileSystemMenu'
import FileSystemMenu from '@/components/file-system-menu/FileSystemMenu.vue'

const fileSystemMenuStore = useFileSystemMenuStore()

const handleContextMenu = (event: ContextMenuEvent) => {
  // Add custom context menu actions
  const customActions = [
    {
      id: 'custom-action',
      label: 'Custom Action',
      icon: 'star',
      action: (path: string) => {
        console.log('Custom action for:', path)
      }
    }
  ]
  
  // Show context menu with custom actions
  fileSystemMenuStore.showContextMenu(
    event.x,
    event.y,
    event.node,
    customActions
  )
}
</script>
```

## Store Integration

### Using the File System Menu Store

```vue
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useFileSystemMenuStore } from '@/stores/fileSystemMenu'

const fileSystemMenuStore = useFileSystemMenuStore()

// Reactive state
const selectedFile = computed(() => fileSystemMenuStore.selectedPath)
const isLoading = computed(() => fileSystemMenuStore.isLoading)
const searchQuery = computed(() => fileSystemMenuStore.searchQuery)

// Watch for file selection changes
watch(selectedFile, (newPath, oldPath) => {
  if (newPath) {
    console.log('File selected:', newPath)
    // Perform custom actions when file is selected
  }
})

// Programmatic operations
const selectFile = (path: string) => {
  fileSystemMenuStore.selectNode(path)
}

const searchFiles = (query: string) => {
  fileSystemMenuStore.setSearchQuery(query)
}

const refreshTree = async () => {
  await fileSystemMenuStore.refreshFileTree()
}
</script>
```

### Custom File Operations

```vue
<script setup lang="ts">
import { useFileSystemMenuStore } from '@/stores/fileSystemMenu'
import { useUIStore } from '@/stores/ui'

const fileSystemMenuStore = useFileSystemMenuStore()
const uiStore = useUIStore()

// Custom copy operation with notification
const copyFileWithNotification = async (path: string) => {
  try {
    await fileSystemMenuStore.copyPath(path)
    uiStore.addNotification(
      `Copied: ${path}`,
      'success',
      true,
      3000
    )
  } catch (error) {
    uiStore.addNotification(
      'Failed to copy file path',
      'error'
    )
  }
}

// Batch file operations
const openMultipleFiles = async (paths: string[]) => {
  for (const path of paths) {
    try {
      await fileSystemMenuStore.openInEditor(path)
    } catch (error) {
      console.error(`Failed to open ${path}:`, error)
    }
  }
}
</script>
```

## Customization Examples

### Custom Styling

```vue
<template>
  <FileSystemMenu class="custom-file-menu" />
</template>

<style scoped>
.custom-file-menu {
  /* Custom theme colors */
  --file-menu-bg: #1e1e1e;
  --file-menu-text: #d4d4d4;
  --file-menu-border: #3e3e3e;
  --file-menu-hover: #2d2d30;
  --file-menu-selected: #094771;
}

.custom-file-menu :deep(.file-tree-panel) {
  background-color: var(--file-menu-bg);
  color: var(--file-menu-text);
  border-color: var(--file-menu-border);
}

.custom-file-menu :deep(.file-tree-node:hover) {
  background-color: var(--file-menu-hover);
}

.custom-file-menu :deep(.file-tree-node.selected) {
  background-color: var(--file-menu-selected);
}
</style>
```

### Custom File Icons

```vue
<script setup lang="ts">
import { computed } from 'vue'

// Custom file icon mapping
const getFileIcon = (filename: string, type: 'file' | 'directory') => {
  if (type === 'directory') {
    return 'folder'
  }
  
  const extension = filename.split('.').pop()?.toLowerCase()
  
  const iconMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'vue': 'vue',
    'json': 'json',
    'md': 'markdown',
    'css': 'css',
    'html': 'html',
    'png': 'image',
    'jpg': 'image',
    'gif': 'image',
    'pdf': 'pdf'
  }
  
  return iconMap[extension || ''] || 'file'
}
</script>
```

## Performance Optimization Examples

### Lazy Loading Implementation

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFileSystemMenuStore } from '@/stores/fileSystemMenu'

const fileSystemMenuStore = useFileSystemMenuStore()

// Implement lazy loading for large directories
const lazyLoadDirectory = async (path: string) => {
  const node = fileSystemMenuStore.fileTree.get(path)
  
  if (node && node.type === 'directory' && !node.children) {
    // Load children only when needed
    await fileSystemMenuStore.expandNode(path)
  }
}

// Virtual scrolling configuration
const virtualScrollConfig = {
  itemHeight: 24,
  containerHeight: 400,
  overscan: 5
}
</script>
```

### Memory Management

```vue
<script setup lang="ts">
import { onUnmounted } from 'vue'
import { useFileSystemMenuStore } from '@/stores/fileSystemMenu'

const fileSystemMenuStore = useFileSystemMenuStore()

// Cleanup on component unmount
onUnmounted(() => {
  // Clear large data structures
  fileSystemMenuStore.clearCache()
  
  // Stop file watching
  fileSystemMenuStore.stopAllWatching()
  
  // Clear event listeners
  document.removeEventListener('keydown', handleKeydown)
})
</script>
```

## Testing Examples

### Component Testing

```typescript
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import FileSystemMenu from '@/components/file-system-menu/FileSystemMenu.vue'

describe('FileSystemMenu', () => {
  let wrapper: any
  let pinia: any

  beforeEach(() => {
    pinia = createPinia()
    wrapper = mount(FileSystemMenu, {
      global: {
        plugins: [pinia]
      },
      props: {
        initialPath: './test',
        showPreview: true
      }
    })
  })

  it('renders file tree panel', () => {
    expect(wrapper.find('.file-tree-panel').exists()).toBe(true)
  })

  it('renders preview panel', () => {
    expect(wrapper.find('.file-preview-panel').exists()).toBe(true)
  })

  it('handles file selection', async () => {
    const fileNode = wrapper.find('.file-tree-node')
    await fileNode.trigger('click')
    
    expect(wrapper.emitted('file-select')).toBeTruthy()
  })
})
```

### Store Testing

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useFileSystemMenuStore } from '@/stores/fileSystemMenu'

describe('FileSystemMenuStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with default state', () => {
    const store = useFileSystemMenuStore()
    
    expect(store.selectedPath).toBeNull()
    expect(store.expandedPaths.size).toBe(0)
    expect(store.searchQuery).toBe('')
  })

  it('selects a file', async () => {
    const store = useFileSystemMenuStore()
    
    await store.selectNode('/test/file.txt')
    
    expect(store.selectedPath).toBe('/test/file.txt')
  })

  it('expands a directory', async () => {
    const store = useFileSystemMenuStore()
    
    await store.expandNode('/test/directory')
    
    expect(store.expandedPaths.has('/test/directory')).toBe(true)
  })
})
```

## Error Handling Examples

### Custom Error Handling

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useFileSystemMenuStore } from '@/stores/fileSystemMenu'
import { useUIStore } from '@/stores/ui'

const fileSystemMenuStore = useFileSystemMenuStore()
const uiStore = useUIStore()

const handleFileOperationError = async (operation: string, path: string) => {
  try {
    switch (operation) {
      case 'open':
        await fileSystemMenuStore.openInEditor(path)
        break
      case 'copy':
        await fileSystemMenuStore.copyPath(path)
        break
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  } catch (error) {
    // Custom error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (errorMessage.includes('permission')) {
      uiStore.addNotification(
        'Permission denied. Check file permissions.',
        'error'
      )
    } else if (errorMessage.includes('not found')) {
      uiStore.addNotification(
        'File not found. It may have been moved or deleted.',
        'warning'
      )
    } else {
      uiStore.addNotification(
        `Operation failed: ${errorMessage}`,
        'error'
      )
    }
  }
}
</script>
```

### Retry Logic

```vue
<script setup lang="ts">
import { ref } from 'vue'

const retryCount = ref(0)
const maxRetries = 3

const retryOperation = async (operation: () => Promise<void>) => {
  while (retryCount.value < maxRetries) {
    try {
      await operation()
      retryCount.value = 0 // Reset on success
      return
    } catch (error) {
      retryCount.value++
      
      if (retryCount.value >= maxRetries) {
        throw new Error(`Operation failed after ${maxRetries} attempts`)
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.value))
    }
  }
}
</script>
```

## Integration Examples

### With Vue Router

```vue
<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFileSystemMenuStore } from '@/stores/fileSystemMenu'

const route = useRoute()
const router = useRouter()
const fileSystemMenuStore = useFileSystemMenuStore()

// Sync selected file with route
watch(
  () => fileSystemMenuStore.selectedPath,
  (newPath) => {
    if (newPath && route.query.file !== newPath) {
      router.push({
        query: { ...route.query, file: newPath }
      })
    }
  }
)

// Initialize from route
if (route.query.file) {
  fileSystemMenuStore.selectNode(route.query.file as string)
}
</script>
```

### With External APIs

```vue
<script setup lang="ts">
import { watch } from 'vue'
import { useFileSystemMenuStore } from '@/stores/fileSystemMenu'

const fileSystemMenuStore = useFileSystemMenuStore()

// Sync with external file management API
watch(
  () => fileSystemMenuStore.selectedPath,
  async (newPath) => {
    if (newPath) {
      try {
        // Send to external API
        await fetch('/api/files/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: newPath })
        })
      } catch (error) {
        console.error('Failed to sync with external API:', error)
      }
    }
  }
)
</script>
```

These examples demonstrate various ways to integrate and customize the File System Menu component for different use cases and requirements.