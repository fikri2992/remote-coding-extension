<template>
  <div id="app" class="min-h-screen bg-gray-100 p-8">
    <h1 class="text-3xl font-bold text-gray-800 mb-4">Web Automation Tunnel</h1>
    <p class="text-gray-600 mb-8">Vue.js Frontend - Simple Version</p>
    
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4">Connection Status</h2>
      <div class="flex items-center gap-2 mb-4">
        <div 
          class="w-3 h-3 rounded-full"
          :class="isConnected ? 'bg-green-500' : 'bg-red-500'"
        ></div>
        <span>{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
      </div>
      
      <button 
        @click="toggleConnection"
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
      >
        {{ isConnected ? 'Disconnect' : 'Connect' }}
      </button>
    </div>

    <div class="mt-8 bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4">Test Message</h2>
      <input 
        v-model="testMessage" 
        placeholder="Enter test message"
        class="w-full p-2 border rounded mb-4"
      >
      <button 
        @click="sendTestMessage"
        :disabled="!isConnected"
        class="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded"
      >
        Send Message
      </button>
    </div>

    <div class="mt-8 bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4">Messages</h2>
      <div class="space-y-2 max-h-64 overflow-y-auto">
        <div 
          v-for="(message, index) in messages" 
          :key="index"
          class="p-2 bg-gray-50 rounded text-sm"
        >
          {{ message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isConnected = ref(false)
const testMessage = ref('')
const messages = ref<string[]>([])
let ws: WebSocket | null = null

const connect = () => {
  try {
    ws = new WebSocket('ws://localhost:8081')
    
    ws.onopen = () => {
      isConnected.value = true
      addMessage('Connected to WebSocket server')
    }
    
    ws.onclose = () => {
      isConnected.value = false
      addMessage('Disconnected from WebSocket server')
    }
    
    ws.onerror = (error) => {
      addMessage(`WebSocket error: ${error}`)
    }
    
    ws.onmessage = (event) => {
      addMessage(`Received: ${event.data}`)
    }
  } catch (error) {
    addMessage(`Connection failed: ${error}`)
  }
}

const disconnect = () => {
  if (ws) {
    ws.close()
    ws = null
  }
}

const toggleConnection = () => {
  if (isConnected.value) {
    disconnect()
  } else {
    connect()
  }
}

const sendTestMessage = () => {
  if (ws && isConnected.value && testMessage.value) {
    ws.send(JSON.stringify({
      type: 'test',
      message: testMessage.value,
      timestamp: new Date().toISOString()
    }))
    addMessage(`Sent: ${testMessage.value}`)
    testMessage.value = ''
  }
}

const addMessage = (message: string) => {
  messages.value.unshift(`${new Date().toLocaleTimeString()}: ${message}`)
  if (messages.value.length > 50) {
    messages.value = messages.value.slice(0, 50)
  }
}

onMounted(() => {
  addMessage('Vue app mounted')
  // Auto-connect after 1 second
  setTimeout(connect, 1000)
})

onUnmounted(() => {
  disconnect()
})
</script>