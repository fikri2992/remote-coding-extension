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

// Error handling and debugging services
import { errorHandler, captureError, addBreadcrumb, createAppError } from './services/error-handler'
import { debugService } from './services/debug'
import { AppError } from './types/errors'

// Tailwind CSS
import './style.css'

// Initialize error handling and debugging
errorHandler.initialize({
  enableConsoleLogging: import.meta.env.DEV,
  enableErrorReporting: !import.meta.env.DEV,
  enableUserNotifications: true,
  maxBreadcrumbs: 100,
  reportingEndpoint: import.meta.env['VITE_ERROR_REPORTING_ENDPOINT'],
  beforeSend: (errorReport) => {
    // Add additional context
    errorReport.context.buildVersion = import.meta.env['VITE_APP_VERSION'] || 'unknown'
    errorReport.context.environment = import.meta.env.MODE
    return errorReport
  }
})

debugService.initialize({
  enableVueDevtools: import.meta.env.DEV,
  enablePerformanceMonitoring: import.meta.env.DEV,
  enableNetworkLogging: import.meta.env.DEV,
  logLevel: import.meta.env.DEV ? 'debug' : 'error'
})

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
    // Capture store errors with enhanced error handler
    captureError(createAppError(
      `Store error in ${store}.${action}: ${error.message}`,
      'unknown',
      'medium',
      { store, action },
      {
        title: 'Application State Error',
        message: 'An error occurred while updating the application state. The app will continue to work, but some features may not function correctly.',
        reportable: true
      }
    ))
  }
}))

pinia.use(createInitializationPlugin({
  settings: async () => {
    try {
      addBreadcrumb('initialization', 'Loading settings store', 'info')
      const { useSettingsStore } = await import('./stores/settings')
      const settingsStore = useSettingsStore()
      await settingsStore.loadFromStorage()
      addBreadcrumb('initialization', 'Settings store loaded successfully', 'info')
    } catch (error) {
      captureError(createAppError(
        'Failed to initialize settings store',
        'unknown',
        'high',
        { action: 'settings_initialization' },
        {
          title: 'Settings Loading Error',
          message: 'Failed to load your settings. Default settings will be used.',
          reportable: true
        }
      ))
    }
  }
}))

app.use(pinia)
app.use(router)

// Enhanced global error handler
app.config.errorHandler = (err, instance, info) => {
  const componentName = instance?.$options.name || instance?.$options.__name || 'Unknown'
  
  // Create enhanced error with context
  const appError = createAppError(
    (err as Error).message || 'Unknown Vue error',
    'ui',
    'high',
    {
      component: componentName,
      action: 'vue_error_handler',
      errorInfo: info
    },
    {
      title: 'Interface Error',
      message: 'An error occurred in the user interface. The page will try to recover automatically.',
      showTechnicalDetails: import.meta.env.DEV,
      reportable: true,
      recoveryActions: [
        {
          label: 'Refresh Component',
          action: async () => {
            // Try to force re-render the component
            if (instance && instance.$forceUpdate) {
              instance.$forceUpdate()
            }
          },
          primary: true
        },
        {
          label: 'Reload Page',
          action: () => {
            window.location.reload()
          }
        }
      ]
    }
  )
  
  captureError(appError)
}

// Enhanced warning handler
app.config.warnHandler = (msg, instance, trace) => {
  const componentName = instance?.$options.name || instance?.$options.__name || 'Unknown'
  
  addBreadcrumb('vue', `Warning in ${componentName}: ${msg}`, 'warning', {
    component: componentName,
    trace: trace
  })
  
  if (import.meta.env.DEV) {
    console.warn('Vue warning:', msg)
    console.warn('Component trace:', trace)
  }
}

// Global event listeners for enhanced error handling
window.addEventListener('app-error', async (event: Event) => {
  const customEvent = event as CustomEvent
  const { error } = customEvent.detail
  if (error instanceof AppError) {
    // Show user notification for AppErrors
    try {
      const { useUIStore } = await import('./stores/ui')
      const uiStore = useUIStore()
      
      if (error.userFriendly) {
        uiStore.addNotification(
          error.userFriendly.message,
          'error',
          error.severity !== 'critical', // Don't auto-close critical errors
          error.severity === 'critical' ? 0 : 5000
        )
      }
    } catch (importError) {
      console.error('Failed to import UI store for error notification:', importError)
    }
  }
})

window.addEventListener('app-notification', async (event: Event) => {
  const customEvent = event as CustomEvent
  const { type, message, duration } = customEvent.detail
  
  try {
    const { useUIStore } = await import('./stores/ui')
    const uiStore = useUIStore()
    
    uiStore.addNotification(
      message,
      type,
      true, // autoClose
      duration || 5000
    )
  } catch (importError) {
    console.error('Failed to import UI store for notification:', importError)
  }
})

// Add breadcrumb for app initialization
addBreadcrumb('initialization', 'Vue application starting', 'info', {
  version: import.meta.env['VITE_APP_VERSION'] || 'unknown',
  environment: import.meta.env.MODE
})

app.mount('#app')

// Add breadcrumb for successful mount
addBreadcrumb('initialization', 'Vue application mounted successfully', 'info')

// Initialize connection service after app is mounted
import('./services/connection').then(({ connectionService }) => {
  connectionService.initialize().catch(error => {
    captureError(createAppError(
      'Failed to initialize connection service',
      'websocket',
      'high',
      { errorInfo: error.message },
      {
        title: 'Connection Service Error',
        message: 'Failed to initialize the connection to VS Code extension. Some features may not work.',
        reportable: true
      }
    ))
  })
})
