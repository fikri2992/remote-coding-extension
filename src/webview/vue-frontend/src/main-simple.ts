import { createApp } from 'vue'
import App from './App-simple.vue'

// Tailwind CSS
import './style.css'

const app = createApp(App)

// Simple error handler
app.config.errorHandler = (err, _instance, info) => {
  console.error('Vue error:', err)
  console.error('Component info:', info)
}

app.mount('#app')

console.log('Simple Vue application mounted successfully')