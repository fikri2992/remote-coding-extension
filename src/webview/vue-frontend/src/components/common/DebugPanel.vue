<template>
  <div v-if="isVisible" class="debug-panel">
    <div class="debug-header">
      <h3 class="debug-title">Debug Panel</h3>
      <div class="debug-controls">
        <button @click="toggleMinimized" class="debug-btn">
          {{ isMinimized ? '▲' : '▼' }}
        </button>
        <button @click="close" class="debug-btn">✕</button>
      </div>
    </div>
    
    <div v-if="!isMinimized" class="debug-content">
      <!-- Tabs -->
      <div class="debug-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="debug-tab"
          :class="{ active: activeTab === tab.id }"
        >
          {{ tab.label }}
          <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
        </button>
      </div>
      
      <!-- Error Reports Tab -->
      <div v-if="activeTab === 'errors'" class="debug-tab-content">
        <div class="debug-section-header">
          <h4>Error Reports ({{ errorReports.length }})</h4>
          <button @click="clearErrors" class="debug-btn-sm">Clear</button>
        </div>
        
        <div v-if="errorReports.length === 0" class="debug-empty">
          No errors reported
        </div>
        
        <div v-else class="debug-list">
          <div
            v-for="error in errorReports.slice(-10)"
            :key="error.id"
            class="debug-item error-item"
            :class="`severity-${error.severity}`"
          >
            <div class="error-summary">
              <span class="error-category">{{ error.category }}</span>
              <span class="error-message">{{ error.error.message }}</span>
              <span class="error-time">{{ formatTime(error.context.timestamp) }}</span>
            </div>
            <details class="error-details">
              <summary>Details</summary>
              <pre class="error-stack">{{ error.error.stack }}</pre>
            </details>
          </div>
        </div>
      </div>
      
      <!-- Breadcrumbs Tab -->
      <div v-if="activeTab === 'breadcrumbs'" class="debug-tab-content">
        <div class="debug-section-header">
          <h4>Breadcrumbs ({{ breadcrumbs.length }})</h4>
          <button @click="clearBreadcrumbs" class="debug-btn-sm">Clear</button>
        </div>
        
        <div v-if="breadcrumbs.length === 0" class="debug-empty">
          No breadcrumbs recorded
        </div>
        
        <div v-else class="debug-list">
          <div
            v-for="breadcrumb in breadcrumbs.slice(-20)"
            :key="`${breadcrumb.timestamp}-${breadcrumb.message}`"
            class="debug-item breadcrumb-item"
            :class="`level-${breadcrumb.level}`"
          >
            <div class="breadcrumb-content">
              <span class="breadcrumb-category">{{ breadcrumb.category }}</span>
              <span class="breadcrumb-message">{{ breadcrumb.message }}</span>
              <span class="breadcrumb-time">{{ formatTime(breadcrumb.timestamp) }}</span>
            </div>
            <div v-if="breadcrumb.data" class="breadcrumb-data">
              <pre>{{ JSON.stringify(breadcrumb.data, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Performance Tab -->
      <div v-if="activeTab === 'performance'" class="debug-tab-content">
        <div class="debug-section-header">
          <h4>Performance Metrics</h4>
          <button @click="clearPerformance" class="debug-btn-sm">Clear</button>
        </div>
        
        <div class="debug-stats">
          <div class="stat-item">
            <span class="stat-label">Total Metrics:</span>
            <span class="stat-value">{{ debugStats.performanceMetrics }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Network Requests:</span>
            <span class="stat-value">{{ debugStats.totalRequests }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Failed Requests:</span>
            <span class="stat-value">{{ debugStats.failedRequests }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Response Time:</span>
            <span class="stat-value">{{ debugStats.averageResponseTime.toFixed(2) }}ms</span>
          </div>
        </div>
        
        <div v-if="performanceMetrics.length === 0" class="debug-empty">
          No performance metrics recorded
        </div>
        
        <div v-else class="debug-list">
          <div
            v-for="metric in performanceMetrics.slice(-10)"
            :key="`${metric.name}-${metric.startTime}`"
            class="debug-item performance-item"
          >
            <div class="performance-content">
              <span class="performance-name">{{ metric.name }}</span>
              <span class="performance-duration">
                {{ metric.duration ? `${metric.duration.toFixed(2)}ms` : 'Running...' }}
              </span>
            </div>
            <div v-if="metric.metadata" class="performance-metadata">
              <pre>{{ JSON.stringify(metric.metadata, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Network Tab -->
      <div v-if="activeTab === 'network'" class="debug-tab-content">
        <div class="debug-section-header">
          <h4>Network Logs</h4>
          <button @click="clearNetwork" class="debug-btn-sm">Clear</button>
        </div>
        
        <div v-if="networkLogs.length === 0" class="debug-empty">
          No network requests logged
        </div>
        
        <div v-else class="debug-list">
          <div
            v-for="log in networkLogs.slice(-10)"
            :key="log.id"
            class="debug-item network-item"
            :class="{ 'network-error': log.error || (log.status && log.status >= 400) }"
          >
            <div class="network-content">
              <span class="network-method">{{ log.method }}</span>
              <span class="network-url">{{ log.url }}</span>
              <span class="network-status" :class="getStatusClass(log.status)">
                {{ log.status || 'Pending' }}
              </span>
              <span class="network-duration">
                {{ log.duration ? `${log.duration.toFixed(2)}ms` : 'Pending...' }}
              </span>
            </div>
            <div v-if="log.error" class="network-error-msg">
              {{ log.error.message }}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="debug-actions">
        <button @click="exportDebugData" class="debug-btn-primary">
          Export Debug Data
        </button>
        <button @click="clearAllData" class="debug-btn-secondary">
          Clear All Data
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { errorHandler } from '../../services/error-handler'
import { debugService } from '../../services/debug'

const isVisible = ref(false)
const isMinimized = ref(false)
const activeTab = ref('errors')

const errorReports = computed(() => errorHandler.getErrorReports())
const breadcrumbs = computed(() => errorHandler.getBreadcrumbs())
const performanceMetrics = computed(() => debugService.getPerformanceMetrics())
const networkLogs = computed(() => debugService.getNetworkLogs())
const debugStats = computed(() => debugService.stats)

const tabs = computed(() => [
  { id: 'errors', label: 'Errors', count: errorReports.value.length },
  { id: 'breadcrumbs', label: 'Breadcrumbs', count: breadcrumbs.value.length },
  { id: 'performance', label: 'Performance', count: performanceMetrics.value.length },
  { id: 'network', label: 'Network', count: networkLogs.value.length }
])

// Keyboard shortcut to toggle debug panel
const handleKeydown = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.shiftKey && event.key === 'D') {
    event.preventDefault()
    toggle()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  
  // Show debug panel automatically if there are critical errors
  const checkCriticalErrors = () => {
    const criticalErrors = errorReports.value.filter(e => e.severity === 'critical')
    if (criticalErrors.length > 0 && !isVisible.value) {
      isVisible.value = true
      activeTab.value = 'errors'
    }
  }
  
  // Check every 5 seconds
  const interval = setInterval(checkCriticalErrors, 5000)
  
  onUnmounted(() => {
    clearInterval(interval)
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

const toggle = () => {
  isVisible.value = !isVisible.value
}

const toggleMinimized = () => {
  isMinimized.value = !isMinimized.value
}

const close = () => {
  isVisible.value = false
}

const clearErrors = () => {
  errorHandler.clearErrorReports()
}

const clearBreadcrumbs = () => {
  errorHandler.clearBreadcrumbs()
}

const clearPerformance = () => {
  debugService.clearAllLogs()
}

const clearNetwork = () => {
  debugService.clearAllLogs()
}

const clearAllData = () => {
  errorHandler.clearErrorReports()
  errorHandler.clearBreadcrumbs()
  debugService.clearAllLogs()
}

const exportDebugData = () => {
  const debugData = debugService.exportDebugData()
  const blob = new Blob([debugData], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `debug-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const formatTime = (timestamp: Date) => {
  return timestamp.toLocaleTimeString()
}

const getStatusClass = (status?: number) => {
  if (!status) return ''
  if (status >= 200 && status < 300) return 'status-success'
  if (status >= 400 && status < 500) return 'status-client-error'
  if (status >= 500) return 'status-server-error'
  return ''
}

// Expose toggle method for external use
defineExpose({
  toggle,
  show: () => { isVisible.value = true },
  hide: () => { isVisible.value = false }
})
</script>

<style scoped>
.debug-panel {
  @apply fixed bottom-4 right-4 w-96 max-h-96 bg-white border border-gray-300 rounded-lg shadow-lg z-50 font-mono text-xs;
}

.debug-header {
  @apply flex items-center justify-between p-3 bg-gray-100 border-b border-gray-300 rounded-t-lg;
}

.debug-title {
  @apply font-semibold text-gray-800;
}

.debug-controls {
  @apply flex gap-1;
}

.debug-btn {
  @apply px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded;
}

.debug-content {
  @apply flex flex-col h-80;
}

.debug-tabs {
  @apply flex border-b border-gray-200;
}

.debug-tab {
  @apply px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-b-2 border-transparent flex items-center gap-1;
}

.debug-tab.active {
  @apply text-blue-600 border-blue-600 bg-blue-50;
}

.tab-count {
  @apply bg-gray-200 text-gray-600 px-1 rounded-full text-xs;
}

.debug-tab.active .tab-count {
  @apply bg-blue-200 text-blue-800;
}

.debug-tab-content {
  @apply flex-1 overflow-auto p-3;
}

.debug-section-header {
  @apply flex items-center justify-between mb-3;
}

.debug-section-header h4 {
  @apply font-semibold text-gray-800;
}

.debug-btn-sm {
  @apply px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded;
}

.debug-empty {
  @apply text-gray-500 text-center py-4;
}

.debug-list {
  @apply space-y-2;
}

.debug-item {
  @apply p-2 bg-gray-50 rounded border-l-2;
}

.error-item {
  @apply border-l-red-400;
}

.error-item.severity-critical {
  @apply border-l-red-600 bg-red-50;
}

.error-item.severity-high {
  @apply border-l-red-500;
}

.error-item.severity-medium {
  @apply border-l-orange-400;
}

.error-item.severity-low {
  @apply border-l-yellow-400;
}

.error-summary {
  @apply flex items-center gap-2 text-xs;
}

.error-category {
  @apply bg-gray-200 px-1 rounded text-gray-700;
}

.error-message {
  @apply flex-1 truncate;
}

.error-time {
  @apply text-gray-500;
}

.error-details {
  @apply mt-1;
}

.error-stack {
  @apply text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-20;
}

.breadcrumb-item {
  @apply border-l-blue-400;
}

.breadcrumb-item.level-error {
  @apply border-l-red-400;
}

.breadcrumb-item.level-warning {
  @apply border-l-yellow-400;
}

.breadcrumb-content {
  @apply flex items-center gap-2 text-xs;
}

.breadcrumb-category {
  @apply bg-blue-100 px-1 rounded text-blue-700;
}

.breadcrumb-message {
  @apply flex-1;
}

.breadcrumb-time {
  @apply text-gray-500;
}

.breadcrumb-data {
  @apply mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-16;
}

.performance-item {
  @apply border-l-green-400;
}

.performance-content {
  @apply flex items-center justify-between text-xs;
}

.performance-name {
  @apply font-medium;
}

.performance-duration {
  @apply text-green-600;
}

.performance-metadata {
  @apply mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-16;
}

.network-item {
  @apply border-l-purple-400;
}

.network-item.network-error {
  @apply border-l-red-400 bg-red-50;
}

.network-content {
  @apply flex items-center gap-2 text-xs;
}

.network-method {
  @apply bg-purple-100 px-1 rounded text-purple-700 font-medium;
}

.network-url {
  @apply flex-1 truncate;
}

.network-status {
  @apply px-1 rounded;
}

.status-success {
  @apply bg-green-100 text-green-700;
}

.status-client-error {
  @apply bg-yellow-100 text-yellow-700;
}

.status-server-error {
  @apply bg-red-100 text-red-700;
}

.network-duration {
  @apply text-gray-500;
}

.network-error-msg {
  @apply mt-1 text-xs text-red-600;
}

.debug-stats {
  @apply grid grid-cols-2 gap-2 mb-3;
}

.stat-item {
  @apply flex justify-between p-2 bg-gray-100 rounded;
}

.stat-label {
  @apply text-gray-600;
}

.stat-value {
  @apply font-semibold text-gray-800;
}

.debug-actions {
  @apply flex gap-2 p-3 border-t border-gray-200;
}

.debug-btn-primary {
  @apply flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700;
}

.debug-btn-secondary {
  @apply flex-1 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700;
}
</style>