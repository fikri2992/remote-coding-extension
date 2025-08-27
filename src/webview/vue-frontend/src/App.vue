<template>
  <div id="app" class="min-h-screen bg-secondary-50">
    <!-- App Header -->
    <AppHeader />
    
    <!-- Main Layout -->
    <div class="flex">
      <!-- Sidebar Navigation -->
      <AppSidebar />
      
      <!-- Main Content Area -->
      <main class="flex-1 transition-all duration-300" :class="{ 'ml-64': !uiStore.sidebarCollapsed, 'ml-16': uiStore.sidebarCollapsed }">
        <router-view />
      </main>
    </div>
    
    <!-- App Footer -->
    <AppFooter />
    
    <!-- Notifications -->
    <NotificationToast />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useUIStore } from './stores'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppFooter from './components/layout/AppFooter.vue'
import NotificationToast from './components/common/NotificationToast.vue'

const uiStore = useUIStore()

onMounted(() => {
  // Initialize application
  console.log('Vue.js Frontend Application Initialized')
  
  // Set initial active view based on current route
  const currentRoute = window.location.pathname
  if (currentRoute.includes('/automation')) {
    uiStore.setActiveView('automation')
  } else if (currentRoute.includes('/files')) {
    uiStore.setActiveView('files')
  } else if (currentRoute.includes('/git')) {
    uiStore.setActiveView('git')
  } else if (currentRoute.includes('/terminal')) {
    uiStore.setActiveView('terminal')
  } else if (currentRoute.includes('/chat')) {
    uiStore.setActiveView('chat')
  } else {
    uiStore.setActiveView('home')
  }
})
</script>

<style scoped>
#app {
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
