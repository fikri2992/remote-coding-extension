<template>
  <div class="performance-debug-panel bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        Virtual Scroll Performance
      </h3>
      <div class="flex gap-2">
        <button
          @click="refreshMetrics"
          class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
        <button
          @click="exportMetrics"
          class="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
        >
          Export
        </button>
        <button
          @click="resetMetrics"
          class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
        >
          Reset
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
      <!-- Current Metrics -->
      <div class="metric-card">
        <h4 class="metric-title">Current Performance</h4>
        <div class="metric-grid">
          <div class="metric-item">
            <span class="metric-label">Scroll Events/sec:</span>
            <span class="metric-value">{{ currentMetrics.scrollEvents }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Render Time:</span>
            <span class="metric-value">{{ currentMetrics.renderTime.toFixed(2) }}ms</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Memory Usage:</span>
            <span class="metric-value">{{ currentMetrics.memoryUsage.toFixed(2) }}MB</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Cache Hit Rate:</span>
            <span class="metric-value">{{ (currentMetrics.cacheHitRate * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- Item Counts -->
      <div class="metric-card">
        <h4 class="metric-title">Item Statistics</h4>
        <div class="metric-grid">
          <div class="metric-item">
            <span class="metric-label">Visible Items:</span>
            <span class="metric-value">{{ currentMetrics.visibleItems }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Total Items:</span>
            <span class="metric-value">{{ currentMetrics.totalItems }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Render Ratio:</span>
            <span class="metric-value">{{ renderRatio }}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Last Update:</span>
            <span class="metric-value">{{ lastUpdateTime }}</span>
          </div>
        </div>
      </div>

      <!-- Performance Status -->
      <div class="metric-card">
        <h4 class="metric-title">Performance Status</h4>
        <div class="performance-status" :class="statusClass">
          <div class="status-indicator" :class="statusClass"></div>
          <span class="status-text">{{ performanceStatus }}</span>
        </div>
        <div class="mt-2">
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Issues:
          </div>
          <ul class="text-sm text-red-600 dark:text-red-400 mt-1">
            <li v-for="issue in performanceIssues" :key="issue">• {{ issue }}</li>
            <li v-if="performanceIssues.length === 0" class="text-green-600 dark:text-green-400">
              • No issues detected
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Average Metrics -->
    <div class="mb-4">
      <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">
        Average Metrics (Last 10 samples)
      </h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="metric-item">
          <span class="metric-label">Avg Scroll Events:</span>
          <span class="metric-value">{{ averageMetrics.scrollEvents || 0 }}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Avg Render Time:</span>
          <span class="metric-value">{{ averageMetrics.renderTime || 0 }}ms</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Avg Memory:</span>
          <span class="metric-value">{{ averageMetrics.memoryUsage || 0 }}MB</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Avg Cache Hit:</span>
          <span class="metric-value">{{ ((averageMetrics.cacheHitRate || 0) * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <!-- Device Information -->
    <div class="mb-4">
      <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">
        Device Information
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="device-info">
          <div class="info-item">
            <span class="info-label">Hardware Concurrency:</span>
            <span class="info-value">{{ deviceInfo.hardwareConcurrency }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Memory Limit:</span>
            <span class="info-value">{{ deviceInfo.memoryLimit }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Device Type:</span>
            <span class="info-value">{{ deviceInfo.deviceType }}</span>
          </div>
        </div>
        <div class="device-info">
          <div class="info-item">
            <span class="info-label">Low Memory Device:</span>
            <span class="info-value" :class="deviceInfo.isLowMemory ? 'text-red-600' : 'text-green-600'">
              {{ deviceInfo.isLowMemory ? 'Yes' : 'No' }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Slow Device:</span>
            <span class="info-value" :class="deviceInfo.isSlow ? 'text-red-600' : 'text-green-600'">
              {{ deviceInfo.isSlow ? 'Yes' : 'No' }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Recommended Settings:</span>
            <button
              @click="applyRecommendedSettings"
              class="text-sm px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Chart (Simple) -->
    <div v-if="chartData.length > 0">
      <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">
        Performance Trend (Last 20 samples)
      </h4>
      <div class="performance-chart">
        <div class="chart-container">
          <div
            v-for="(sample, index) in chartData"
            :key="index"
            class="chart-bar"
            :style="{
              height: `${(sample.renderTime / maxRenderTime) * 100}%`,
              backgroundColor: sample.renderTime > 16 ? '#ef4444' : '#10b981'
            }"
            :title="`Sample ${index + 1}: ${sample.renderTime.toFixed(2)}ms`"
          ></div>
        </div>
        <div class="chart-labels">
          <span class="text-xs text-gray-500">Render Time (ms)</span>
          <span class="text-xs text-gray-500">Target: 16ms</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { virtualScrollPerformanceMonitor, mobileOptimizations } from '../../utils/virtual-scroll-performance'

// State
const currentMetrics = ref({
  scrollEvents: 0,
  renderTime: 0,
  memoryUsage: 0,
  cacheHitRate: 0,
  visibleItems: 0,
  totalItems: 0,
  lastUpdate: Date.now()
})

const averageMetrics = ref<any>({})
const chartData = ref<any[]>([])
const updateInterval = ref<number>()

// Computed
const renderRatio = computed(() => {
  if (currentMetrics.value.totalItems === 0) return 0
  return Math.round((currentMetrics.value.visibleItems / currentMetrics.value.totalItems) * 100)
})

const lastUpdateTime = computed(() => {
  const date = new Date(currentMetrics.value.lastUpdate)
  return date.toLocaleTimeString()
})

const performanceStatus = computed(() => {
  const issues = performanceIssues.value
  if (issues.length === 0) return '✅ Good'
  if (issues.length <= 2) return '⚠️ Fair'
  return '❌ Poor'
})

const statusClass = computed(() => {
  const issues = performanceIssues.value
  if (issues.length === 0) return 'status-good'
  if (issues.length <= 2) return 'status-fair'
  return 'status-poor'
})

const performanceIssues = computed(() => {
  const issues: string[] = []
  const metrics = currentMetrics.value
  
  if (metrics.renderTime > 16) {
    issues.push('High render time (>16ms)')
  }
  
  if (metrics.memoryUsage > 100) {
    issues.push('High memory usage (>100MB)')
  }
  
  if (metrics.cacheHitRate < 0.8) {
    issues.push('Low cache hit rate (<80%)')
  }
  
  if (metrics.scrollEvents > 60) {
    issues.push('High scroll event frequency (>60/sec)')
  }
  
  return issues
})

const deviceInfo = computed(() => {
  const hardwareConcurrency = navigator.hardwareConcurrency || 'Unknown'
  let memoryLimit = 'Unknown'
  
  if ('memory' in performance) {
    const memory = (performance as any).memory
    memoryLimit = `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`
  }
  
  const isLowMemory = mobileOptimizations.isLowMemoryDevice()
  const isSlow = mobileOptimizations.isSlowDevice()
  
  let deviceType = 'Desktop'
  if (navigator.userAgent.includes('Mobile')) {
    deviceType = 'Mobile'
  } else if (navigator.userAgent.includes('Tablet')) {
    deviceType = 'Tablet'
  }
  
  return {
    hardwareConcurrency,
    memoryLimit,
    deviceType,
    isLowMemory,
    isSlow
  }
})

const maxRenderTime = computed(() => {
  if (chartData.value.length === 0) return 16
  return Math.max(16, Math.max(...chartData.value.map(d => d.renderTime)))
})

// Methods
const refreshMetrics = () => {
  currentMetrics.value = virtualScrollPerformanceMonitor.getMetrics()
  averageMetrics.value = virtualScrollPerformanceMonitor.getAverageMetrics()
  
  // Update chart data
  const samples = virtualScrollPerformanceMonitor.getSamples()
  chartData.value = samples.slice(-20) // Last 20 samples
}

const exportMetrics = () => {
  const data = virtualScrollPerformanceMonitor.exportMetrics()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `virtual-scroll-metrics-${new Date().toISOString().slice(0, 19)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  URL.revokeObjectURL(url)
}

const resetMetrics = () => {
  virtualScrollPerformanceMonitor.reset()
  refreshMetrics()
}

const applyRecommendedSettings = () => {
  const settings = mobileOptimizations.getRecommendedSettings()
  console.log('Recommended settings:', settings)
  
  // In a real implementation, you would emit an event or call a method
  // to apply these settings to the virtual scroll component
  alert(`Recommended settings:\n${JSON.stringify(settings, null, 2)}`)
}

// Lifecycle
onMounted(() => {
  refreshMetrics()
  
  // Update metrics every second
  updateInterval.value = window.setInterval(() => {
    refreshMetrics()
  }, 1000)
})

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value)
  }
})
</script>

<style scoped>
.performance-debug-panel {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.metric-card {
  @apply bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3;
}

.metric-title {
  @apply text-sm font-medium text-gray-900 dark:text-white mb-2;
}

.metric-grid {
  @apply space-y-1;
}

.metric-item {
  @apply flex justify-between items-center;
}

.metric-label {
  @apply text-xs text-gray-600 dark:text-gray-400;
}

.metric-value {
  @apply text-xs font-mono text-gray-900 dark:text-white;
}

.performance-status {
  @apply flex items-center gap-2 p-2 rounded;
}

.status-indicator {
  @apply w-3 h-3 rounded-full;
}

.status-good .status-indicator {
  @apply bg-green-500;
}

.status-fair .status-indicator {
  @apply bg-yellow-500;
}

.status-poor .status-indicator {
  @apply bg-red-500;
}

.status-text {
  @apply text-sm font-medium;
}

.device-info {
  @apply bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3;
}

.info-item {
  @apply flex justify-between items-center mb-1;
}

.info-label {
  @apply text-xs text-gray-600 dark:text-gray-400;
}

.info-value {
  @apply text-xs font-mono text-gray-900 dark:text-white;
}

.performance-chart {
  @apply bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3;
}

.chart-container {
  @apply flex items-end gap-1 h-20 mb-2;
}

.chart-bar {
  @apply flex-1 min-w-0 rounded-t transition-all duration-200;
  min-height: 2px;
}

.chart-labels {
  @apply flex justify-between;
}
</style>