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

// Global error handler for unhandled errors
app.config.errorHandler = (err, instance, info) => {
  console.error('Global Vue error:', err)
  console.error('Component instance:', instance?.$options.name || 'Unknown')
  console.error('Error info:', info)
  
  // Report to error tracking service if available
  if ((window as any).errorReporter) {
    (window as any).errorReporter.captureException(err, {
      tags: { 
        component: instance?.$options.name || 'Unknown',
        errorInfo: info 
      }
    })
  }
  
  // Show user-friendly error notification
  const { useUIStore } = require('./stores/ui')
  const uiStore = useUIStore()
  uiStore.addNotification({
    type: 'error',
    message: 'An unexpected error occurred. Please try refreshing the page.',
    duration: 5000
  })
}

// Global warning handler
app.config.warnHandler = (msg, _instance, trace) => {
  console.warn('Vue warning:', msg)
  console.warn('Component trace:', trace)
}

app.mount('#app')
