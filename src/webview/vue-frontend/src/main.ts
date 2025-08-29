import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Tailwind CSS
import './style.css'

console.log('🚀 Vue Frontend Starting...')

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Simple error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err)
  console.error('Component:', instance)
  console.error('Info:', info)
}

console.log('🔧 Mounting Vue app...')
app.mount('#app')
console.log('✅ Vue app mounted successfully!')
