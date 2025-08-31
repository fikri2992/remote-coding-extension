<template>
  <!-- Mobile Overlay -->
  <div 
    v-if="!uiStore.sidebarCollapsed && isMobile"
    class="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
    @click="uiStore.setSidebarCollapsed(true)"
  ></div>

  <!-- Sidebar -->
  <aside 
    class="fixed left-0 top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] bg-white border-r border-secondary-200 transition-all duration-300 z-40 shadow-lg lg:shadow-none"
    :class="{
      // Desktop behavior
      'lg:w-64': !uiStore.sidebarCollapsed,
      'lg:w-16': uiStore.sidebarCollapsed,
      // Mobile behavior
      'w-64': !uiStore.sidebarCollapsed && isMobile,
      'w-0 -translate-x-full': uiStore.sidebarCollapsed && isMobile,
      // Tablet behavior
      'md:w-20': uiStore.sidebarCollapsed && !isMobile,
      'md:w-64': !uiStore.sidebarCollapsed && !isMobile
    }"
  >
    <nav class="p-3 sm:p-4 space-y-1 sm:space-y-2 overflow-y-auto h-full">
      <!-- Navigation Items -->
      <router-link
        v-for="item in navigationItems"
        :key="item.name"
        :to="item.path"
        class="nav-item group"
        @click="handleNavClick(item.name.toLowerCase())"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIconSvg(item.icon)" />
        </svg>
        <span 
          v-if="!uiStore.sidebarCollapsed || isMobile" 
          class="transition-opacity duration-200 text-sm sm:text-base"
        >
          {{ item.label }}
        </span>
        <!-- Tooltip for collapsed desktop sidebar -->
        <div 
          v-if="uiStore.sidebarCollapsed && !isMobile"
          class="absolute left-full ml-2 px-2 py-1 bg-secondary-800 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50"
        >
          {{ item.label }}
        </div>
      </router-link>
    </nav>

    <!-- Sidebar Footer -->
    <div class="absolute bottom-4 left-4 right-4">
      <div 
        v-if="!uiStore.sidebarCollapsed || isMobile" 
        class="text-xs text-secondary-500 text-center space-y-1"
      >
        <p class="font-medium">Vue.js Frontend</p>
        <p class="text-secondary-400">v1.0.0</p>
      </div>
      <!-- Collapsed footer indicator -->
      <div 
        v-else-if="uiStore.sidebarCollapsed && !isMobile"
        class="flex justify-center"
      >
        <div class="w-2 h-2 bg-primary-500 rounded-full"></div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useUIStore } from '../../stores'

const uiStore = useUIStore()

// Responsive breakpoint detection
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 1024) // lg breakpoint

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', updateWindowWidth)
  // Auto-collapse sidebar on mobile
  if (isMobile.value) {
    uiStore.setSidebarCollapsed(true)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})

const navigationItems = [
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

const handleNavClick = (viewName: string) => {
  const validViews = ['automation', 'files', 'git', 'terminal', 'chat'] as const
  if (validViews.includes(viewName as typeof validViews[number])) {
    uiStore.setActiveView(viewName as typeof validViews[number])
  }
  
  // Auto-close sidebar on mobile after navigation
  if (isMobile.value) {
    uiStore.setSidebarCollapsed(true)
  }
}

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
  @apply relative flex items-center gap-3 px-3 py-2 rounded-md text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900 transition-colors duration-200;
}

.nav-item.active {
  @apply bg-primary-100 text-primary-700 font-medium;
}

.nav-item.active:hover {
  @apply bg-primary-200;
}

/* Mobile-specific styles */
@media (max-width: 1023px) {
  .nav-item {
    @apply px-4 py-3;
  }
}

/* Tablet-specific styles */
@media (min-width: 768px) and (max-width: 1023px) {
  .nav-item {
    @apply justify-center;
  }
}
</style>