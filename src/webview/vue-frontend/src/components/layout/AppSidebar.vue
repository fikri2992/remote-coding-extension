<template>
  <aside 
    class="fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-secondary-200 transition-all duration-300 z-40"
    :class="{ 'w-64': !uiStore.sidebarCollapsed, 'w-16': uiStore.sidebarCollapsed }"
  >
    <nav class="p-4 space-y-2">
      <!-- Navigation Items -->
      <router-link
        v-for="item in navigationItems"
        :key="item.name"
        :to="item.path"
        class="nav-item"
        :class="{ 'active': $route.name === item.name }"
        @click="uiStore.setActiveView(item.name.toLowerCase())"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIconSvg(item.icon)" />
        </svg>
        <span 
          v-if="!uiStore.sidebarCollapsed" 
          class="transition-opacity duration-200"
        >
          {{ item.label }}
        </span>
      </router-link>
    </nav>

    <!-- Sidebar Footer -->
    <div class="absolute bottom-4 left-4 right-4">
      <div v-if="!uiStore.sidebarCollapsed" class="text-xs text-secondary-500 text-center">
        <p>Vue.js Frontend</p>
        <p>v1.0.0</p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useUIStore } from '../../stores'

const uiStore = useUIStore()

const navigationItems = [
  {
    name: 'Home',
    label: 'Home',
    path: '/',
    icon: 'home'
  },
  {
    name: 'Automation',
    label: 'Automation',
    path: '/automation',
    icon: 'cog'
  },
  {
    name: 'Files',
    label: 'Files',
    path: '/files',
    icon: 'folder'
  },
  {
    name: 'Git',
    label: 'Git',
    path: '/git',
    icon: 'git'
  },
  {
    name: 'Terminal',
    label: 'Terminal',
    path: '/terminal',
    icon: 'terminal'
  },
  {
    name: 'Chat',
    label: 'Chat',
    path: '/chat',
    icon: 'chat'
  }
]

const getIconSvg = (iconName: string) => {
  const icons = {
    home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    git: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
    terminal: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
  }
  return icons[iconName as keyof typeof icons] || icons.home
}
</script>

<style scoped>
.nav-item {
  @apply flex items-center gap-3 px-3 py-2 rounded-md text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900 transition-colors duration-200;
}

.nav-item.active {
  @apply bg-primary-100 text-primary-700 font-medium;
}

.nav-item.active:hover {
  @apply bg-primary-200;
}
</style>