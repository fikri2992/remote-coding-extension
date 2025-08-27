import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AppSettings {
  httpPort: number
  websocketPort: number
  allowedOrigins: string[]
  maxConnections: number
  enableCors: boolean
  useEnhancedUI: boolean
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<AppSettings>({
    httpPort: 8080,
    websocketPort: 8081,
    allowedOrigins: ['*'],
    maxConnections: 10,
    enableCors: true,
    useEnhancedUI: true
  })

  // Actions
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    settings.value = { ...settings.value, ...newSettings }
  }

  const resetToDefaults = () => {
    settings.value = {
      httpPort: 8080,
      websocketPort: 8081,
      allowedOrigins: ['*'],
      maxConnections: 10,
      enableCors: true,
      useEnhancedUI: true
    }
  }

  const loadFromStorage = () => {
    const stored = localStorage.getItem('app-settings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        settings.value = { ...settings.value, ...parsed }
      } catch (error) {
        console.warn('Failed to load settings from storage:', error)
      }
    }
  }

  const saveToStorage = () => {
    localStorage.setItem('app-settings', JSON.stringify(settings.value))
  }

  return {
    // State
    settings,
    // Actions
    updateSettings,
    resetToDefaults,
    loadFromStorage,
    saveToStorage
  }
})