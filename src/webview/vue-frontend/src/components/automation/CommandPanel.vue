<template>
  <div class="command-panel p-4 bg-white rounded-lg shadow">
    <h3 class="text-lg font-semibold mb-4">VS Code Commands</h3>
    
    <!-- Command Input -->
    <div class="mb-4">
      <label for="command-input" class="block text-sm font-medium text-gray-700 mb-2">
        Command
      </label>
      <input
        id="command-input"
        v-model="commandInput"
        type="text"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="e.g., workbench.action.files.save"
        @keyup.enter="executeCurrentCommand"
      />
    </div>

    <!-- Quick Commands -->
    <div class="mb-4">
      <h4 class="text-sm font-medium text-gray-700 mb-2">Quick Commands</h4>
      <div class="grid grid-cols-2 gap-2">
        <button
          @click="commands.saveFile()"
          :disabled="commands.isExecuting.value"
          class="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Save File
        </button>
        <button
          @click="commands.formatDocument()"
          :disabled="commands.isExecuting.value"
          class="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Format Document
        </button>
        <button
          @click="commands.newFile()"
          :disabled="commands.isExecuting.value"
          class="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          New File
        </button>
        <button
          @click="commands.toggleTerminal()"
          :disabled="commands.isExecuting.value"
          class="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          Toggle Terminal
        </button>
      </div>
    </div>

    <!-- Status -->
    <div class="mb-4">
      <div class="flex items-center space-x-2">
        <span class="text-sm text-gray-600">Status:</span>
        <span 
          :class="{
            'text-green-600': commands.status.value === 'success',
            'text-red-600': commands.status.value === 'error',
            'text-blue-600': commands.status.value === 'executing',
            'text-gray-600': commands.status.value === 'idle'
          }"
          class="text-sm font-medium"
        >
          {{ commands.status.value }}
        </span>
        <div v-if="commands.isExecuting.value" class="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    </div>

    <!-- Last Result -->
    <div v-if="commands.lastResult.value" class="mb-4 p-3 bg-gray-50 rounded">
      <h4 class="text-sm font-medium text-gray-700 mb-2">Last Result</h4>
      <div class="text-xs">
        <div>Success: {{ commands.lastResult.value.success }}</div>
        <div>Execution Time: {{ commands.lastResult.value.executionTime }}ms</div>
        <div v-if="commands.lastResult.value.error" class="text-red-600">
          Error: {{ commands.lastResult.value.error }}
        </div>
      </div>
    </div>

    <!-- Command History -->
    <div v-if="commands.history.value.length > 0" class="mb-4">
      <h4 class="text-sm font-medium text-gray-700 mb-2">Recent Commands</h4>
      <div class="max-h-32 overflow-y-auto">
        <div
          v-for="item in commands.history.value.slice(0, 5)"
          :key="item.id"
          class="text-xs p-2 bg-gray-50 rounded mb-1 cursor-pointer hover:bg-gray-100"
          @click="commandInput = item.command"
        >
          <div class="font-medium">{{ item.command }}</div>
          <div class="text-gray-500">
            {{ new Date(item.timestamp).toLocaleTimeString() }} - 
            {{ item.result.success ? 'Success' : 'Error' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCommands } from '../../composables/useCommands'

const commands = useCommands()
const commandInput = ref('')

const executeCurrentCommand = async () => {
  if (!commandInput.value.trim()) return
  
  try {
    await commands.executeCommand(commandInput.value.trim())
  } catch (error) {
    console.error('Command execution failed:', error)
  }
}
</script>