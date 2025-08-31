<template>
  <ErrorBoundary
    :fallback-component="AutomationErrorFallback"
    @error="handleAutomationError"
    @retry="retryAutomation"
  >
    <div class="min-h-screen bg-secondary-50 p-6">
      <div class="max-w-7xl mx-auto">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-secondary-900 mb-2">Automation</h1>
          <p class="text-secondary-600">Execute VS Code commands and manage server operations</p>
        </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Command Panel -->
        <div class="lg:col-span-2">
          <div class="card">
            <h3 class="text-xl font-semibold mb-4">Command Panel</h3>
            <div class="space-y-4">
              <div class="flex gap-2">
                <input
                  v-model="commandInput"
                  placeholder="Enter VS Code command..."
                  class="input-field flex-1"
                  :class="{ 'opacity-50': !connectionStore.isConnected }"
                  :disabled="!connectionStore.isConnected"
                  @keyup.enter="executeCommand"
                />
                <button
                  class="btn-primary"
                  @click="executeCommand"
                  :disabled="!commandInput.trim() || !connectionStore.isConnected"
                >
                  Execute
                </button>
              </div>

              <div v-if="!connectionStore.isConnected" class="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                ⚠️ Not connected to VS Code. Commands cannot be executed. Please connect first.
              </div>

              <div class="text-sm text-secondary-600">
                <p>Quick commands:</p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <button
                    v-for="cmd in quickCommands"
                    :key="cmd.command"
                    class="btn-secondary text-xs"
                    :class="{ 'opacity-50 cursor-not-allowed': !connectionStore.isConnected }"
                    :disabled="!connectionStore.isConnected"
                    @click="executeQuickCommand(cmd.command)"
                  >
                    {{ cmd.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Server Status -->
        <div>
          <div class="card">
            <h3 class="text-xl font-semibold mb-4">Server Status</h3>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-secondary-600">Connection:</span>
                <span :class="connectionStatusClass">
                  {{ connectionStore.connectionStatus }}
                </span>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-secondary-600">Latency:</span>
                <span class="text-secondary-900">{{ connectionStore.latency }}ms</span>
              </div>

              <div class="flex gap-2">
                <button
                  class="btn-primary text-sm"
                  :disabled="connectionStore.isConnected"
                  @click="connect"
                >
                  Connect
                </button>
                <button
                  class="btn-secondary text-sm"
                  :disabled="!connectionStore.isConnected"
                  @click="disconnect"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Command History -->
      <div class="mt-6">
        <div class="card">
          <h3 class="text-xl font-semibold mb-4">Command History</h3>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="(cmd, index) in commandHistory"
              :key="index"
              class="flex justify-between items-center p-2 bg-secondary-100 rounded"
            >
              <span class="font-mono text-sm">{{ cmd.command }}</span>
              <span class="text-xs text-secondary-500">{{ formatTime(cmd.timestamp) }}</span>
            </div>
            <div v-if="commandHistory.length === 0" class="text-center text-secondary-500 py-4">
              No commands executed yet
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConnectionStore, useUIStore } from '../stores'
import { connectionService } from '../services/connection'
import { captureError, createAppError } from '../services/error-handler'
import ErrorBoundary from '../components/common/ErrorBoundary.vue'
import FallbackComponents from '../components/common/FallbackComponents.vue'

const connectionStore = useConnectionStore()
const uiStore = useUIStore()

const commandInput = ref('')
const commandHistory = ref<Array<{ command: string; timestamp: Date }>>([])

const quickCommands = [
  { label: 'Save All', command: 'workbench.action.files.saveAll' },
  { label: 'Format Document', command: 'editor.action.formatDocument' },
  { label: 'Toggle Terminal', command: 'workbench.action.terminal.toggleTerminal' },
  { label: 'Open Settings', command: 'workbench.action.openSettings' }
]

const connectionStatusClass = computed(() => {
  const status = connectionStore.connectionStatus
  return {
    'text-green-600': status === 'connected',
    'text-yellow-600': status === 'reconnecting',
    'text-red-600': status === 'disconnected',
    'text-blue-600': status === 'connecting',
    'text-orange-600': status === 'error'
  }
})

const executeCommand = () => {
  if (!commandInput.value.trim()) {
    return
  }

  // Check connection status
  if (!connectionStore.isConnected) {
    uiStore.addNotification(
      'Cannot execute command - not connected to VS Code. Please connect first.',
      'warning',
      true,
      5000
    )
    return
  }

  // Add to history
  commandHistory.value.unshift({
    command: commandInput.value,
    timestamp: new Date()
  })

  // Keep only last 50 commands
  if (commandHistory.value.length > 50) {
    commandHistory.value = commandHistory.value.slice(0, 50)
  }

  // TODO: Implement actual command execution via WebSocket
  uiStore.addNotification(`Executed: ${commandInput.value}`, 'info')

  commandInput.value = ''
}

const executeQuickCommand = (command: string) => {
  commandInput.value = command
  executeCommand()
}

const connect = () => {
  // Reset connection state before attempting to connect
  connectionService.resetConnectionState()
  connectionStore.connect('ws://localhost:8081')
  uiStore.addNotification('Connecting to server...', 'info')
}

const disconnect = () => {
  connectionStore.disconnect()
  uiStore.addNotification('Disconnected from server', 'info')
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString()
}

// Error Fallback Component
const AutomationErrorFallback = {
  components: { FallbackComponents },
  template: `
    <FallbackComponents 
      type="automation" 
      @retry="$emit('retry')" 
      @reload="$emit('reload')" 
    />
  `,
  emits: ['retry', 'reload']
}

// Error handling methods
const handleAutomationError = (error: Error, errorInfo: any) => {
  const appError = createAppError(
    `Automation View Error: ${error.message}`,
    'ui',
    'medium',
    {
      component: 'AutomationView',
      action: 'automation_view_error',
      errorInfo
    },
    {
      title: 'Automation Panel Error',
      message: 'The automation panel encountered an error. You can try refreshing or continue using other features.',
      reportable: true,
      recoveryActions: [
        {
          label: 'Retry Loading',
          action: () => retryAutomation(),
          primary: true
        },
        {
          label: 'Reload Page',
          action: () => window.location.reload()
        }
      ]
    }
  )
  
  captureError(appError)
}

const retryAutomation = () => {
  // Reset component state
  commandInput.value = ''
  commandHistory.value = []
  
  // Try to reconnect if needed
  if (!connectionStore.isConnected && connectionStore.canReconnect) {
    connect()
  }
}
</script>
