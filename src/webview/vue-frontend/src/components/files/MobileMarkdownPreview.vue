<template>
  <div class="mobile-markdown-preview relative w-full h-full bg-white dark:bg-gray-900 overflow-hidden">
    <!-- View Toggle -->
    <div class="view-toggle absolute top-4 right-4 z-10 bg-black bg-opacity-60 rounded-lg p-1 flex">
      <button
        @click="setView('preview')"
        :class="[
          'px-3 py-2 text-sm rounded transition-colors',
          currentView === 'preview' 
            ? 'bg-white text-black' 
            : 'text-white hover:bg-white hover:bg-opacity-20'
        ]"
      >
        Preview
      </button>
      <button
        @click="setView('source')"
        :class="[
          'px-3 py-2 text-sm rounded transition-colors',
          currentView === 'source' 
            ? 'bg-white text-black' 
            : 'text-white hover:bg-white hover:bg-opacity-20'
        ]"
      >
        Source
      </button>
      <button
        @click="setView('split')"
        :class="[
          'px-3 py-2 text-sm rounded transition-colors',
          currentView === 'split' 
            ? 'bg-white text-black' 
            : 'text-white hover:bg-white hover:bg-opacity-20'
        ]"
      >
        Split
      </button>
    </div>

    <!-- Content Container -->
    <div class="content-container h-full pt-16" :class="viewClass">
      <!-- Preview Only -->
      <div
        v-if="currentView === 'preview'"
        ref="previewContainer"
        class="preview-pane h-full overflow-auto p-4"
        @scroll="handlePreviewScroll"
      >
        <div
          class="markdown-content prose prose-sm max-w-none dark:prose-invert"
          v-html="renderedMarkdown"
        />
      </div>

      <!-- Source Only -->
      <div
        v-else-if="currentView === 'source'"
        ref="sourceContainer"
        class="source-pane h-full overflow-auto"
        @scroll="handleSourceScroll"
      >
        <MobileCodePreview
          :file-path="filePath"
          :file-content="fileContent"
          language="markdown"
          @close="$emit('close')"
        />
      </div>

      <!-- Split View -->
      <div v-else class="split-view h-full flex flex-col">
        <!-- Source Pane -->
        <div
          ref="sourceContainer"
          class="source-pane flex-1 overflow-auto border-b border-gray-300 dark:border-gray-700"
          @scroll="handleSourceScroll"
        >
          <div class="p-4">
            <pre
              class="text-sm font-mono whitespace-pre-wrap break-words text-gray-900 dark:text-white"
            >{{ fileContent }}</pre>
          </div>
        </div>

        <!-- Preview Pane -->
        <div
          ref="previewContainer"
          class="preview-pane flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-800"
          @scroll="handlePreviewScroll"
        >
          <div
            class="markdown-content prose prose-sm max-w-none dark:prose-invert"
            v-html="renderedMarkdown"
          />
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="markdown-controls absolute bottom-4 right-4 flex flex-col space-y-2 bg-black bg-opacity-60 rounded-lg p-2">
      <!-- Font Size Controls -->
      <button
        @click="increaseFontSize"
        :disabled="fontSize >= maxFontSize"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded disabled:opacity-50"
        aria-label="Increase font size"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      
      <div class="text-xs text-center text-white px-1">
        {{ fontSize }}px
      </div>
      
      <button
        @click="decreaseFontSize"
        :disabled="fontSize <= minFontSize"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded disabled:opacity-50"
        aria-label="Decrease font size"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />
        </svg>
      </button>
      
      <!-- Scroll Sync Toggle -->
      <button
        v-if="currentView === 'split'"
        @click="toggleScrollSync"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded"
        :class="{ 'bg-white bg-opacity-20': scrollSync }"
        aria-label="Toggle scroll sync"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </button>
    </div>

    <!-- Table of Contents -->
    <div
      v-if="showToc && tableOfContents.length > 0"
      class="toc-panel absolute top-16 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-xs max-h-96 overflow-auto"
    >
      <h3 class="text-sm font-semibold mb-2 text-gray-900 dark:text-white">Contents</h3>
      <nav class="toc-nav">
        <ul class="space-y-1">
          <li
            v-for="(item, index) in tableOfContents"
            :key="index"
            :class="`ml-${(item.level - 1) * 4}`"
          >
            <a
              href="#"
              @click.prevent="scrollToHeading(item.id)"
              class="text-sm text-blue-600 dark:text-blue-400 hover:underline block py-1"
            >
              {{ item.text }}
            </a>
          </li>
        </ul>
      </nav>
    </div>

    <!-- TOC Toggle -->
    <button
      v-if="tableOfContents.length > 0"
      @click="toggleToc"
      class="toc-toggle absolute top-4 left-4 p-2 bg-black bg-opacity-60 text-white rounded-lg hover:bg-opacity-80"
      aria-label="Toggle table of contents"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useHapticFeedback } from '../../composables/useHapticFeedback'
import MobileCodePreview from './MobileCodePreview.vue'

interface Props {
  filePath?: string | null
  fileContent?: string | null
}

interface Emits {
  (e: 'close'): void
}

interface TocItem {
  level: number
  text: string
  id: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Composables
const haptic = useHapticFeedback()

// Refs
const previewContainer = ref<HTMLElement | null>(null)
const sourceContainer = ref<HTMLElement | null>(null)

// State
const currentView = ref<'preview' | 'source' | 'split'>('preview')
const fontSize = ref(16)
const minFontSize = 12
const maxFontSize = 24
const scrollSync = ref(true)
const showToc = ref(false)
const tableOfContents = ref<TocItem[]>([])
const isScrollSyncing = ref(false)

// Computed
const viewClass = computed(() => ({
  'view-preview': currentView.value === 'preview',
  'view-source': currentView.value === 'source',
  'view-split': currentView.value === 'split'
}))

const renderedMarkdown = computed(() => {
  if (!props.fileContent) return ''
  
  let html = renderMarkdown(props.fileContent)
  
  // Add IDs to headings for TOC
  html = addHeadingIds(html)
  
  return html
})

// Methods
const renderMarkdown = (markdown: string): string => {
  // Basic markdown rendering implementation
  // In a real implementation, you'd use a library like marked or markdown-it
  
  let html = markdown
  
  // Escape HTML first
  html = html.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Headers
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>')
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>')
  
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.*?)_/g, '<em>$1</em>')
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto" />')
  
  // Lists
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>')
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/^\+ (.+)$/gm, '<li>$1</li>')
  
  // Wrap consecutive list items in ul
  html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
    return '<ul>' + match + '</ul>'
  })
  
  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/gs, (match, p1) => {
    if (match.includes('<ul>')) return match
    return '<ol>' + match + '</ol>'
  })
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>')
  html = html.replace(/^\*\*\*$/gm, '<hr>')
  
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>')
  html = '<p>' + html + '</p>'
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p>(<h[1-6]>)/g, '$1')
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ul>)/g, '$1')
  html = html.replace(/(<\/ul>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ol>)/g, '$1')
  html = html.replace(/(<\/ol>)<\/p>/g, '$1')
  html = html.replace(/<p>(<blockquote>)/g, '$1')
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1')
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1')
  html = html.replace(/<p>(<pre>)/g, '$1')
  html = html.replace(/(<\/pre>)<\/p>/g, '$1')
  
  return html
}

const addHeadingIds = (html: string): string => {
  const headings: TocItem[] = []
  
  html = html.replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (match, level, text) => {
    const cleanText = text.replace(/<[^>]*>/g, '').trim()
    const id = cleanText.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    
    headings.push({
      level: parseInt(level),
      text: cleanText,
      id
    })
    
    return `<h${level} id="${id}">${text}</h${level}>`
  })
  
  tableOfContents.value = headings
  return html
}

const setView = (view: 'preview' | 'source' | 'split') => {
  currentView.value = view
  haptic.light()
}

const increaseFontSize = () => {
  if (fontSize.value < maxFontSize) {
    fontSize.value += 2
    haptic.light()
  }
}

const decreaseFontSize = () => {
  if (fontSize.value > minFontSize) {
    fontSize.value -= 2
    haptic.light()
  }
}

const toggleScrollSync = () => {
  scrollSync.value = !scrollSync.value
  haptic.light()
}

const toggleToc = () => {
  showToc.value = !showToc.value
  haptic.light()
}

const scrollToHeading = (id: string) => {
  const element = document.getElementById(id)
  if (element && previewContainer.value) {
    const containerRect = previewContainer.value.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const scrollTop = previewContainer.value.scrollTop + elementRect.top - containerRect.top - 20
    
    previewContainer.value.scrollTo({
      top: scrollTop,
      behavior: 'smooth'
    })
  }
  
  showToc.value = false
  haptic.light()
}

// Scroll synchronization
const handlePreviewScroll = () => {
  if (!scrollSync.value || isScrollSyncing.value || currentView.value !== 'split') return
  if (!previewContainer.value || !sourceContainer.value) return
  
  isScrollSyncing.value = true
  
  const previewScrollRatio = previewContainer.value.scrollTop / 
    (previewContainer.value.scrollHeight - previewContainer.value.clientHeight)
  
  const sourceScrollTop = previewScrollRatio * 
    (sourceContainer.value.scrollHeight - sourceContainer.value.clientHeight)
  
  sourceContainer.value.scrollTop = sourceScrollTop
  
  setTimeout(() => {
    isScrollSyncing.value = false
  }, 100)
}

const handleSourceScroll = () => {
  if (!scrollSync.value || isScrollSyncing.value || currentView.value !== 'split') return
  if (!previewContainer.value || !sourceContainer.value) return
  
  isScrollSyncing.value = true
  
  const sourceScrollRatio = sourceContainer.value.scrollTop / 
    (sourceContainer.value.scrollHeight - sourceContainer.value.clientHeight)
  
  const previewScrollTop = sourceScrollRatio * 
    (previewContainer.value.scrollHeight - previewContainer.value.clientHeight)
  
  previewContainer.value.scrollTop = previewScrollTop
  
  setTimeout(() => {
    isScrollSyncing.value = false
  }, 100)
}

// Lifecycle
onMounted(() => {
  // Load user preferences
  const savedView = localStorage.getItem('mobile-markdown-preview-view')
  if (savedView && ['preview', 'source', 'split'].includes(savedView)) {
    currentView.value = savedView as 'preview' | 'source' | 'split'
  }
  
  const savedFontSize = localStorage.getItem('mobile-markdown-preview-font-size')
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize, 10)
  }
  
  const savedScrollSync = localStorage.getItem('mobile-markdown-preview-scroll-sync')
  if (savedScrollSync) {
    scrollSync.value = savedScrollSync === 'true'
  }
})

// Save preferences
watch(currentView, (newView) => {
  localStorage.setItem('mobile-markdown-preview-view', newView)
})

watch(fontSize, (newSize) => {
  localStorage.setItem('mobile-markdown-preview-font-size', newSize.toString())
})

watch(scrollSync, (sync) => {
  localStorage.setItem('mobile-markdown-preview-scroll-sync', sync.toString())
})
</script>

<style scoped>
.mobile-markdown-preview {
  /* Safe area support */
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}

.content-container {
  font-size: v-bind(fontSize + 'px');
}

.preview-pane,
.source-pane {
  /* Smooth scrolling */
  scroll-behavior: smooth;
  
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
}

.preview-pane::-webkit-scrollbar,
.source-pane::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.preview-pane::-webkit-scrollbar-track,
.source-pane::-webkit-scrollbar-track {
  background: transparent;
}

.preview-pane::-webkit-scrollbar-thumb,
.source-pane::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.preview-pane::-webkit-scrollbar-thumb:hover,
.source-pane::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

/* Dark mode scrollbar */
.dark .preview-pane::-webkit-scrollbar-thumb,
.dark .source-pane::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

.dark .preview-pane::-webkit-scrollbar-thumb:hover,
.dark .source-pane::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Markdown content styling */
.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-content :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.3em;
}

.markdown-content :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.3em;
}

.markdown-content :deep(h3) {
  font-size: 1.25em;
}

.markdown-content :deep(p) {
  margin-bottom: 1em;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-bottom: 1em;
  padding-left: 2em;
}

.markdown-content :deep(li) {
  margin-bottom: 0.25em;
}

.markdown-content :deep(blockquote) {
  margin: 1em 0;
  padding: 0 1em;
  border-left: 4px solid #d1d5db;
  color: #6b7280;
  font-style: italic;
}

.markdown-content :deep(code) {
  background-color: #f3f4f6;
  padding: 0.125em 0.25em;
  border-radius: 0.25em;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875em;
}

.markdown-content :deep(pre) {
  background-color: #f3f4f6;
  padding: 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  margin: 1em 0;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #d1d5db;
  padding: 0.5em;
  text-align: left;
}

.markdown-content :deep(th) {
  background-color: #f9fafb;
  font-weight: 600;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 2em 0;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5em;
  margin: 1em 0;
}

.markdown-content :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
}

.markdown-content :deep(a:hover) {
  color: #1d4ed8;
}

/* Dark mode adjustments */
.dark .markdown-content :deep(h1),
.dark .markdown-content :deep(h2) {
  border-bottom-color: #374151;
}

.dark .markdown-content :deep(blockquote) {
  border-left-color: #4b5563;
  color: #9ca3af;
}

.dark .markdown-content :deep(code) {
  background-color: #374151;
  color: #f9fafb;
}

.dark .markdown-content :deep(pre) {
  background-color: #374151;
}

.dark .markdown-content :deep(th),
.dark .markdown-content :deep(td) {
  border-color: #4b5563;
}

.dark .markdown-content :deep(th) {
  background-color: #374151;
}

.dark .markdown-content :deep(hr) {
  border-top-color: #4b5563;
}

/* Controls positioning */
.view-toggle {
  top: max(1rem, env(safe-area-inset-top));
  right: max(1rem, env(safe-area-inset-right));
}

.markdown-controls {
  bottom: max(1rem, env(safe-area-inset-bottom));
  right: max(1rem, env(safe-area-inset-right));
}

.toc-toggle {
  top: max(1rem, env(safe-area-inset-top));
  left: max(1rem, env(safe-area-inset-left));
}

.toc-panel {
  top: max(4rem, env(safe-area-inset-top) + 3rem);
  left: max(1rem, env(safe-area-inset-left));
}
</style>