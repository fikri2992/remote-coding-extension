<template>
  <div class="mobile-code-preview relative w-full h-full bg-gray-900 text-white overflow-hidden">
    <!-- Code Container -->
    <div
      ref="codeContainer"
      class="code-container absolute inset-0 overflow-auto"
      :style="containerStyle"
    >
      <div class="code-content p-4">
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
          
          <div class="code-lines flex-1 font-mono text-sm leading-relaxed">
            <pre
              class="code-block whitespace-pre-wrap break-words"
              :class="themeClass"
            ><code
              :class="languageClass"
              v-html="highlightedCode"
            ></code></pre>
          </div>
        </div>
        
        <!-- Code without line numbers -->
        <div v-else class="code-lines">
          <pre
            class="code-block whitespace-pre-wrap break-words font-mono text-sm leading-relaxed"
            :class="themeClass"
          ><code
            :class="languageClass"
            v-html="highlightedCode"
          ></code></pre>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="code-controls absolute top-4 right-4 flex flex-col space-y-2 bg-black bg-opacity-60 rounded-lg p-2">
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
      
      <!-- Theme Toggle -->
      <button
        @click="toggleTheme"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded"
        aria-label="Toggle theme"
      >
        <svg v-if="theme === 'dark'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
    </div>

    <!-- Language Info -->
    <div
      v-if="language"
      class="language-info absolute top-4 left-4 bg-black bg-opacity-60 text-white text-sm rounded-lg px-3 py-2"
    >
      {{ language.toUpperCase() }}
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
          placeholder="Search in code..."
          class="flex-1 bg-gray-800 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          @keydown.enter="findNext"
          @keydown.escape="closeSearch"
        />
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
      aria-label="Search in code"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useHapticFeedback } from '../../composables/useHapticFeedback'

interface Props {
  filePath?: string | null
  fileContent?: string | null
  language?: string | null
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Composables
const haptic = useHapticFeedback()

// Refs
const codeContainer = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

// State
const fontSize = ref(14)
const minFontSize = 10
const maxFontSize = 24
const showLineNumbers = ref(true)
const wordWrap = ref(false)
const theme = ref<'light' | 'dark'>('dark')
const showSearch = ref(false)
const searchQuery = ref('')
const searchResults = ref<{ line: number; start: number; end: number }[]>([])
const currentSearchIndex = ref(0)
const highlightedLines = ref<Set<number>>(new Set())

// Computed
const containerStyle = computed(() => ({
  fontSize: `${fontSize.value}px`
}))

const themeClass = computed(() => ({
  'theme-light': theme.value === 'light',
  'theme-dark': theme.value === 'dark'
}))

const languageClass = computed(() => {
  if (!props.language) return ''
  return `language-${props.language}`
})

const totalLines = computed(() => {
  if (!props.fileContent) return 0
  return props.fileContent.split('\n').length
})

const highlightedCode = computed(() => {
  if (!props.fileContent) return ''
  
  let content = props.fileContent
  
  // Apply basic syntax highlighting
  content = applySyntaxHighlighting(content, props.language || '')
  
  // Apply search highlighting
  if (searchQuery.value && searchResults.value.length > 0) {
    content = applySearchHighlighting(content)
  }
  
  return content
})

// Methods
const applySyntaxHighlighting = (code: string, language: string): string => {
  // Basic syntax highlighting implementation
  // In a real implementation, you'd use a library like Prism.js or highlight.js
  
  let highlighted = escapeHtml(code)
  
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'typescript':
    case 'ts':
      highlighted = highlightJavaScript(highlighted)
      break
    case 'json':
      highlighted = highlightJSON(highlighted)
      break
    case 'html':
      highlighted = highlightHTML(highlighted)
      break
    case 'css':
      highlighted = highlightCSS(highlighted)
      break
    case 'python':
    case 'py':
      highlighted = highlightPython(highlighted)
      break
    default:
      highlighted = highlightGeneric(highlighted)
  }
  
  return highlighted
}

const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const highlightJavaScript = (code: string): string => {
  // Keywords
  code = code.replace(
    /\b(const|let|var|function|class|if|else|for|while|do|switch|case|default|try|catch|finally|return|break|continue|import|export|from|as|async|await|yield|new|this|super|extends|implements|interface|type|enum|namespace|module|declare|public|private|protected|static|readonly|abstract)\b/g,
    '<span class="keyword">$1</span>'
  )
  
  // Strings
  code = code.replace(
    /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g,
    '<span class="string">$1$2$1</span>'
  )
  
  // Comments
  code = code.replace(
    /\/\/.*$/gm,
    '<span class="comment">$&</span>'
  )
  code = code.replace(
    /\/\*[\s\S]*?\*\//g,
    '<span class="comment">$&</span>'
  )
  
  // Numbers
  code = code.replace(
    /\b\d+(\.\d+)?\b/g,
    '<span class="number">$&</span>'
  )
  
  return code
}

const highlightJSON = (code: string): string => {
  // Strings (keys and values)
  code = code.replace(
    /"([^"\\]|\\.)*"/g,
    '<span class="string">$&</span>'
  )
  
  // Numbers
  code = code.replace(
    /\b-?\d+(\.\d+)?([eE][+-]?\d+)?\b/g,
    '<span class="number">$&</span>'
  )
  
  // Booleans and null
  code = code.replace(
    /\b(true|false|null)\b/g,
    '<span class="keyword">$1</span>'
  )
  
  return code
}

const highlightHTML = (code: string): string => {
  // Tags
  code = code.replace(
    /(&lt;\/?)([\w-]+)([^&]*?)(&gt;)/g,
    '<span class="tag">$1</span><span class="tag-name">$2</span><span class="attribute">$3</span><span class="tag">$4</span>'
  )
  
  // Attributes
  code = code.replace(
    /(\w+)(=)("([^"]*)")/g,
    '<span class="attribute-name">$1</span><span class="operator">$2</span><span class="string">$3</span>'
  )
  
  return code
}

const highlightCSS = (code: string): string => {
  // Selectors
  code = code.replace(
    /^([^{]+)(?=\s*{)/gm,
    '<span class="selector">$1</span>'
  )
  
  // Properties
  code = code.replace(
    /(\w+)(\s*:)/g,
    '<span class="property">$1</span><span class="operator">$2</span>'
  )
  
  // Values
  code = code.replace(
    /(:\s*)([^;]+)(;)/g,
    '$1<span class="value">$2</span><span class="operator">$3</span>'
  )
  
  return code
}

const highlightPython = (code: string): string => {
  // Keywords
  code = code.replace(
    /\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|break|continue|pass|lambda|and|or|not|in|is|True|False|None)\b/g,
    '<span class="keyword">$1</span>'
  )
  
  // Strings
  code = code.replace(
    /(["'])((?:\\.|(?!\1)[^\\])*?)\1/g,
    '<span class="string">$1$2$1</span>'
  )
  
  // Comments
  code = code.replace(
    /#.*$/gm,
    '<span class="comment">$&</span>'
  )
  
  return code
}

const highlightGeneric = (code: string): string => {
  // Basic highlighting for unknown languages
  
  // Strings
  code = code.replace(
    /(["'])((?:\\.|(?!\1)[^\\])*?)\1/g,
    '<span class="string">$1$2$1</span>'
  )
  
  // Numbers
  code = code.replace(
    /\b\d+(\.\d+)?\b/g,
    '<span class="number">$&</span>'
  )
  
  return code
}

const applySearchHighlighting = (code: string): string => {
  if (!searchQuery.value) return code
  
  const regex = new RegExp(escapeRegExp(searchQuery.value), 'gi')
  let matchIndex = 0
  
  return code.replace(regex, (match) => {
    const isCurrentMatch = matchIndex === currentSearchIndex.value
    matchIndex++
    return `<span class="search-highlight ${isCurrentMatch ? 'current' : ''}">${match}</span>`
  })
}

const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
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

const performSearch = () => {
  if (!searchQuery.value || !props.fileContent) {
    searchResults.value = []
    highlightedLines.value.clear()
    return
  }
  
  const lines = props.fileContent.split('\n')
  const results: { line: number; start: number; end: number }[] = []
  const highlightedLineNumbers = new Set<number>()
  
  const regex = new RegExp(escapeRegExp(searchQuery.value), 'gi')
  
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
  if (!result || !codeContainer.value) return
  
  const lineHeight = fontSize.value * 1.5 // Approximate line height
  const targetY = (result.line - 1) * lineHeight
  
  codeContainer.value.scrollTo({
    top: targetY - codeContainer.value.clientHeight / 2,
    behavior: 'smooth'
  })
}

// Watchers
watch(searchQuery, () => {
  performSearch()
})

// Lifecycle
onMounted(() => {
  // Load user preferences
  const savedFontSize = localStorage.getItem('mobile-code-preview-font-size')
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize, 10)
  }
  
  const savedTheme = localStorage.getItem('mobile-code-preview-theme')
  if (savedTheme) {
    theme.value = savedTheme as 'light' | 'dark'
  }
  
  const savedLineNumbers = localStorage.getItem('mobile-code-preview-line-numbers')
  if (savedLineNumbers) {
    showLineNumbers.value = savedLineNumbers === 'true'
  }
})

// Save preferences
watch(fontSize, (newSize) => {
  localStorage.setItem('mobile-code-preview-font-size', newSize.toString())
})

watch(theme, (newTheme) => {
  localStorage.setItem('mobile-code-preview-theme', newTheme)
})

watch(showLineNumbers, (show) => {
  localStorage.setItem('mobile-code-preview-line-numbers', show.toString())
})
</script>

<style scoped>
.mobile-code-preview {
  /* Safe area support */
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}

.code-container {
  /* Smooth scrolling */
  scroll-behavior: smooth;
  
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.code-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.code-container::-webkit-scrollbar-track {
  background: transparent;
}

.code-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.code-container::-webkit-scrollbar-thumb:hover {
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

.code-block {
  margin: 0;
  padding: 0;
  background: transparent;
  color: inherit;
}

/* Theme styles */
.theme-light {
  background-color: #ffffff;
  color: #1f2937;
}

.theme-dark {
  background-color: #111827;
  color: #f9fafb;
}

/* Syntax highlighting styles */
:deep(.keyword) {
  color: #8b5cf6;
  font-weight: 600;
}

:deep(.string) {
  color: #10b981;
}

:deep(.comment) {
  color: #6b7280;
  font-style: italic;
}

:deep(.number) {
  color: #f59e0b;
}

:deep(.tag) {
  color: #ef4444;
}

:deep(.tag-name) {
  color: #3b82f6;
  font-weight: 600;
}

:deep(.attribute) {
  color: #8b5cf6;
}

:deep(.attribute-name) {
  color: #f59e0b;
}

:deep(.operator) {
  color: #6b7280;
}

:deep(.selector) {
  color: #3b82f6;
  font-weight: 600;
}

:deep(.property) {
  color: #8b5cf6;
}

:deep(.value) {
  color: #10b981;
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

/* Light theme adjustments */
.theme-light :deep(.keyword) {
  color: #7c3aed;
}

.theme-light :deep(.string) {
  color: #059669;
}

.theme-light :deep(.comment) {
  color: #6b7280;
}

.theme-light :deep(.number) {
  color: #d97706;
}

.theme-light :deep(.tag) {
  color: #dc2626;
}

.theme-light :deep(.tag-name) {
  color: #2563eb;
}

.theme-light :deep(.attribute) {
  color: #7c3aed;
}

.theme-light :deep(.attribute-name) {
  color: #d97706;
}

.theme-light :deep(.selector) {
  color: #2563eb;
}

.theme-light :deep(.property) {
  color: #7c3aed;
}

.theme-light :deep(.value) {
  color: #059669;
}

/* Controls positioning */
.code-controls {
  top: max(1rem, env(safe-area-inset-top));
  right: max(1rem, env(safe-area-inset-right));
}

.language-info {
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
</style>