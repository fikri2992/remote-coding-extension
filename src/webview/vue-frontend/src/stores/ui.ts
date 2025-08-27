import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  // State
  const sidebarCollapsed = ref(false)
  const activeView = ref('automation')
  const theme = ref<'light' | 'dark'>('light')
  const loading = ref(false)
  const notifications = ref<
    Array<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>
  >([])

  // Actions
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const setActiveView = (view: string) => {
    activeView.value = view
  }

  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading
  }

  const addNotification = (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    const id = Date.now().toString()
    notifications.value.push({ id, message, type })

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(id)
    }, 5000)
  }

  const removeNotification = (id: string) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  return {
    // State
    sidebarCollapsed,
    activeView,
    theme,
    loading,
    notifications,
    // Actions
    toggleSidebar,
    setActiveView,
    toggleTheme,
    setLoading,
    addNotification,
    removeNotification
  }
})
