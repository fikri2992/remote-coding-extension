# Debugging Pinia Store Errors

## Common Error: "getActivePinia() was called but there was no active Pinia"

This error occurs when trying to use Pinia stores before the Pinia instance is created and installed in the Vue app.

### Root Cause
- Stores are being accessed during module initialization (at import time)
- Services or composables are trying to use stores before `app.use(pinia)` is called

### How to Debug

#### 1. Check Module-Level Store Usage
Look for stores being used at the top level of modules:

```typescript
// ❌ Bad: Store used at module level
import { useMyStore } from './stores/myStore'

export class MyService {
  private store = useMyStore() // Error: Pinia not active yet
}

// Create instance at module level
export const myService = new MyService() // This will fail
```

#### 2. Use Lazy Initialization
Initialize stores only when methods are called:

```typescript
// ✅ Good: Lazy store initialization
import { useMyStore } from './stores/myStore'

export class MyService {
  private store: ReturnType<typeof useMyStore> | null = null
  
  private initializeStore() {
    if (!this.store) {
      this.store = useMyStore()
    }
  }
  
  async someMethod() {
    this.initializeStore() // Initialize when needed
    return this.store!.someAction()
  }
}

export const myService = new MyService() // Safe to create
```

#### 3. Initialize in Vue Lifecycle
For services used in components, initialize in `onMounted`:

```vue
<script setup>
import { onMounted } from 'vue'
import { myService } from './services/myService'

onMounted(async () => {
  // Initialize service after Pinia is ready
  await myService.initialize()
})
</script>
```

### Common Patterns & Solutions

#### Pattern 1: Service with Store Dependencies
```typescript
export class ConnectionService {
  private webSocket: ReturnType<typeof useWebSocket> | null = null
  private connectionStore: ReturnType<typeof useConnectionStore> | null = null
  
  private initializeStores(): void {
    if (!this.webSocket) {
      this.webSocket = useWebSocket()
    }
    if (!this.connectionStore) {
      this.connectionStore = useConnectionStore()
    }
  }
  
  async initialize(): Promise<void> {
    this.initializeStores() // Initialize stores first
    // ... rest of initialization
  }
  
  // Use non-null assertion or optional chaining
  connect() {
    this.connectionStore!.setStatus('connecting')
    // or
    this.connectionStore?.setStatus('connecting')
  }
}
```

#### Pattern 2: Composable with Store Dependencies
```typescript
export function useFileSystem() {
  // Don't initialize stores at composable creation
  let webSocket: ReturnType<typeof useWebSocket> | null = null
  
  const initialize = () => {
    if (!webSocket) {
      webSocket = connectionService.getWebSocket()
      if (!webSocket) {
        throw new Error('WebSocket not initialized')
      }
    }
  }
  
  const loadFiles = async () => {
    initialize() // Ensure initialized before use
    return webSocket!.sendMessage(...)
  }
  
  return { loadFiles }
}
```

#### Pattern 3: Singleton Services
```typescript
// Instead of creating at module level
export const myService = new MyService() // ❌ Bad

// Use factory function
let _myService: MyService | null = null

export function getMyService(): MyService {
  if (!_myService) {
    _myService = new MyService()
  }
  return _myService
}

// Or lazy property
export const myService = {
  _instance: null as MyService | null,
  get instance() {
    if (!this._instance) {
      this._instance = new MyService()
    }
    return this._instance
  }
}
```

### Debugging Steps

1. **Identify the Error Source**
   - Look at the stack trace to find which module is trying to use stores
   - Check for module-level store initialization

2. **Check Initialization Order**
   - Ensure `app.use(pinia)` is called before any store usage
   - Verify services are initialized after Pinia setup

3. **Add Null Checks**
   - Use optional chaining (`?.`) for store access
   - Add proper error handling for uninitialized stores

4. **Use TypeScript Strict Mode**
   - Enable strict null checks to catch these issues at compile time
   - Use non-null assertion (`!`) only when you're certain stores are initialized

### Prevention Checklist

- [ ] No store usage at module level (during import)
- [ ] Services initialize stores in methods, not constructors
- [ ] Composables check for store availability before use
- [ ] Proper error handling for uninitialized stores
- [ ] TypeScript strict mode enabled
- [ ] Services initialized after Pinia setup in Vue app

### Example App.vue Setup
```vue
<script setup>
import { onMounted } from 'vue'
import { createPinia } from 'pinia'
import { myService } from './services/myService'

// Pinia is set up in main.ts before this component mounts

onMounted(async () => {
  try {
    // Initialize services that depend on stores
    await myService.initialize()
  } catch (error) {
    console.error('Service initialization failed:', error)
  }
})
</script>
```

### Testing Store Dependencies
```typescript
// Test that services can be imported without errors
describe('Service Imports', () => {
  it('should import services without Pinia errors', () => {
    // This should not throw
    expect(() => {
      require('./services/myService')
    }).not.toThrow()
  })
  
  it('should initialize service after Pinia setup', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    
    const { myService } = await import('./services/myService')
    await expect(myService.initialize()).resolves.not.toThrow()
  })
})
```