<template>
  <div class="mobile-websocket-demo">
    <div class="demo-header">
      <h3>Mobile WebSocket Integration Demo</h3>
      <div class="connection-status" :class="connectionStatusClass">
        {{ connectionStatus }}
      </div>
    </div>

    <div class="demo-content">
      <!-- Connection Info -->
      <div class="info-section">
        <h4>Connection Info</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Device Type:</span>
            <span class="value">{{ mobileState.isMobile ? 'Mobile' : 'Desktop' }}</span>
          </div>
          <div class="info-item">
            <span class="label">Connection Quality:</span>
            <span class="value" :class="`quality-${mobileState.connectionQuality}`">
              {{ mobileState.connectionQuality }}
            </span>
          </div>
          <div class="info-item" v-if="mobileState.bandwidth.downlink">
            <span class="label">Bandwidth:</span>
            <span class="value">{{ mobileState.bandwidth.downlink }} Mbps</span>
          </div>
          <div class="info-item" v-if="mobileState.bandwidth.rtt">
            <span class="label">RTT:</span>
            <span class="value">{{ mobileState.bandwidth.rtt }}ms</span>
          </div>
        </div>
      </div>

      <!-- Gesture Test Area -->
      <div class="gesture-section">
        <h4>Gesture Test Area</h4>
        <div 
          ref="gestureArea"
          class="gesture-area"
          data-file-path="/demo/test-file.txt"
        >
          <p>Try gestures here:</p>
          <ul>
            <li>Tap - Light haptic feedback</li>
            <li>Long press - Medium haptic feedback</li>
            <li>Swipe left/right - File actions</li>
            <li>Pinch - Zoom control</li>
            <li>Pull down - Refresh</li>
          </ul>
          
          <div class="gesture-feedback" v-if="lastGesture">
            Last gesture: {{ lastGesture.type }} 
            <span v-if="lastGesture.direction">({{ lastGesture.direction }})</span>
          </div>
        </div>
      </div>

      <!-- Layout Info -->
      <div class="layout-section">
        <h4>Layout State</h4>
        <div class="layout-info">
          <div class="layout-item">
            <span class="label">Breakpoint:</span>
            <span class="value">{{ layoutState.breakpoint }}</span>
          </div>
          <div class="layout-item">
            <span class="label">Orientation:</span>
            <span class="value">{{ layoutState.orientation }}</span>
          </div>
          <div class="layout-item">
            <span class="label">Viewport:</span>
            <span class="value">{{ layoutState.viewportSize.width }}x{{ layoutState.viewportSize.height }}</span>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls-section">
        <h4>Controls</h4>
        <div class="controls">
          <button 
            @click="toggleConnection" 
            :disabled="isConnecting"
            class="btn"
            :class="isConnected ? 'btn-danger' : 'btn-primary'"
          >
            {{ isConnecting ? 'Connecting...' : (isConnected ? 'Disconnect' : 'Connect') }}
          </button>
          
          <button 
            @click="toggleGestures" 
            class="btn btn-secondary"
            :disabled="!isConnected"
          >
            {{ gesturesEnabled ? 'Disable Gestures' : 'Enable Gestures' }}
          </button>
          
          <button 
            @click="sendTestMessage" 
            class="btn btn-info"
            :disabled="!isConnected"
          >
            Send Test Message
          </button>
          
          <button 
            @click="triggerHaptic" 
            class="btn btn-warning"
            :disabled="!isConnected"
          >
            Test Haptic
          </button>
        </div>
      </div>

      <!-- Message Log -->
      <div class="log-section">
        <h4>Message Log</h4>
        <div class="message-log">
          <div 
            v-for="(message, index) in messageLog" 
            :key="index"
            class="log-entry"
            :class="`log-${message.type}`"
          >
            <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
            <span class="message">{{ message.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMobileWebSocketIntegration } from '../../services/mobile-websocket-integration'
import type { GestureEvent } from '../../types/gestures'

// Component state
const gestureArea = ref<HTMLElement>()
const isConnecting = ref(false)
const gesturesEnabled = ref(true)
const lastGesture = ref<{ type: string; direction?: string } | null>(null)
const messageLog = ref<Array<{ type: string; message: string; timestamp: number }>>([])

// Layout state
const layoutState = reactive({
  breakpoint: 'desktop' as 'mobile' | 'tablet' | 'desktop',
  orientation: 'landscape' as 'portrait' | 'landscape',
  viewportSize: { width: window.innerWidth, height: window.innerHeight }
})

// Initialize mobile WebSocket integration
const mobileWebSocket = useMobileWebSocketIntegration({
  element: gestureArea,
  enableGestureReporting: true,
  enableLayoutSync: true,
  enableHapticFeedback: true,
  autoConnect: false
})

// Computed properties
const isConnected = computed(() => mobileWebSocket.webSocket.isConnected.value)
const connectionStatus = computed(() => {
  if (isConnecting.value) return 'Connecting...'
  return isConnected.value ? 'Connected' : 'Disconnected'
})

const connectionStatusClass = computed(() => ({
  'status-connected': isConnected.value,
  'status-connecting': isConnecting.value,
  'status-disconnected': !isConnected.value && !isConnecting.value
}))

const mobileState = computed(() => mobileWebSocket.mobileWebSocket.mobileState)

// Methods
const addLogEntry = (type: string, message: string) => {
  messageLog.value.unshift({
    type,
    message,
    timestamp: Date.now()
  })
  
  // Keep only last 50 entries
  if (messageLog.value.length > 50) {
    messageLog.value = messageLog.value.slice(0, 50)
  }
}

const toggleConnection = async () => {
  if (isConnected.value) {
    mobileWebSocket.disconnect()
    addLogEntry('info', 'Disconnected from WebSocket')
  } else {
    isConnecting.value = true
    try {
      await mobileWebSocket.connect('ws://localhost:8081')
      addLogEntry('success', 'Connected to WebSocket')
    } catch (error) {
      addLogEntry('error', `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      isConnecting.value = false
    }
  }
}

const toggleGestures = () => {
  if (gesturesEnabled.value) {
    mobileWebSocket.disableGestureIntegration()
    gesturesEnabled.value = false
    addLogEntry('info', 'Gestures disabled')
  } else {
    mobileWebSocket.enableGestureIntegration()
    gesturesEnabled.value = true
    addLogEntry('info', 'Gestures enabled')
  }
}

const sendTestMessage = async () => {
  try {
    await mobileWebSocket.reportFileAction('test', '/demo/test-file.txt', {
      source: 'demo',
      timestamp: Date.now()
    })
    addLogEntry('success', 'Test message sent')
  } catch (error) {
    addLogEntry('error', `Failed to send test message: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const triggerHaptic = async () => {
  try {
    await mobileWebSocket.mobileWebSocket.sendHapticFeedback('medium', 'demo_test')
    addLogEntry('info', 'Haptic feedback triggered')
  } catch (error) {
    addLogEntry('error', `Failed to trigger haptic: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString()
}

const updateLayoutState = () => {
  const width = window.innerWidth
  const height = window.innerHeight
  
  layoutState.viewportSize = { width, height }
  
  if (width < 768) {
    layoutState.breakpoint = 'mobile'
  } else if (width < 1024) {
    layoutState.breakpoint = 'tablet'
  } else {
    layoutState.breakpoint = 'desktop'
  }
  
  layoutState.orientation = width > height ? 'landscape' : 'portrait'
  
  // Sync with WebSocket
  if (isConnected.value) {
    mobileWebSocket.syncLayoutState(layoutState)
  }
}

// Set up gesture callbacks
const setupGestureCallbacks = () => {
  const gestures = mobileWebSocket.gestures
  
  // Override gesture callbacks to update UI
  const originalCallbacks = {
    onSwipe: gestures.getGestureState().activeGestures.has('swipe'),
    onPinch: gestures.getGestureState().activeGestures.has('pinch'),
    onTap: gestures.getGestureState().activeGestures.has('tap'),
    onLongPress: gestures.getGestureState().activeGestures.has('longpress'),
    onPullRefresh: gestures.getGestureState().activeGestures.has('pullrefresh')
  }
  
  // Add UI feedback for gestures
  const handleGestureUI = (event: GestureEvent) => {
    lastGesture.value = {
      type: event.type,
      direction: event.direction
    }
    
    addLogEntry('gesture', `${event.type} gesture detected${event.direction ? ` (${event.direction})` : ''}`)
    
    // Clear after 3 seconds
    setTimeout(() => {
      if (lastGesture.value?.type === event.type) {
        lastGesture.value = null
      }
    }, 3000)
  }
  
  // Note: In a real implementation, you would properly override the gesture callbacks
  // For this demo, we'll just log when gestures are detected
}

// Lifecycle
onMounted(async () => {
  await nextTick()
  
  // Set up layout monitoring
  updateLayoutState()
  window.addEventListener('resize', updateLayoutState)
  window.addEventListener('orientationchange', updateLayoutState)
  
  // Set up gesture callbacks
  setupGestureCallbacks()
  
  // Set up WebSocket event listeners
  mobileWebSocket.webSocket.onConnect(() => {
    addLogEntry('success', 'WebSocket connected')
  })
  
  mobileWebSocket.webSocket.onDisconnect(() => {
    addLogEntry('info', 'WebSocket disconnected')
  })
  
  mobileWebSocket.webSocket.onError((error) => {
    addLogEntry('error', `WebSocket error: ${error.message}`)
  })
  
  mobileWebSocket.webSocket.onMessage((message) => {
    addLogEntry('message', `Received: ${message.type}`)
  })
  
  addLogEntry('info', 'Mobile WebSocket demo initialized')
})

onUnmounted(() => {
  window.removeEventListener('resize', updateLayoutState)
  window.removeEventListener('orientationchange', updateLayoutState)
  mobileWebSocket.disconnect()
})
</script>

<style scoped>
.mobile-websocket-demo {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;
}

.demo-header h3 {
  margin: 0;
  color: #333;
}

.connection-status {
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 14px;
}

.status-connected {
  background-color: #d4edda;
  color: #155724;
}

.status-connecting {
  background-color: #fff3cd;
  color: #856404;
}

.status-disconnected {
  background-color: #f8d7da;
  color: #721c24;
}

.demo-content {
  display: grid;
  gap: 25px;
}

.info-section,
.gesture-section,
.layout-section,
.controls-section,
.log-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.info-section h4,
.gesture-section h4,
.layout-section h4,
.controls-section h4,
.log-section h4 {
  margin: 0 0 15px 0;
  color: #495057;
  font-size: 18px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.info-item,
.layout-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.label {
  font-weight: 600;
  color: #6c757d;
}

.value {
  font-weight: 500;
  color: #495057;
}

.quality-excellent { color: #28a745; }
.quality-good { color: #17a2b8; }
.quality-fair { color: #ffc107; }
.quality-poor { color: #dc3545; }

.gesture-area {
  background: white;
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  min-height: 200px;
  cursor: pointer;
  transition: border-color 0.3s ease;
  touch-action: none;
}

.gesture-area:hover {
  border-color: #007bff;
}

.gesture-area p {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #495057;
}

.gesture-area ul {
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
}

.gesture-area li {
  padding: 5px 0;
  color: #6c757d;
}

.gesture-feedback {
  background: #e3f2fd;
  color: #1565c0;
  padding: 10px;
  border-radius: 6px;
  font-weight: 600;
  margin-top: 15px;
}

.layout-info {
  display: grid;
  gap: 10px;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.btn-info {
  background-color: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: #138496;
}

.btn-warning {
  background-color: #ffc107;
  color: #212529;
}

.btn-warning:hover:not(:disabled) {
  background-color: #e0a800;
}

.message-log {
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border-radius: 6px;
  padding: 15px;
}

.log-entry {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f1f3f4;
  font-size: 14px;
}

.log-entry:last-child {
  border-bottom: none;
}

.timestamp {
  color: #6c757d;
  font-family: monospace;
  min-width: 80px;
}

.message {
  flex: 1;
}

.log-success .message { color: #28a745; }
.log-error .message { color: #dc3545; }
.log-info .message { color: #17a2b8; }
.log-gesture .message { color: #6f42c1; }
.log-message .message { color: #495057; }

/* Mobile responsive */
@media (max-width: 768px) {
  .mobile-websocket-demo {
    padding: 15px;
  }
  
  .demo-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .controls {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>