import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/automation',
    name: 'Automation',
    component: () => import('../views/AutomationView.vue')
  },
  {
    path: '/files',
    name: 'Files',
    component: () => import('../views/FilesView.vue')
  },
  {
    path: '/git',
    name: 'Git',
    component: () => import('../views/GitView.vue')
  },
  {
    path: '/terminal',
    name: 'Terminal',
    component: () => import('../views/TerminalView.vue')
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('../views/ChatView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router