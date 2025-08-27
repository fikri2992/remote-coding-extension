import type { PiniaPluginContext } from 'pinia'

/**
 * Pinia plugin for automatic state persistence
 */
export function createPersistencePlugin(options: {
  key?: string
  storage?: Storage
  include?: string[]
  exclude?: string[]
} = {}) {
  const {
    key = 'pinia-state',
    storage = localStorage,
    include = [],
    exclude = []
  } = options

  return ({ store }: PiniaPluginContext) => {
    // Skip if store is explicitly excluded
    if (exclude.includes(store.$id)) return
    
    // Skip if include list exists and store is not included
    if (include.length > 0 && !include.includes(store.$id)) return

    const storageKey = `${key}-${store.$id}`

    // Load persisted state on store creation
    try {
      const persistedState = storage.getItem(storageKey)
      if (persistedState) {
        const parsed = JSON.parse(persistedState)
        store.$patch(parsed)
      }
    } catch (error) {
      console.warn(`Failed to load persisted state for store ${store.$id}:`, error)
    }

    // Save state changes to storage
    store.$subscribe((_mutation, state) => {
      try {
        storage.setItem(storageKey, JSON.stringify(state))
      } catch (error) {
        console.warn(`Failed to persist state for store ${store.$id}:`, error)
      }
    })
  }
}

/**
 * Pinia plugin for development debugging
 */
export function createDebugPlugin() {
  return ({ store }: PiniaPluginContext) => {
    // Only enable in development
    if (import.meta.env.DEV) {
      // Log store actions in development
      store.$onAction(({ name, args, after, onError }) => {
        const startTime = Date.now()
        console.log(`🏪 [${store.$id}] Action "${name}" started with args:`, args)

        after((result) => {
          const duration = Date.now() - startTime
          console.log(`✅ [${store.$id}] Action "${name}" completed in ${duration}ms`)
          if (result !== undefined) {
            console.log(`📤 [${store.$id}] Action "${name}" returned:`, result)
          }
        })

        onError((error) => {
          const duration = Date.now() - startTime
          console.error(`❌ [${store.$id}] Action "${name}" failed after ${duration}ms:`, error)
        })
      })

      // Log state changes in development
      store.$subscribe((mutation) => {
        console.log(`🔄 [${store.$id}] State changed:`, {
          type: mutation.type,
          storeId: mutation.storeId
        })
      })
    }
  }
}

/**
 * Pinia plugin for error handling
 */
export function createErrorHandlingPlugin(options: {
  onError?: (error: Error, store: string, action: string) => void
} = {}) {
  return ({ store }: PiniaPluginContext) => {
    store.$onAction(({ name, onError }) => {
      onError((error) => {
        // Default error handling
        console.error(`Store action error in ${store.$id}.${name}:`, error)
        
        // Custom error handler
        if (options.onError && error instanceof Error) {
          options.onError(error, store.$id, name)
        }
      })
    })
  }
}

/**
 * Pinia plugin for store initialization
 */
export function createInitializationPlugin(initializers: Record<string, () => void | Promise<void>>) {
  return ({ store }: PiniaPluginContext) => {
    const initializer = initializers[store.$id]
    if (initializer) {
      // Run initializer after store is created
      Promise.resolve(initializer()).catch(error => {
        console.error(`Failed to initialize store ${store.$id}:`, error)
      })
    }
  }
}