<template>
  <div class="mobile-text-preview relative w-full h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">
    <!-- Text Container -->
    <div
      ref="textContainer"
      class="text-container absolute inset-0 overflow-auto p-4"
      :style="containerStyle"
    >
      <div class="text-content">
        <!-- Line Numbers -->
        <div v-if="showLineNumbers" class="line-numbers-container flex">
          <div class="line-numbers select-none text-gray-500 text-right pr-4 font-mono text-sm leading-relaxed">
            <div
              v-for="lineNumber in totalLines"
              :key="lineNumber"
              class="line-number"
              :class="{ 'highlighted': highlightedLines.has(lineNumber) }"
            >
              {{ lineNumber }}
            </div>
          </div>
          
          <div class="text-lines flex-1 font-mono text-sm leading-relaxed">
            <pre
              class="text-block whitespace-pre-wrap break-words"
              :class="{ 'word-wrap': wordWrap }"
              v-html="highlightedText"
            ></pre>
          </div>
        </div>
        
        <!-- Text without line numbers -->
        <div v-else class="text-lines">
          <pre
            class="text-block whitespace-pre-wrap break-words font-mono text-sm leading-relaxed"
            :class="{ 'word-wrap': wordWrap }"
            v-html="highlightedText"
          ></pre>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="text-controls absolute top-4 right-4 flex flex-col space-y-2 bg-black bg-opacity-60 rounded-lg p-2">
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
      
      <!-- Line Numbers Toggle -->
      <button
        @click="toggleLineNumbers"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded"
        :class="{ 'bg-white bg-opacity-20': showLineNumbers }"
        aria-label="Toggle line numbers"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      </button>
      
      <!-- Word Wrap Toggle -->
      <button
        @click="toggleWordWrap"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded"
        :class="{ 'bg-white bg-opacity-20': wordWrap }"
        aria-label="Toggle word wrap"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
        </svg>
      </button>
      
      <!-- Font Family Toggle -->
      <button
        @click="toggleFontFamily"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded"
        aria-label="Toggle font family"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7V4a1 1 0 011-1h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V20a1 1 0 01-1 1h-4.586a1 1 0 01-.707-.293l-4.414-4.414A1 1 0 014 16.586V7z" />
        </svg>
      </button>
    </div>

    <!-- File Info -->
    <div class="file-info absolute top-4 left-4 bg-black bg-opacity-60 text-white text-sm rounded-lg px-3 py-2">
      <div>{{ totalLines }} lines</div>
      <div v-if="fileContent">{{ formatFileSize(fileContent.length) }}</div>
      <div class="text-xs text-gray-300 mt-1">{{ currentFontFamily }}</div>
    </div>

    <!-- Search Bar -->
    <div
      v-if="showSearch"
      class="search-bar absolute bottom-4 left-4 right-4 bg-black bg-opacity-80 rounded-lg p-3"
    >
      <div class="flex items-center space-x-2">
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Search in text..."
          class="flex-1 bg-gray-800 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          @keydown.enter="findNext"
          @keydown.escape="closeSearch"
        />
        <button
          @click="toggleCaseSensitive"
          :class="[
            'p-2 text-white rounded text-xs',
            caseSensitive 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'hover:bg-white hover:bg-opacity-20'
          ]"
          aria-label="Toggle case sensitive"
        >
          Aa
        </button>
        <button
          @click="findPrevious"
          :disabled="searchResults.length === 0"
          class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded disabled:opacity-50"
          aria-label="Previous match"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          @click="findNext"
          :disabled="searchResults.length === 0"
          class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded disabled:opacity-50"
          aria-label="Next match"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-if="searchResults.length > 0" class="text-sm text-gray-300">
          {{ currentSearchIndex + 1 }}/{{ searchResults.length }}
        </div>
        <button
          @click="closeSearch"
          class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded"
          aria-label="Close search"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Search Toggle -->
    <button
      v-if="!showSearch"
      @click="openSearch"
      class="search-toggle absolute bottom-4 right-4 p-3 bg-black bg-opacity-60 text-white rounded-lg hover:bg-opacity-80"
      aria-label="Search in text"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>

    <!-- Go to Line -->
    <div
      v-if="showGoToLine"
      class="goto-line absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-90 rounded-lg p-4"
    >
      <div class="text-white text-sm mb-2">Go to line:</div>
      <div class="flex items-center space-x-2">
        <input
          ref="goToLineInput"
          v-model="goToLineNumber"
          type="number"
          :min="1"
          :max="totalLines"
          class="bg-gray-800 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
          @keydown.enter="goToLine"
          @keydown.escape="closeGoToLine"
        />
        <button
          @click="goToLine"
          class="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Go
        </button>
        <button
          @click="closeGoToLine"
          class="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Go to Line Toggle -->
    <button
      v-if="!showGoToLine && totalLines > 50"
      @click="openGoToLine"
      class="goto-line-toggle absolute bottom-16 right-4 p-2 bg-black bg-opacity-60 text-white rounded-lg hover:bg-opacity-80 text-xs"
      aria-label="Go to line"
    >
      Go to line
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useHapticFeedback } from '../../composables/useHapticFeedback'

interface Props {
  filePath?: string | null
  fileContent?: string | null
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Composables
const haptic = useHapticFeedback()

// Refs
const textContainer = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const goToLineInput = ref<HTMLInputElement | null>(null)

// State
const fontSize = ref(14)
const minFontSize = 10
const maxFontSize = 24
const showLineNumbers = ref(true)
const wordWrap = ref(false)
const fontFamily = ref<'mono' | 'sans' | 'serif'>('mono')
const showSearch = ref(false)
const searchQuery = ref('')
const caseSensitive = ref(false)
const searchResults = ref<{ line: number; start: number; end: number }[]>([])
const currentSearchIndex = ref(0)
const highlightedLines = ref<Set<number>>(new Set())
const showGoToLine = ref(false)
const goToLineNumber = ref(1)

// Computed
const containerStyle = computed(() => ({
  fontSize: `${fontSize.value}px`,
  fontFamily: getFontFamily()
}))

const totalLines = computed(() => {
  if (!props.fileContent) return 0
  return props.fileContent.split('\n').length
})

const currentFontFamily = computed(() => {
  switch (fontFamily.value) {
    case 'mono': return 'Monospace'
    case 'sans': return 'Sans-serif'
    case 'serif': return 'Serif'
    default: return 'Monospace'
  }
})

const highlightedText = computed(() => {
  if (!props.fileContent) return ''
  
  let content = escapeHtml(props.fileContent)
  
  // Apply search highlighting
  if (searchQuery.value && searchResults.value.length > 0) {
    content = applySearchHighlighting(content)
  }
  
  return content
})

// Methods
const getFontFamily = (): string => {
  switch (fontFamily.value) {
    case 'mono':
      return "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace"
    case 'sans':
      return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    case 'serif':
      return "'Times New Roman', Times, serif"
    default:
      return "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace"
  }
}

const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const applySearchHighlighting = (content: string): string => {
  if (!searchQuery.value) return content
  
  const flags = caseSensitive.value ? 'g' : 'gi'
  const regex = new RegExp(escapeRegExp(searchQuery.value), flags)
  let matchIndex = 0
  
  return content.replace(regex, (match) => {
    const isCurrentMatch = matchIndex === currentSearchIndex.value
    matchIndex++
    return `<span class="search-highlight ${isCurrentMatch ? 'current' : ''}">${match}</span>`
  })
}

const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Control methods
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

const toggleLineNumbers = () => {
  showLineNumbers.value = !showLineNumbers.value
  haptic.light()
}

const toggleWordWrap = () => {
  wordWrap.value = !wordWrap.value
  haptic.light()
}

const toggleFontFamily = () => {
  const families: ('mono' | 'sans' | 'serif')[] = ['mono', 'sans', 'serif']
  const currentIndex = families.indexOf(fontFamily.value)
  fontFamily.value = families[(currentIndex + 1) % families.length]
  haptic.light()
}

// Search methods
const openSearch = async () => {
  showSearch.value = true
  await nextTick()
  searchInput.value?.focus()
}

const closeSearch = () => {
  showSearch.value = false
  searchQuery.value = ''
  searchResults.value = []
  highlightedLines.value.clear()
}

const toggleCaseSensitive = () => {
  caseSensitive.value = !caseSensitive.value
  performSearch()
  haptic.light()
}

const performSearch = () => {
  if (!searchQuery.value || !props.fileContent) {
    searchResults.value = []
    highlightedLines.value.clear()
    return
  }
  
  const lines = props.fileContent.split('\n')
  const results: { line: number; start: number; end: number }[] = []
  const highlightedLineNumbers = new Set<number>()
  
  const flags = caseSensitive.value ? 'g' : 'gi'
  const regex = new RegExp(escapeRegExp(searchQuery.value), flags)
  
  lines.forEach((line, lineIndex) => {
    let match
    while ((match = regex.exec(line)) !== null) {
      results.push({
        line: lineIndex + 1,
        start: match.index,
        end: match.index + match[0].length
      })
      highlightedLineNumbers.add(lineIndex + 1)
    }
  })
  
  searchResults.value = results
  highlightedLines.value = highlightedLineNumbers
  currentSearchIndex.value = 0
  
  if (results.length > 0) {
    scrollToSearchResult(0)
  }
}

const findNext = () => {
  if (searchResults.value.length === 0) return
  
  currentSearchIndex.value = (currentSearchIndex.value + 1) % searchResults.value.length
  scrollToSearchResult(currentSearchIndex.value)
  haptic.light()
}

const findPrevious = () => {
  if (searchResults.value.length === 0) return
  
  currentSearchIndex.value = currentSearchIndex.value === 0 
    ? searchResults.value.length - 1 
    : currentSearchIndex.value - 1
  scrollToSearchResult(currentSearchIndex.value)
  haptic.light()
}

const scrollToSearchResult = (index: number) => {
  const result = searchResults.value[index]
  if (!result || !textContainer.value) return
  
  const lineHeight = fontSize.value * 1.5 // Approximate line height
  const targetY = (result.line - 1) * lineHeight
  
  textContainer.value.scrollTo({
    top: targetY - textContainer.value.clientHeight / 2,
    behavior: 'smooth'
  })
}

// Go to line methods
const openGoToLine = async () => {
  showGoToLine.value = true
  await nextTick()
  goToLineInput.value?.focus()
  goToLineInput.value?.select()
}

const closeGoToLine = () => {
  showGoToLine.value = false
  goToLineNumber.value = 1
}

const goToLine = () => {
  const lineNumber = Math.max(1, Math.min(totalLines.value, goToLineNumber.value))
  
  if (textContainer.value) {
    const lineHeight = fontSize.value * 1.5
    const targetY = (lineNumber - 1) * lineHeight
    
    textContainer.value.scrollTo({
      top: targetY - textContainer.value.clientHeight / 2,
      behavior: 'smooth'
    })
  }
  
  closeGoToLine()
  haptic.light()
}

// Watchers
watch(searchQuery, () => {
  performSearch()
})

watch(caseSensitive, () => {
  performSearch()
})

// Lifecycle
onMounted(() => {
  // Load user preferences
  const savedFontSize = localStorage.getItem('mobile-text-preview-font-size')
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize, 10)
  }
  
  const savedFontFamily = localStorage.getItem('mobile-text-preview-font-family')
  if (savedFontFamily && ['mono', 'sans', 'serif'].includes(savedFontFamily)) {
    fontFamily.value = savedFontFamily as 'mono' | 'sans' | 'serif'
  }
  
  const savedLineNumbers = localStorage.getItem('mobile-text-preview-line-numbers')
  if (savedLineNumbers) {
    showLineNumbers.value = savedLineNumbers === 'true'
  }
  
  const savedWordWrap = localStorage.getItem('mobile-text-preview-word-wrap')
  if (savedWordWrap) {
    wordWrap.value = savedWordWrap === 'true'
  }
})

// Save preferences
watch(fontSize, (newSize) => {
  localStorage.setItem('mobile-text-preview-font-size', newSize.toString())
})

watch(fontFamily, (newFamily) => {
  localStorage.setItem('mobile-text-preview-font-family', newFamily)
})

watch(showLineNumbers, (show) => {
  localStorage.setItem('mobile-text-preview-line-numbers', show.toString())
})

watch(wordWrap, (wrap) => {
  localStorage.setItem('mobile-text-preview-word-wrap', wrap.toString())
})
</script>

<style scoped>
.mobile-text-preview {
  /* Safe area support */
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}

.text-container {
  /* Smooth scrolling */
  scroll-behavior: smooth;
  
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
}

.text-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.text-container::-webkit-scrollbar-track {
  background: transparent;
}

.text-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.text-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

/* Dark mode scrollbar */
.dark .text-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

.dark .text-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.line-numbers {
  min-width: 3rem;
}

.line-number {
  padding: 0.125rem 0;
}

.line-number.highlighted {
  background-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.text-block {
  margin: 0;
  padding: 0;
  background: transparent;
  color: inherit;
}

.text-block.word-wrap {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Search highlighting */
:deep(.search-highlight) {
  background-color: rgba(251, 191, 36, 0.3);
  border-radius: 2px;
  padding: 1px 2px;
}

:deep(.search-highlight.current) {
  background-color: rgba(251, 191, 36, 0.6);
  box-shadow: 0 0 0 1px #fbbf24;
}

/* Controls positioning */
.text-controls {
  top: max(1rem, env(safe-area-inset-top));
  right: max(1rem, env(safe-area-inset-right));
}

.file-info {
  top: max(1rem, env(safe-area-inset-top));
  left: max(1rem, env(safe-area-inset-left));
}

.search-bar {
  bottom: max(1rem, env(safe-area-inset-bottom));
  left: max(1rem, env(safe-area-inset-left));
  right: max(1rem, env(safe-area-inset-right));
}

.search-toggle {
  bottom: max(1rem, env(safe-area-inset-bottom));
  right: max(1rem, env(safe-area-inset-right));
}

.goto-line-toggle {
  bottom: max(4rem, env(safe-area-inset-bottom) + 3rem);
  right: max(1rem, env(safe-area-inset-right));
}

.goto-line {
  /* Center positioning */
  z-index: 50;
}
</style>