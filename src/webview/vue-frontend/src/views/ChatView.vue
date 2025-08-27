<template>
  <div class="min-h-screen bg-secondary-50 p-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-secondary-900 mb-2">Chat</h1>
        <p class="text-secondary-600">Real-time messaging and collaboration features</p>
      </div>

      <div class="card">
        <h3 class="text-xl font-semibold mb-4">Chat Interface</h3>
        <p class="text-secondary-600">Chat functionality will be implemented in future tasks.</p>

        <div class="mt-4 border rounded p-4 bg-secondary-100">
          <div class="space-y-2">
            <div class="flex gap-3">
              <div
                class="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-medium"
              >
                S
              </div>
              <div>
                <div class="font-medium">System</div>
                <div class="text-secondary-700">Welcome to the chat interface!</div>
              </div>
            </div>
            <div class="flex gap-3">
              <div
                class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium"
              >
                U
              </div>
              <div>
                <div class="font-medium">User</div>
                <div class="text-secondary-700">Chat functionality will be available soon.</div>
              </div>
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <input
              class="input-field flex-1"
              placeholder="Message input will be available in future tasks"
              disabled
            />
            <button class="btn-primary" disabled>Send</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Simplified Chat view - full functionality will be implemented in later tasks
</script>
