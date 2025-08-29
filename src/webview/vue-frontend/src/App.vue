<template>
  <div id="app" class="min-h-screen bg-secondary-50 dark:bg-secondary-900 flex flex-col">
    <!-- App Header -->
    <AppHeader />
    
    <!-- Main Layout -->
    <div class="flex flex-1 relative">
      <!-- Sidebar Navigation -->
      <AppSidebar />
      
      <!-- Main Content Area -->
      <main 
        class="flex-1 transition-all duration-300 min-h-0"
        :class="{
          // Mobile: no margin (overlay mode)
          'ml-0': windowWidth < 768,
          // Tablet: adjust for sidebar width
          'md:ml-20': uiStore.sidebarCollapsed && windowWidth >= 768 && windowWidth < 1024,
          'md:ml-64': !uiStore.sidebarCollapsed && windowWidth >= 768 && windowWidth < 1024,
          // Desktop: adjust for sidebar width
          'lg:ml-16': uiStore.sidebarCollapsed && windowWidth >= 1024,
          'lg:ml-64': !uiStore.sidebarCollapsed && windowWidth >= 1024
        }"
      >
        <div class="h-full overflow-auto">
          <router-view />
        </div>
      </main>
    </div>
    
    <!-- App Footer -->
    <AppFooter />
    
    <!-- Notifications -->
    <NotificationToast />
    
    <!-- Debug Panel (Development Only) -->
    <DebugPanel v-if="isDevelopment" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted, watch } from 'vue'
import { useUIStore, useConnectionStore } from './stores'
import { useTheme } from './stores/composables'
import { connectionService } from './services/connection'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppFooter from './components/layout/AppFooter.vue'
import NotificationToast from './components/common/NotificationToast.vue'
import DebugPanel from './components/common/DebugPanel.vue'

const uiStore = useUIStore()
const connectionStore = useConnectionStore()
const { setTheme, loadStoredTheme } = useTheme()

// Development mode detection
const isDevelopment = computed(() => import.meta.env.DEV)

// Responsive breakpoint detection
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 1024) // lg breakpoint

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

// Watch for theme changes and apply them
watch(() => uiStore.theme, (newTheme) => {
  setTheme(newTheme)
}, { immediate: true })

onMounted(async () => {
  // Initialize application
  console.log('🎉 Vue.js Frontend Application Initialized')
  
  // Load and apply stored theme
  loadStoredTheme()
  
  // Set up responsive behavior
  window.addEventListener('resize', updateWindowWidth)
  
  // Auto-collapse sidebar on mobile
  if (isMobile.value) {
    uiStore.setSidebarCollapsed(true)
    console.log('📱 Sidebar auto-collapsed for mobile')
  }
  
  // Initialize connection service
  try {
    console.log('🔌 Initializing connection service...')
    await connectionService.initialize()
    console.log('✅ Connection service initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize connection service:', error)
    // Set connection status to error
    connectionStore.setConnectionStatus('error', error instanceof Error ? error.message : 'Connection failed')
  }
  
  // Set initial active view based on current route
  const currentRoute = window.location.pathname
  let activeView = 'automation' // default
  
  if (currentRoute.includes('/automation')) {
    activeView = 'automation'
  } else if (currentRoute.includes('/files')) {
    activeView = 'files'
  } else if (currentRoute.includes('/git')) {
    activeView = 'git'
  } else if (currentRoute.includes('/terminal')) {
    activeView = 'terminal'
  } else if (currentRoute.includes('/chat')) {
    activeView = 'chat'
  }
  
  uiStore.setActiveView(activeView as 'automation' | 'files' | 'git' | 'terminal' | 'chat')
  console.log(`🧭 Initial view set to ${activeView}`, { route: currentRoute })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
  // Disconnect from WebSocket when app unmounts
  connectionService.disconnect()
})
</script>

<style scoped>
#app {
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
