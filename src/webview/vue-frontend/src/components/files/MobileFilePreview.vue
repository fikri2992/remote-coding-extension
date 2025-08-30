<template>
  <div
    v-if="isVisible"
    class="mobile-file-preview fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Header -->
    <div class="preview-header flex items-center justify-between p-4 bg-black bg-opacity-80 text-white">
      <div class="flex items-center space-x-3 flex-1 min-w-0">
        <button
          @click="closePreview"
          class="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          aria-label="Close preview"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div class="flex-1 min-w-0">
          <h2 class="text-lg font-semibold truncate">{{ currentFile?.name }}</h2>
          <p v-if="currentFile?.size" class="text-sm text-gray-300">
            {{ formatFileSize(currentFile.size) }}
          </p>
        </div>
      </div>

      <div class="flex items-center space-x-2">
        <!-- File navigation -->
        <div v-if="fileList.length > 1" class="flex items-center space-x-1 text-sm">
          <span>{{ currentIndex + 1 }}</span>
          <span>/</span>
          <span>{{ fileList.length }}</span>
        </div>

        <!-- Share button -->
        <button
          v-if="canShare"
          @click="shareFile"
          class="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          aria-label="Share file"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="preview-content flex-1 relative overflow-hidden">
      <!-- Loading State -->
      <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
        <div class="text-white text-center">
          <svg class="w-8 h-8 animate-spin mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p>Loading...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="absolute inset-0 flex items-center justify-center">
        <div class="text-white text-center p-4">
          <svg class="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-lg font-semibold mb-2">Failed to load file</h3>
          <p class="text-gray-300 mb-4">{{ error }}</p>
          <button
            @click="loadCurrentFile"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>

      <!-- Image Preview -->
      <MobileImagePreview
        v-else-if="isImageFile"
        :file-path="currentFile?.path"
        :file-content="fileContent"
        :gestures="gestures"
        @close="closePreview"
      />

      <!-- Code Preview -->
      <MobileCodePreview
        v-else-if="isCodeFile"
        :file-path="currentFile?.path"
        :file-content="fileContent"
        :language="fileLanguage"
        @close="closePreview"
      />

      <!-- Markdown Preview -->
      <MobileMarkdownPreview
        v-else-if="isMarkdownFile"
        :file-path="currentFile?.path"
        :file-content="fileContent"
        @close="closePreview"
      />

      <!-- Generic Text Preview -->
      <MobileTextPreview
        v-else
        :file-path="currentFile?.path"
        :file-content="fileContent"
        @close="closePreview"
      />
    </div>

    <!-- Navigation Indicators -->
    <div
      v-if="fileList.length > 1"
      class="preview-navigation absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2"
    >
      <div
        v-for="(_, index) in fileList"
        :key="index"
        :class="[
          'w-2 h-2 rounded-full transition-colors',
          index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-30'
        ]"
      />
    </div>

    <!-- Swipe Hint -->
    <div
      v-if="showSwipeHint && fileList.length > 1"
      class="swipe-hint absolute bottom-16 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-60 px-3 py-2 rounded-lg"
    >
      Swipe to navigate between files
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useFileSystem } from '../../composables/useFileSystem'
import { useGestures } from '../../composables/useGestures'
import { useHapticFeedback } from '../../composables/useHapticFeedback'
import type { FileSystemNode, FileContent } from '../../types/filesystem'
import type { GestureEvent } from '../../types/gestures'
import MobileImagePreview from './MobileImagePreview.vue'
import MobileCodePreview from './MobileCodePreview.vue'
import MobileMarkdownPreview from './MobileMarkdownPreview.vue'
import MobileTextPreview from './MobileTextPreview.vue'

interface Props {
  isVisible: boolean
  filePath?: string | null
  fileList?: FileSystemNode[]
  initialIndex?: number
}

interface Emits {
  (e: 'close'): void
  (e: 'file-change', filePath: string): void
}

const props = withDefaults(defineProps<Props>(), {
  filePath: null,
  fileList: () => [],
  initialIndex: 0
})

const emit = defineEmits<Emits>()

// Composables
const fileSystem = useFileSystem()
const haptic = useHapticFeedback()

// State
const currentIndex = ref(props.initialIndex)
const fileContent = ref<string | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const showSwipeHint = ref(true)
const fileLanguage = ref<string | null>(null)

// Gesture handling
const previewElement = ref<HTMLElement | null>(null)
const gestures = useGestures({
  element: previewElement,
  config: {
    swipe: {
      threshold: 80,
      velocity: 0.5,
      maxTime: 400,
      tolerance: 30
    },
    enableHapticFeedback: true
  },
  callbacks: {
    onSwipe: handleSwipeGesture
  }
})

// Computed
const currentFile = computed(() => {
  if (props.filePath) {
    return fileSystem.getNodeByPath(props.filePath)
  }
  return props.fileList[currentIndex.value] || null
})

const isImageFile = computed(() => {
  if (!currentFile.value) return false
  const extension = fileSystem.getFileExtension(currentFile.value.path)
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
  return imageExtensions.includes(extension)
})

const isCodeFile = computed(() => {
  if (!currentFile.value) return false
  const extension = fileSystem.getFileExtension(currentFile.value.path)
  const codeExtensions = [
    'js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'sass', 'less',
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config',
    'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'swift',
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'sql'
  ]
  return codeExtensions.includes(extension)
})

const isMarkdownFile = computed(() => {
  if (!currentFile.value) return false
  const extension = fileSystem.getFileExtension(currentFile.value.path)
  return ['md', 'markdown', 'mdown', 'mkd'].includes(extension)
})

const canShare = computed(() => {
  return 'share' in navigator && currentFile.value
})

// Methods
const loadCurrentFile = async () => {
  if (!currentFile.value) return

  isLoading.value = true
  error.value = null

  try {
    const content: FileContent = await fileSystem.readFile(currentFile.value.path)
    fileContent.value = content.content
    fileLanguage.value = content.language || null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load file'
    fileContent.value = null
  } finally {
    isLoading.value = false
  }
}

const closePreview = () => {
  emit('close')
}

const navigateToFile = async (index: number) => {
  if (index < 0 || index >= props.fileList.length) return
  if (index === currentIndex.value) return

  currentIndex.value = index
  const newFile = props.fileList[index]
  if (newFile) {
    emit('file-change', newFile.path)
    await loadCurrentFile()
    haptic.light()
  }
}

const handleSwipeGesture = (event: GestureEvent) => {
  if (props.fileList.length <= 1) return

  hideSwipeHint()

  if (event.direction === 'left') {
    // Next file
    const nextIndex = (currentIndex.value + 1) % props.fileList.length
    navigateToFile(nextIndex)
  } else if (event.direction === 'right') {
    // Previous file
    const prevIndex = currentIndex.value === 0 ? props.fileList.length - 1 : currentIndex.value - 1
    navigateToFile(prevIndex)
  }
}

const shareFile = async () => {
  if (!canShare.value || !currentFile.value || !fileContent.value) return

  try {
    const shareData = {
      title: currentFile.value.name,
      text: `Sharing file: ${currentFile.value.name}`,
      files: [
        new File([fileContent.value], currentFile.value.name, {
          type: getMimeType(currentFile.value.path)
        })
      ]
    }

    await navigator.share(shareData)
    haptic.light()
  } catch (err) {
    console.error('Failed to share file:', err)
  }
}

const getMimeType = (filePath: string): string => {
  const extension = fileSystem.getFileExtension(filePath)
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'json': 'application/json',
    'html': 'text/html',
    'css': 'text/css',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml'
  }
  return mimeTypes[extension] || 'text/plain'
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const hideSwipeHint = () => {
  showSwipeHint.value = false
}

// Touch event handlers for gesture system
const handleTouchStart = (event: TouchEvent) => {
  // Let the gesture system handle this
}

const handleTouchMove = (event: TouchEvent) => {
  // Let the gesture system handle this
}

const handleTouchEnd = (event: TouchEvent) => {
  // Let the gesture system handle this
}

// Keyboard navigation
const handleKeydown = (event: KeyboardEvent) => {
  if (!props.isVisible) return

  switch (event.key) {
    case 'Escape':
      closePreview()
      break
    case 'ArrowLeft':
      if (props.fileList.length > 1) {
        const prevIndex = currentIndex.value === 0 ? props.fileList.length - 1 : currentIndex.value - 1
        navigateToFile(prevIndex)
      }
      break
    case 'ArrowRight':
      if (props.fileList.length > 1) {
        const nextIndex = (currentIndex.value + 1) % props.fileList.length
        navigateToFile(nextIndex)
      }
      break
  }
}

// Watchers
watch(() => props.isVisible, (visible) => {
  if (visible) {
    loadCurrentFile()
    // Show hint for a few seconds
    setTimeout(() => {
      showSwipeHint.value = false
    }, 3000)
  } else {
    fileContent.value = null
    error.value = null
    showSwipeHint.value = true
  }
})

watch(() => props.filePath, () => {
  if (props.isVisible) {
    loadCurrentFile()
  }
})

watch(() => props.initialIndex, (newIndex) => {
  currentIndex.value = newIndex
})

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  previewElement.value = document.querySelector('.mobile-file-preview') as HTMLElement
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.mobile-file-preview {
  /* Ensure full screen coverage */
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  
  /* Prevent scrolling on body */
  overscroll-behavior: none;
  
  /* Hardware acceleration */
  transform: translateZ(0);
  will-change: transform;
}

.preview-header {
  /* Safe area support for notched devices */
  padding-top: max(1rem, env(safe-area-inset-top));
  padding-left: max(1rem, env(safe-area-inset-left));
  padding-right: max(1rem, env(safe-area-inset-right));
}

.preview-content {
  /* Ensure content doesn't go behind safe areas */
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}

.preview-navigation {
  /* Safe area support for bottom indicators */
  bottom: max(1rem, env(safe-area-inset-bottom));
}

.swipe-hint {
  /* Animate in */
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translate(-50%, 1rem);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

/* Prevent text selection during gestures */
.mobile-file-preview * {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* Allow text selection in content areas */
.preview-content pre,
.preview-content code {
  user-select: text;
  -webkit-user-select: text;
}
</style>