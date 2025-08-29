<template>
  <div class="min-h-screen bg-secondary-50 dark:bg-secondary-900">
    <div class="container mx-auto px-4 py-8">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">Web Automation Tunnel</h1>
        <p class="text-lg text-secondary-600 dark:text-secondary-400 max-w-2xl mx-auto">
          Modern Vue.js frontend for VS Code extension automation and remote development
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <div class="card hover:shadow-lg transition-shadow duration-200">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl">⚙️</span>
            <h3 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">Automation</h3>
          </div>
          <p class="text-secondary-600 dark:text-secondary-400 mb-4">
            Execute VS Code commands and manage server operations
          </p>
          <button class="btn-primary w-full" @click="$router.push('/automation')">
            Open Automation
          </button>
        </div>

        <div class="card hover:shadow-lg transition-shadow duration-200">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl">📁</span>
            <h3 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">Files</h3>
          </div>
          <p class="text-secondary-600 dark:text-secondary-400 mb-4">Browse and manage workspace files and directories</p>
          <button class="btn-primary w-full" @click="$router.push('/files')">Open Files</button>
        </div>

        <div class="card hover:shadow-lg transition-shadow duration-200">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl">🌿</span>
            <h3 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">Git</h3>
          </div>
          <p class="text-secondary-600 dark:text-secondary-400 mb-4">
            Version control operations and repository management
          </p>
          <button class="btn-primary w-full" @click="$router.push('/git')">Open Git</button>
        </div>

        <div class="card hover:shadow-lg transition-shadow duration-200">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl">💻</span>
            <h3 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">Terminal</h3>
          </div>
          <p class="text-secondary-600 dark:text-secondary-400 mb-4">Interactive terminal access and command execution</p>
          <button class="btn-primary w-full" @click="$router.push('/terminal')">
            Open Terminal
          </button>
        </div>

        <div class="card hover:shadow-lg transition-shadow duration-200">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl">💬</span>
            <h3 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">Chat</h3>
          </div>
          <p class="text-secondary-600 dark:text-secondary-400 mb-4">Real-time messaging and collaboration features</p>
          <button class="btn-primary w-full" @click="$router.push('/chat')">Open Chat</button>
        </div>

        <div class="card hover:shadow-lg transition-shadow duration-200">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl">ℹ️</span>
            <h3 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">Status</h3>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-secondary-600 dark:text-secondary-400">Connection:</span>
              <span :class="connectionStatusClass">{{ connectionStore.connectionStatus }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-secondary-600 dark:text-secondary-400">Server:</span>
              <span class="text-secondary-900 dark:text-secondary-100">{{
                connectionStore.serverUrl || 'Not configured'
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionStore } from '../stores'

const connectionStore = useConnectionStore()

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
</script>
