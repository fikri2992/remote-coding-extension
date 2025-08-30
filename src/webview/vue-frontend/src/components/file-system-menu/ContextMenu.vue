<template>
  <div
    v-if="show"
    ref="contextMenuRef"
    :style="menuStyles"
    class="context-menu fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-48"
    @click.stop
    @contextmenu.prevent
  >
    <template v-for="(action, index) in actions" :key="action.id">
      <!-- Separator -->
      <div
        v-if="action.separator"
        class="border-t border-gray-200 dark:border-gray-600 my-1"
      ></div>
      
      <!-- Menu Item -->
      <button
        v-else
        @click="handleAction(action.id)"
        :disabled="action.disabled"
        class="context-menu-item w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
        :class="{
          'hover:bg-gray-100 dark:hover:bg-gray-700': !action.disabled,
          'cursor-not-allowed opacity-50': action.disabled
        }"
      >
        <div class="flex items-center">
          <!-- Icon -->
          <component
            v-if="action.icon"
            :is="getIconComponent(action.icon)"
            class="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400"
          />
          
          <!-- Label -->
          <span>{{ action.label }}</span>
        </div>
        
        <!-- Keyboard Shortcut -->
        <span
          v-if="action.shortcut"
          class="text-xs text-gray-400 dark:text-gray-500 ml-4"
        >
          {{ action.shortcut }}
        </span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import type { ContextMenuProps } from './types'

// Props
const props = defineProps<ContextMenuProps>()

// Emits
const emit = defineEmits<{
  action: [actionId: string]
  close: []
}>()

// Refs
const contextMenuRef = ref<HTMLElement>()

// Computed
const show = computed(() => props.actions.length > 0)

const menuStyles = computed(() => {
  const styles: Record<string, string> = {
    left: `${props.x}px`,
    top: `${props.y}px`
  }
  
  return styles
})

// Methods
const handleAction = (actionId: string) => {
  emit('action', actionId)
}

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'copy':
      return 'CopyIcon'
    case 'file-text':
      return 'FileTextIcon'
    case 'edit':
      return 'EditIcon'
    case 'folder-open':
      return 'FolderOpenIcon'
    case 'trash':
      return 'TrashIcon'
    case 'download':
      return 'DownloadIcon'
    case 'external-link':
      return 'ExternalLinkIcon'
    default:
      return 'DefaultIcon'
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (contextMenuRef.value && !contextMenuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

const adjustPosition = async () => {
  await nextTick()
  
  if (!contextMenuRef.value) return
  
  const menu = contextMenuRef.value
  const rect = menu.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  let adjustedX = props.x
  let adjustedY = props.y
  
  // Adjust horizontal position if menu would overflow
  if (rect.right > viewportWidth) {
    adjustedX = viewportWidth - rect.width - 8
  }
  
  // Adjust vertical position if menu would overflow
  if (rect.bottom > viewportHeight) {
    adjustedY = viewportHeight - rect.height - 8
  }
  
  // Ensure menu doesn't go off-screen on the left or top
  adjustedX = Math.max(8, adjustedX)
  adjustedY = Math.max(8, adjustedY)
  
  // Apply adjusted position
  menu.style.left = `${adjustedX}px`
  menu.style.top = `${adjustedY}px`
}

// Watchers
watch(() => [props.x, props.y, show.value], () => {
  if (show.value) {
    adjustPosition()
  }
})

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  
  if (show.value) {
    adjustPosition()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<script lang="ts">
// Icon components
import { defineComponent, h } from 'vue'

const CopyIcon = defineComponent({
  name: 'CopyIcon',
  render: () => h('svg', {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, [
    h('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '2',
      d: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
    })
  ])
})

const FileTextIcon = defineComponent({
  name: 'FileTextIcon',
  render: () => h('svg', {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, [
    h('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '2',
      d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    })
  ])
})

const EditIcon = defineComponent({
  name: 'EditIcon',
  render: () => h('svg', {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, [
    h('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '2',
      d: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    })
  ])
})

const FolderOpenIcon = defineComponent({
  name: 'FolderOpenIcon',
  render: () => h('svg', {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, [
    h('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '2',
      d: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z'
    })
  ])
})

const TrashIcon = defineComponent({
  name: 'TrashIcon',
  render: () => h('svg', {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, [
    h('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '2',
      d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
    })
  ])
})

const DownloadIcon = defineComponent({
  name: 'DownloadIcon',
  render: () => h('svg', {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, [
    h('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '2',
      d: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    })
  ])
})

const ExternalLinkIcon = defineComponent({
  name: 'ExternalLinkIcon',
  render: () => h('svg', {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, [
    h('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '2',
      d: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
    })
  ])
})

const DefaultIcon = defineComponent({
  name: 'DefaultIcon',
  render: () => h('svg', {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, [
    h('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '2',
      d: 'M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z'
    })
  ])
})

export default {
  components: {
    CopyIcon,
    FileTextIcon,
    EditIcon,
    FolderOpenIcon,
    TrashIcon,
    DownloadIcon,
    ExternalLinkIcon,
    DefaultIcon
  }
}
</script>

<style scoped>
.context-menu {
  backdrop-filter: blur(8px);
  animation: contextMenuFadeIn 0.15s ease-out;
}

@keyframes contextMenuFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.context-menu-item {
  transition: background-color 0.15s ease;
}

.context-menu-item:first-child {
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
}

.context-menu-item:last-child {
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
}

/* Focus styles for accessibility */
.context-menu-item:focus {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}
</style>