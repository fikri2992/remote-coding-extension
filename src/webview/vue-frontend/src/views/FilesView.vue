<template>
  <div class="min-h-screen bg-secondary-50 p-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-secondary-900 mb-2">Files</h1>
        <p class="text-secondary-600">Browse and manage workspace files and directories</p>
      </div>

      <div class="card">
        <h3 class="text-xl font-semibold mb-4">File Explorer</h3>
        <p class="text-secondary-600">File management functionality will be implemented in future tasks.</p>
        
        <div class="mt-4 space-y-2">
          <div class="flex items-center gap-2 p-2 bg-secondary-100 rounded">
            <span class="text-2xl">📁</span>
            <span>src/</span>
          </div>
          <div class="flex items-center gap-2 p-2 bg-secondary-100 rounded ml-4">
            <span class="text-2xl">📄</span>
            <span>main.ts</span>
          </div>
          <div class="flex items-center gap-2 p-2 bg-secondary-100 rounded ml-4">
            <span class="text-2xl">📄</span>
            <span>App.vue</span>
          </div>
          <div class="flex items-center gap-2 p-2 bg-secondary-100 rounded">
            <span class="text-2xl">📄</span>
            <span>package.json</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Simplified Files view - full functionality will be implemented in later tasks
</script>