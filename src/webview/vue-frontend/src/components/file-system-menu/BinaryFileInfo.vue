<template>
  <div class="binary-file-info h-full flex flex-col">
    <!-- Header -->
    <div class="binary-info-header p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white">
          Binary File Information
        </h4>
        <button
          @click="copyPath"
          class="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
        >
          Copy Path
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="binary-info-content flex-1 overflow-auto p-4">
      <!-- File Icon -->
      <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3">
          <component :is="fileIcon" class="w-8 h-8 text-gray-500 dark:text-gray-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">
          {{ metadata.name }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ fileTypeDescription }}
        </p>
      </div>

      <!-- Basic Information -->
      <div class="space-y-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            File Details
          </h4>
          <dl class="space-y-2">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500 dark:text-gray-400">Size:</dt>
              <dd class="text-sm text-gray-900 dark:text-white font-mono">
                {{ formatFileSize(metadata.size) }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500 dark:text-gray-400">Type:</dt>
              <dd class="text-sm text-gray-900 dark:text-white">
                {{ metadata.extension?.toUpperCase() || 'Unknown' }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500 dark:text-gray-400">MIME Type:</dt>
              <dd class="text-sm text-gray-900 dark:text-white font-mono">
                {{ metadata.mimeType || 'application/octet-stream' }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500 dark:text-gray-400">Modified:</dt>
              <dd class="text-sm text-gray-900 dark:text-white">
                {{ formatDate(metadata.modified) }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500 dark:text-gray-400">Created:</dt>
              <dd class="text-sm text-gray-900 dark:text-white">
                {{ formatDate(metadata.created) }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Permissions (if available) -->
        <div v-if="metadata.permissions" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Permissions
          </h4>
          <div class="flex space-x-4">
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2" :class="metadata.permissions.readable ? 'text-green-500' : 'text-gray-400'" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 12a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.522 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
              </svg>
              <span class="text-sm" :class="metadata.permissions.readable ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'">
                Read
              </span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2" :class="metadata.permissions.writable ? 'text-green-500' : 'text-gray-400'" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              <span class="text-sm" :class="metadata.permissions.writable ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'">
                Write
              </span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2" :class="metadata.permissions.executable ? 'text-green-500' : 'text-gray-400'" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
              </svg>
              <span class="text-sm" :class="metadata.permissions.executable ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'">
                Execute
              </span>
            </div>
          </div>
        </div>

        <!-- Path Information -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Location
          </h4>
          <div class="space-y-2">
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400 mb-1">Full Path:</dt>
              <dd class="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded break-all">
                {{ metadata.path }}
              </dd>
            </div>
          </div>
        </div>

        <!-- Additional Details (if showDetails is true) -->
        <div v-if="showDetails" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Additional Information
          </h4>
          <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              This is a binary file that cannot be previewed as text. 
              {{ fileTypeDescription }} files typically contain {{ getFileDescription() }}.
            </p>
            <p v-if="isExecutable" class="text-orange-600 dark:text-orange-400">
              ⚠️ This file appears to be executable. Exercise caution when running unknown executables.
            </p>
            <p v-if="isHidden" class="text-blue-600 dark:text-blue-400">
              🔒 This is a hidden file (starts with a dot).
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Actions
          </h4>
          <div class="flex flex-wrap gap-2">
            <button
              @click="copyPath"
              class="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              Copy Path
            </button>
            <button
              @click="copyRelativePath"
              class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Copy Relative Path
            </button>
            <button
              @click="revealInExplorer"
              class="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800"
            >
              Reveal in Explorer
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BinaryFileInfoProps } from './types'

// Props
const props = withDefaults(defineProps<BinaryFileInfoProps>(), {
  showDetails: true
})

// Emits
const emit = defineEmits<{
  'copy-path': [path: string]
  'copy-relative-path': [path: string]
  'reveal-in-explorer': [path: string]
}>()

// Computed
const fileIcon = computed(() => {
  const extension = props.metadata.extension?.toLowerCase()
  
  switch (extension) {
    case 'exe':
    case 'msi':
    case 'app':
    case 'deb':
    case 'rpm':
      return 'ExecutableIcon'
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return 'ArchiveIcon'
    case 'pdf':
      return 'PDFIcon'
    case 'doc':
    case 'docx':
    case 'odt':
      return 'DocumentIcon'
    case 'xls':
    case 'xlsx':
    case 'ods':
      return 'SpreadsheetIcon'
    case 'ppt':
    case 'pptx':
    case 'odp':
      return 'PresentationIcon'
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'ogg':
      return 'AudioIcon'
    case 'mp4':
    case 'avi':
    case 'mkv':
    case 'mov':
      return 'VideoIcon'
    case 'ttf':
    case 'otf':
    case 'woff':
    case 'woff2':
      return 'FontIcon'
    default:
      return 'BinaryIcon'
  }
})

const fileTypeDescription = computed(() => {
  const extension = props.metadata.extension?.toLowerCase()
  
  switch (extension) {
    case 'exe':
    case 'msi':
      return 'Windows Executable'
    case 'app':
      return 'macOS Application'
    case 'deb':
      return 'Debian Package'
    case 'rpm':
      return 'RPM Package'
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return 'Archive File'
    case 'pdf':
      return 'PDF Document'
    case 'doc':
    case 'docx':
    case 'odt':
      return 'Word Document'
    case 'xls':
    case 'xlsx':
    case 'ods':
      return 'Spreadsheet'
    case 'ppt':
    case 'pptx':
    case 'odp':
      return 'Presentation'
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'ogg':
      return 'Audio File'
    case 'mp4':
    case 'avi':
    case 'mkv':
    case 'mov':
      return 'Video File'
    case 'ttf':
    case 'otf':
    case 'woff':
    case 'woff2':
      return 'Font File'
    default:
      return 'Binary File'
  }
})

const isExecutable = computed(() => {
  const extension = props.metadata.extension?.toLowerCase()
  return ['exe', 'msi', 'app', 'deb', 'rpm', 'sh', 'bat', 'cmd'].includes(extension || '') ||
         props.metadata.permissions?.executable === true
})

const isHidden = computed(() => {
  return props.metadata.isHidden || props.metadata.name.startsWith('.')
})

// Methods
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const getFileDescription = (): string => {
  const extension = props.metadata.extension?.toLowerCase()
  
  switch (extension) {
    case 'exe':
    case 'msi':
    case 'app':
      return 'executable code and resources'
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return 'compressed files and folders'
    case 'pdf':
      return 'formatted text, images, and layout information'
    case 'doc':
    case 'docx':
    case 'odt':
      return 'formatted text documents with styling'
    case 'xls':
    case 'xlsx':
    case 'ods':
      return 'spreadsheet data and formulas'
    case 'ppt':
    case 'pptx':
    case 'odp':
      return 'presentation slides and multimedia'
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'ogg':
      return 'audio data and metadata'
    case 'mp4':
    case 'avi':
    case 'mkv':
    case 'mov':
      return 'video and audio streams'
    case 'ttf':
    case 'otf':
    case 'woff':
    case 'woff2':
      return 'font glyph data and metrics'
    default:
      return 'binary data that requires specific software to interpret'
  }
}

const copyPath = async () => {
  try {
    await navigator.clipboard.writeText(props.metadata.path)
    emit('copy-path', props.metadata.path)
  } catch (error) {
    console.error('Failed to copy path:', error)
  }
}

const copyRelativePath = async () => {
  try {
    // Extract relative path (this would need to be calculated based on workspace root)
    const relativePath = props.metadata.path.replace(/^.*\//, './')
    await navigator.clipboard.writeText(relativePath)
    emit('copy-relative-path', relativePath)
  } catch (error) {
    console.error('Failed to copy relative path:', error)
  }
}

const revealInExplorer = () => {
  emit('reveal-in-explorer', props.metadata.path)
}
</script>

<script lang="ts">
// Icon components for different file types
import { defineComponent, h } from 'vue'

const BinaryIcon = defineComponent({
  name: 'BinaryIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { fillRule: 'evenodd', d: 'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z', clipRule: 'evenodd' })
  ])
})

const ExecutableIcon = defineComponent({
  name: 'ExecutableIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { fillRule: 'evenodd', d: 'M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z', clipRule: 'evenodd' })
  ])
})

const ArchiveIcon = defineComponent({
  name: 'ArchiveIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { d: 'M4 3a2 2 0 100 4h12a2 2 0 100-4H4z' }),
    h('path', { fillRule: 'evenodd', d: 'M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z', clipRule: 'evenodd' })
  ])
})

const PDFIcon = defineComponent({
  name: 'PDFIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { fillRule: 'evenodd', d: 'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z', clipRule: 'evenodd' })
  ])
})

const DocumentIcon = defineComponent({
  name: 'DocumentIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { fillRule: 'evenodd', d: 'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z', clipRule: 'evenodd' })
  ])
})

const SpreadsheetIcon = defineComponent({
  name: 'SpreadsheetIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { fillRule: 'evenodd', d: 'M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z', clipRule: 'evenodd' })
  ])
})

const PresentationIcon = defineComponent({
  name: 'PresentationIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { fillRule: 'evenodd', d: 'M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1h-5v2a1 1 0 11-2 0v-2H4a1 1 0 01-1-1V4zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm0 3a1 1 0 011-1h4a1 1 0 110 2H6a1 1 0 01-1-1z', clipRule: 'evenodd' })
  ])
})

const AudioIcon = defineComponent({
  name: 'AudioIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { fillRule: 'evenodd', d: 'M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12c0-2.21-.896-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 12a5.984 5.984 0 01-.757 2.828 1 1 0 11-1.415-1.414A3.984 3.984 0 0013 12a3.983 3.983 0 00-.172-1.414 1 1 0 010-1.415z', clipRule: 'evenodd' })
  ])
})

const VideoIcon = defineComponent({
  name: 'VideoIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { d: 'M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z' })
  ])
})

const FontIcon = defineComponent({
  name: 'FontIcon',
  render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
    h('path', { fillRule: 'evenodd', d: 'M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 5a1 1 0 011-1h1a1 1 0 110 2H8a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2h-1z', clipRule: 'evenodd' })
  ])
})

export default {
  components: {
    BinaryIcon,
    ExecutableIcon,
    ArchiveIcon,
    PDFIcon,
    DocumentIcon,
    SpreadsheetIcon,
    PresentationIcon,
    AudioIcon,
    VideoIcon,
    FontIcon
  }
}
</script>

<style scoped>
.binary-file-info {
  min-height: 0;
}

.binary-info-content {
  min-height: 0;
}

/* Scrollbar styling */
.binary-info-content::-webkit-scrollbar {
  width: 8px;
}

.binary-info-content::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.binary-info-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.binary-info-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.dark .binary-info-content::-webkit-scrollbar-track {
  background: #1e293b;
}

.dark .binary-info-content::-webkit-scrollbar-thumb {
  background: #475569;
}

.dark .binary-info-content::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>