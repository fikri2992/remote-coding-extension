import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { 
  createPersistencePlugin, 
  createDebugPlugin, 
} from './stores/plugins'

// Error handling and debugging services

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


app.use(pinia)
app.use(router)


app.mount('#app')


