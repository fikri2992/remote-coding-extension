<template>
  <div id="app" class="min-h-screen bg-secondary-50 flex flex-col">
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
          // Desktop sidebar spacing
          'lg:ml-64': !uiStore.sidebarCollapsed,
          'lg:ml-16': uiStore.sidebarCollapsed,
          // Mobile: no margin when sidebar is collapsed (overlay mode)
          'ml-0': isMobile
        }"
      >
        <div class="h-full overflow-auto">
          <router-view />
        </div>
      </main>
    </div>
    
    <!-- App Footer -->
    <AppFooter />


  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted } from 'vue'
import { useUIStore } from './stores'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppFooter from './components/layout/AppFooter.vue'
import { addBreadcrumb } from './services/error-handler'

const uiStore = useUIStore()

// Development mode detection

// Responsive breakpoint detection
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 1024) // lg breakpoint

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  // Initialize application
  console.log('Vue.js Frontend Application Initialized')
  addBreadcrumb('app', 'Application component mounted', 'info')
  
  // Set up responsive behavior
  window.addEventListener('resize', updateWindowWidth)
  
  // Auto-collapse sidebar on mobile
  if (isMobile.value) {
    uiStore.setSidebarCollapsed(true)
    addBreadcrumb('ui', 'Sidebar auto-collapsed for mobile', 'info')
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
  
  uiStore.setActiveView(activeView as any)
  addBreadcrumb('navigation', `Initial view set to ${activeView}`, 'info', { route: currentRoute })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})
</script>

<style scoped>
#app {
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
