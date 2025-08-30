<template>
  <div class="text-preview h-full flex flex-col">
    <!-- Header with file info -->
    <div class="text-preview-header p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div class="flex items-center justify-between text-sm">
        <div class="flex items-center space-x-2">
          <span class="text-gray-600 dark:text-gray-400">{{ language.toUpperCase() }}</span>
          <span class="text-gray-400 dark:text-gray-500">•</span>
          <span class="text-gray-600 dark:text-gray-400">{{ lineCount }} lines</span>
          <span class="text-gray-400 dark:text-gray-500">•</span>
          <span class="text-gray-600 dark:text-gray-400">{{ formatFileSize(content.length) }}</span>
        </div>
        <div class="flex items-center space-x-2">
          <button
            @click="toggleLineNumbers"
            class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            {{ showLineNumbers ? 'Hide' : 'Show' }} Lines
          </button>
          <button
            @click="copyContent"
            class="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            Copy
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="text-preview-content flex-1 overflow-auto">
      <div class="relative">
        <!-- Line numbers -->
        <div
          v-if="showLineNumbers"
          class="line-numbers absolute left-0 top-0 w-12 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 text-right text-xs text-gray-500 dark:text-gray-400 font-mono leading-6 py-4 pr-2 select-none"
        >
          <div v-for="lineNum in displayedLineCount" :key="lineNum" class="line-number">
            {{ lineNum }}
          </div>
        </div>

        <!-- Code content -->
        <div
          class="code-content font-mono text-sm leading-6 p-4"
          :class="{ 'pl-16': showLineNumbers }"
        >
          <pre
            class="whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100"
            v-html="highlightedContent"
          ></pre>
        </div>

        <!-- Truncation notice -->
        <div
          v-if="isTruncated"
          class="truncation-notice p-4 border-t border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2 text-sm text-yellow-800 dark:text-yellow-200">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <span>File truncated at {{ maxLines }} lines</span>
            </div>
            <button
              @click="showFullContent"
              class="text-sm px-3 py-1 rounded bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-300 dark:hover:bg-yellow-700"
            >
              Show All
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TextPreviewProps } from './types'

// Props
const props = withDefaults(defineProps<TextPreviewProps>(), {
  maxLines: 1000,
  showLineNumbers: true
})

// Emits
const emit = defineEmits<{
  'copy-content': [content: string]
}>()

// State
const showLineNumbers = ref(props.showLineNumbers)
const showingFullContent = ref(false)

// Computed
const lines = computed(() => props.content.split('\n'))

const lineCount = computed(() => lines.value.length)

const displayedLines = computed(() => {
  if (showingFullContent.value || !props.maxLines) {
    return lines.value
  }
  return lines.value.slice(0, props.maxLines)
})

const displayedContent = computed(() => displayedLines.value.join('\n'))

const displayedLineCount = computed(() => displayedLines.value.length)

const isTruncated = computed(() => 
  !showingFullContent.value && 
  props.maxLines && 
  lines.value.length > props.maxLines
)

const highlightedContent = computed(() => {
  // Basic syntax highlighting based on language
  let content = escapeHtml(displayedContent.value)
  
  switch (props.language.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'typescript':
    case 'ts':
      content = highlightJavaScript(content)
      break
    case 'json':
      content = highlightJSON(content)
      break
    case 'css':
    case 'scss':
    case 'less':
      content = highlightCSS(content)
      break
    case 'html':
    case 'xml':
      content = highlightHTML(content)
      break
    case 'markdown':
    case 'md':
      content = highlightMarkdown(content)
      break
    default:
      // No highlighting for unknown languages
      break
  }
  
  return content
})

// Methods
const toggleLineNumbers = () => {
  showLineNumbers.value = !showLineNumbers.value
}

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(props.content)
    emit('copy-content', props.content)
    // Could show a toast notification here
  } catch (error) {
    console.error('Failed to copy content:', error)
  }
}

const showFullContent = () => {
  showingFullContent.value = true
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Basic syntax highlighting functions
const highlightJavaScript = (content: string): string => {
  return content
    .replace(/\b(const|let|var|function|class|if|else|for|while|return|import|export|from|default|async|await|try|catch|finally|throw|new|this|super|extends|implements|interface|type|enum|namespace|module|declare|public|private|protected|static|readonly|abstract)\b/g, 
      '<span class="text-purple-600 dark:text-purple-400 font-semibold">$1</span>')
    .replace(/\b(true|false|null|undefined|NaN|Infinity)\b/g, 
      '<span class="text-blue-600 dark:text-blue-400">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, 
      '<span class="text-green-600 dark:text-green-400">$1</span>')
    .replace(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, 
      '<span class="text-red-600 dark:text-red-400">$1$2$1</span>')
    .replace(/(\/\/.*$)/gm, 
      '<span class="text-gray-500 dark:text-gray-400 italic">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, 
      '<span class="text-gray-500 dark:text-gray-400 italic">$1</span>')
}

const highlightJSON = (content: string): string => {
  return content
    .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1(\s*:)/g, 
      '<span class="text-blue-600 dark:text-blue-400">$1$2$1</span>$3')
    .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, 
      '<span class="text-green-600 dark:text-green-400">$1$2$1</span>')
    .replace(/\b(true|false|null)\b/g, 
      '<span class="text-purple-600 dark:text-purple-400">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, 
      '<span class="text-orange-600 dark:text-orange-400">$1</span>')
}

const highlightCSS = (content: string): string => {
  return content
    .replace(/([.#]?[a-zA-Z-]+)(\s*{)/g, 
      '<span class="text-blue-600 dark:text-blue-400">$1</span>$2')
    .replace(/([a-zA-Z-]+)(\s*:)/g, 
      '<span class="text-purple-600 dark:text-purple-400">$1</span>$2')
    .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, 
      '<span class="text-green-600 dark:text-green-400">$1$2$1</span>')
    .replace(/\b(\d+(?:px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|vmin|vmax)?)\b/g, 
      '<span class="text-orange-600 dark:text-orange-400">$1</span>')
}

const highlightHTML = (content: string): string => {
  return content
    .replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)(.*?)(&gt;)/g, 
      '$1<span class="text-blue-600 dark:text-blue-400">$2</span>$3$4')
    .replace(/([a-zA-Z-]+)(=)(["'])((?:\\.|(?!\3)[^\\])*?)\3/g, 
      '<span class="text-purple-600 dark:text-purple-400">$1</span>$2<span class="text-green-600 dark:text-green-400">$3$4$3</span>')
}

const highlightMarkdown = (content: string): string => {
  return content
    .replace(/^(#{1,6})\s+(.*)$/gm, 
      '<span class="text-blue-600 dark:text-blue-400 font-bold">$1</span> <span class="font-semibold">$2</span>')
    .replace(/\*\*(.*?)\*\*/g, 
      '<span class="font-bold">$1</span>')
    .replace(/\*(.*?)\*/g, 
      '<span class="italic">$1</span>')
    .replace(/`([^`]+)`/g, 
      '<span class="bg-gray-200 dark:bg-gray-700 px-1 rounded font-mono text-sm">$1</span>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
      '<span class="text-blue-600 dark:text-blue-400 underline">$1</span>')
}
</script>

<style scoped>
.text-preview {
  min-height: 0;
}

.text-preview-content {
  min-height: 0;
}

.line-numbers {
  z-index: 1;
}

.code-content {
  position: relative;
  z-index: 2;
}

.line-number {
  height: 24px;
  line-height: 24px;
}

/* Scrollbar styling */
.text-preview-content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.text-preview-content::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.text-preview-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.text-preview-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.dark .text-preview-content::-webkit-scrollbar-track {
  background: #1e293b;
}

.dark .text-preview-content::-webkit-scrollbar-thumb {
  background: #475569;
}

.dark .text-preview-content::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>