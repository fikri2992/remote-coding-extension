import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
    meta: {
      title: 'Home',
      description: 'Web Automation Tunnel Dashboard'
    }
  },
  {
    path: '/automation',
    name: 'Automation',
    component: () => import('../views/AutomationView.vue'),
    meta: {
      title: 'Automation',
      description: 'VS Code command execution and server management'
    }
  },
  {
    path: '/files',
    name: 'Files',
    component: () => import('../views/FilesView.vue'),
    meta: {
      title: 'Files',
      description: 'Workspace file and directory management'
    }
  },
  {
    path: '/git',
    name: 'Git',
    component: () => import('../views/GitView.vue'),
    meta: {
      title: 'Git',
      description: 'Version control and repository management'
    }
  },
  {
    path: '/terminal',
    name: 'Terminal',
    component: () => import('../views/TerminalView.vue'),
    meta: {
      title: 'Terminal',
      description: 'Interactive terminal access'
    }
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('../views/ChatView.vue'),
    meta: {
      title: 'Chat',
      description: 'Real-time messaging and collaboration'
    }
  },
  {
    // Catch-all route for 404s
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach((to, _from, next) => {
  // Update document title
  if (to.meta?.['title']) {
    document.title = `${to.meta['title']} - Web Automation Tunnel`
  }

  next()
})

export default router
