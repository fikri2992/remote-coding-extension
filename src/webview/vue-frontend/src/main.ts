import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { 
  createPersistencePlugin, 
  createDebugPlugin, 
  createErrorHandlingPlugin,
  createInitializationPlugin 
} from './stores/plugins'

// Tailwind CSS
import './style.css'

const app = createApp(App)
const pinia = createPinia()

// Configure Pinia plugins
pinia.use(createPersistencePlugin({
  exclude: ['connection'], // Don't persist connection state
  include: ['settings', 'ui'] // Only persist settings and UI state
}))

pinia.use(createDebugPlugin())

pinia.use(createErrorHandlingPlugin({
  onError: (error, store, action) => {
    // Global error handling - could integrate with error reporting service
    console.error(`Store Error [${store}.${action}]:`, error)
  }
}))

pinia.use(createInitializationPlugin({
  settings: async () => {
    // Initialize settings store
    const { useSettingsStore } = await import('./stores/settings')
    const settingsStore = useSettingsStore()
    await settingsStore.loadFromStorage()
  }
}))

app.use(pinia)
app.use(router)

app.mount('#app')
