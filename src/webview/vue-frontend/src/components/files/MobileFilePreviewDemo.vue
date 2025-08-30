<template>
  <div class="mobile-file-preview-demo p-6 max-w-4xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Mobile File Preview Demo
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Test the mobile file preview system with different file types and navigation features.
      </p>
    </div>

    <!-- Demo Controls -->
    <div class="demo-controls mb-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Demo Controls</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Single File Preview -->
        <div class="demo-section">
          <h3 class="text-lg font-medium mb-2 text-gray-900 dark:text-white">Single File</h3>
          <div class="space-y-2">
            <button
              @click="previewSingleFile('image')"
              class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Preview Image
            </button>
            <button
              @click="previewSingleFile('code')"
              class="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Preview Code
            </button>
            <button
              @click="previewSingleFile('markdown')"
              class="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Preview Markdown
            </button>
            <button
              @click="previewSingleFile('text')"
              class="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Preview Text
            </button>
          </div>
        </div>

        <!-- Multiple Files Preview -->
        <div class="demo-section">
          <h3 class="text-lg font-medium mb-2 text-gray-900 dark:text-white">Multiple Files</h3>
          <div class="space-y-2">
            <button
              @click="previewMultipleFiles('mixed')"
              class="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              Mixed File Types
            </button>
            <button
              @click="previewMultipleFiles('images')"
              class="w-full px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 transition-colors"
            >
              Image Gallery
            </button>
            <button
              @click="previewMultipleFiles('code')"
              class="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              Code Files
            </button>
          </div>
        </div>

        <!-- Settings -->
        <div class="demo-section">
          <h3 class="text-lg font-medium mb-2 text-gray-900 dark:text-white">Settings</h3>
          <div class="space-y-2">
            <label class="flex items-center">
              <input
                v-model="settings.enableSwipeNavigation"
                type="checkbox"
                class="mr-2"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Swipe Navigation</span>
            </label>
            <label class="flex items-center">
              <input
                v-model="settings.enableHapticFeedback"
                type="checkbox"
                class="mr-2"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Haptic Feedback</span>
            </label>
            <label class="flex items-center">
              <input
                v-model="settings.preloadAdjacentFiles"
                type="checkbox"
                class="mr-2"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Preload Adjacent</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- File List -->
    <div class="file-list mb-8">
      <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Sample Files</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="file in sampleFiles"
          :key="file.path"
          @click="previewFile(file)"
          class="file-item p-4 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div class="flex items-center space-x-3">
            <div class="file-icon text-2xl">{{ getFileIcon(file) }}</div>
            <div class="file-info flex-1 min-w-0">
              <div class="file-name font-medium text-gray-900 dark:text-white truncate">
                {{ file.name }}
              </div>
              <div class="file-type text-sm text-gray-500 dark:text-gray-400">
                {{ getFileType(file) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Instructions -->
    <div class="instructions p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <h2 class="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">
        How to Use
      </h2>
      <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
        <li>• Click any file to open it in the mobile preview</li>
        <li>• Swipe left/right to navigate between files (if enabled)</li>
        <li>• Use pinch gestures to zoom images</li>
        <li>• Double-tap images to zoom in/out</li>
        <li>• Use the controls to adjust font size, toggle features</li>
        <li>• Press Escape or click the close button to exit</li>
        <li>• Use arrow keys for keyboard navigation</li>
      </ul>
    </div>

    <!-- Mobile File Preview Component -->
    <MobileFilePreview
      :is-visible="preview.isVisible"
      :file-path="preview.currentFilePath"
      :file-list="preview.fileList"
      :initial-index="preview.currentIndex"
      @close="closePreview"
      @file-change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useMobileFilePreview } from '../../composables/useMobileFilePreview'
import type { FileSystemNode } from '../../types/filesystem'
import MobileFilePreview from './MobileFilePreview.vue'

// Settings
const settings = reactive({
  enableSwipeNavigation: true,
  enableHapticFeedback: true,
  preloadAdjacentFiles: true
})

// Mobile file preview composable
const mobilePreview = useMobileFilePreview(settings)

// Local preview state for demo
const preview = reactive({
  isVisible: false,
  currentFilePath: null as string | null,
  fileList: [] as FileSystemNode[],
  currentIndex: 0
})

// Sample files for demo
const sampleFiles = ref<FileSystemNode[]>([
  {
    path: '/demo/sample.jpg',
    name: 'sample.jpg',
    type: 'file',
    size: 1024000,
    modified: new Date(),
    created: new Date(),
    parent: '/demo'
  },
  {
    path: '/demo/component.vue',
    name: 'component.vue',
    type: 'file',
    size: 2048,
    modified: new Date(),
    created: new Date(),
    parent: '/demo'
  },
  {
    path: '/demo/README.md',
    name: 'README.md',
    type: 'file',
    size: 1536,
    modified: new Date(),
    created: new Date(),
    parent: '/demo'
  },
  {
    path: '/demo/config.json',
    name: 'config.json',
    type: 'file',
    size: 512,
    modified: new Date(),
    created: new Date(),
    parent: '/demo'
  },
  {
    path: '/demo/script.js',
    name: 'script.js',
    type: 'file',
    size: 3072,
    modified: new Date(),
    created: new Date(),
    parent: '/demo'
  },
  {
    path: '/demo/styles.css',
    name: 'styles.css',
    type: 'file',
    size: 1024,
    modified: new Date(),
    created: new Date(),
    parent: '/demo'
  },
  {
    path: '/demo/notes.txt',
    name: 'notes.txt',
    type: 'file',
    size: 768,
    modified: new Date(),
    created: new Date(),
    parent: '/demo'
  },
  {
    path: '/demo/logo.png',
    name: 'logo.png',
    type: 'file',
    size: 2048000,
    modified: new Date(),
    created: new Date(),
    parent: '/demo'
  }
])

// Methods
const getFileIcon = (file: FileSystemNode): string => {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  const iconMap: Record<string, string> = {
    // Images
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'svg': '🖼️',
    'webp': '🖼️',
    
    // Code files
    'js': '📜',
    'ts': '📜',
    'vue': '💚',
    'html': '🌐',
    'css': '🎨',
    'json': '📋',
    'xml': '📋',
    'yaml': '📋',
    'yml': '📋',
    
    // Text files
    'txt': '📄',
    'md': '📝',
    'markdown': '📝',
    'log': '📄',
    
    // Default
    'default': '📄'
  }
  
  return iconMap[extension || ''] || iconMap.default
}

const getFileType = (file: FileSystemNode): string => {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  const typeMap: Record<string, string> = {
    'jpg': 'JPEG Image',
    'jpeg': 'JPEG Image',
    'png': 'PNG Image',
    'gif': 'GIF Image',
    'svg': 'SVG Image',
    'webp': 'WebP Image',
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'vue': 'Vue Component',
    'html': 'HTML Document',
    'css': 'CSS Stylesheet',
    'json': 'JSON Data',
    'xml': 'XML Document',
    'yaml': 'YAML Data',
    'yml': 'YAML Data',
    'txt': 'Text File',
    'md': 'Markdown',
    'markdown': 'Markdown',
    'log': 'Log File'
  }
  
  return typeMap[extension || ''] || 'Unknown'
}

const previewFile = (file: FileSystemNode) => {
  preview.currentFilePath = file.path
  preview.fileList = sampleFiles.value
  preview.currentIndex = sampleFiles.value.findIndex(f => f.path === file.path)
  preview.isVisible = true
}

const previewSingleFile = (type: 'image' | 'code' | 'markdown' | 'text') => {
  const fileMap = {
    image: sampleFiles.value.find(f => f.name.endsWith('.jpg')),
    code: sampleFiles.value.find(f => f.name.endsWith('.vue')),
    markdown: sampleFiles.value.find(f => f.name.endsWith('.md')),
    text: sampleFiles.value.find(f => f.name.endsWith('.txt'))
  }
  
  const file = fileMap[type]
  if (file) {
    preview.currentFilePath = file.path
    preview.fileList = [file]
    preview.currentIndex = 0
    preview.isVisible = true
  }
}

const previewMultipleFiles = (type: 'mixed' | 'images' | 'code') => {
  let files: FileSystemNode[] = []
  
  switch (type) {
    case 'mixed':
      files = sampleFiles.value
      break
    case 'images':
      files = sampleFiles.value.filter(f => 
        ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(
          f.name.split('.').pop()?.toLowerCase() || ''
        )
      )
      break
    case 'code':
      files = sampleFiles.value.filter(f => 
        ['js', 'ts', 'vue', 'html', 'css', 'json'].includes(
          f.name.split('.').pop()?.toLowerCase() || ''
        )
      )
      break
  }
  
  if (files.length > 0) {
    preview.currentFilePath = files[0]!.path
    preview.fileList = files
    preview.currentIndex = 0
    preview.isVisible = true
  }
}

const closePreview = () => {
  preview.isVisible = false
  preview.currentFilePath = null
  preview.fileList = []
  preview.currentIndex = 0
}

const handleFileChange = (filePath: string) => {
  preview.currentFilePath = filePath
  const newIndex = preview.fileList.findIndex(f => f.path === filePath)
  if (newIndex >= 0) {
    preview.currentIndex = newIndex
  }
}

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  if (preview.isVisible) {
    switch (event.key) {
      case 'Escape':
        closePreview()
        event.preventDefault()
        break
      case 'ArrowLeft':
        if (preview.currentIndex > 0) {
          const newIndex = preview.currentIndex - 1
          const newFile = preview.fileList[newIndex]
          if (newFile) {
            handleFileChange(newFile.path)
          }
        }
        event.preventDefault()
        break
      case 'ArrowRight':
        if (preview.currentIndex < preview.fileList.length - 1) {
          const newIndex = preview.currentIndex + 1
          const newFile = preview.fileList[newIndex]
          if (newFile) {
            handleFileChange(newFile.path)
          }
        }
        event.preventDefault()
        break
    }
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.mobile-file-preview-demo {
  min-height: 100vh;
}

.demo-section {
  min-height: 200px;
}

.file-item {
  transition: all 0.2s ease;
}

.file-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dark .file-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .mobile-file-preview-demo {
    padding: 1rem;
  }
  
  .demo-controls {
    padding: 1rem;
  }
  
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>