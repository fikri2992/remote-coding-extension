<template>
  <header class="bg-white dark:bg-secondary-800 border-b border-secondary-200 dark:border-secondary-700 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-50 shadow-sm">
    <div class="flex items-center justify-between">
      <!-- Left side - Logo and Title -->
      <div class="flex items-center gap-2 sm:gap-4">
        <!-- Mobile Menu Button (visible on mobile) -->
        <button
          @click="uiStore.toggleSidebar"
          class="p-2 rounded-md hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors lg:hidden"
          title="Toggle Menu"
          aria-label="Toggle navigation menu"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Desktop Sidebar Toggle (visible on desktop) -->
        <button
          @click="uiStore.toggleSidebar"
          class="hidden lg:flex p-2 rounded-md hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
          title="Toggle Sidebar"
          aria-label="Toggle sidebar"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="w-7 h-7 sm:w-8 sm:h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-xs sm:text-sm">W</span>
          </div>
          <div class="hidden sm:block">
            <h1 class="text-base sm:text-lg font-semibold text-secondary-900 dark:text-secondary-100">Web Automation Tunnel</h1>
            <p class="text-xs text-secondary-500 dark:text-secondary-400">Vue.js Frontend</p>
          </div>
          <!-- Mobile title (shorter) -->
          <div class="block sm:hidden">
            <h1 class="text-sm font-semibold text-secondary-900 dark:text-secondary-100">WAT</h1>
          </div>
        </div>
      </div>

      <!-- Right side - Status and Controls -->
      <div class="flex items-center gap-2 sm:gap-4">
        <!-- Connection Status -->
        <div class="flex items-center gap-2">
          <div 
            class="w-2 h-2 rounded-full"
            :class="{
              'bg-green-500': connectionStore.connectionStatus === 'connected',
              'bg-yellow-500': connectionStore.connectionStatus === 'connecting' || connectionStore.connectionStatus === 'reconnecting',
              'bg-red-500': connectionStore.connectionStatus === 'disconnected' || connectionStore.connectionStatus === 'error'
            }"
            :title="`Connection status: ${connectionStore.connectionStatus}`"
          ></div>
          <span class="hidden sm:inline text-sm text-secondary-600 dark:text-secondary-400 capitalize">
            {{ connectionStore.connectionStatus }}
          </span>
        </div>

        <!-- Theme Toggle -->
        <button
          @click="uiStore.toggleTheme"
          class="p-2 rounded-md hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
          :title="`Switch to ${uiStore.theme === 'light' ? 'dark' : 'light'} theme`"
          aria-label="Toggle theme"
        >
          <svg v-if="uiStore.theme === 'light'" class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <svg v-else class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>

        <!-- Settings (hidden on mobile) -->
        <button
          class="hidden sm:flex p-2 rounded-md hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
          title="Settings"
          aria-label="Open settings"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useUIStore, useConnectionStore } from '../../stores'

const uiStore = useUIStore()
const connectionStore = useConnectionStore()
</script>