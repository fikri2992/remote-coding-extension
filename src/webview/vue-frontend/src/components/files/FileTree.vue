<template>
  <div class="file-tree">
    <VirtualList
      :items="visibleNodes"
      :item-height="32"
      :container-height="containerHeight"
      v-slot="{ item }"
      class="h-full"
    >
      <FileTreeNode
        :key="item.path"
        :node="item"
        :level="item.level || 0"
        :is-selected="selectedPath === item.path"
        :is-loading="loadingPaths?.has(item.path) || false"
        @select="$emit('select', item)"
        @expand="$emit('expand', item)"
        @collapse="$emit('collapse', item)"
        @context-menu="$emit('context-menu', $event)"
      />
    </VirtualList>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { FileSystemNode } from '../../types/filesystem'
import FileTreeNode from './FileTreeNode.vue'
import VirtualList from './VirtualList.vue'

interface Props {
  nodes: FileSystemNode[]
  selectedPath?: string | null
  loadingPaths?: Set<string>
}

interface Emits {
  (e: 'select', node: FileSystemNode): void
  (e: 'expand', node: FileSystemNode): void
  (e: 'collapse', node: FileSystemNode): void
  (e: 'context-menu', event: { node: FileSystemNode; x: number; y: number }): void
}

const props = withDefaults(defineProps<Props>(), {
  selectedPath: null,
  loadingPaths: () => new Set()
})

defineEmits<Emits>()

// State
const containerHeight = ref(400)

// Computed
const visibleNodes = computed(() => {
  const result: (FileSystemNode & { level: number })[] = []
  
  const processNodes = (nodes: FileSystemNode[], level = 0) => {
    for (const node of nodes) {
      result.push({ ...node, level })
      
      // Add children if node is expanded
      if (node.isExpanded && node.children && node.children.length > 0) {
        processNodes(node.children, level + 1)
      }
    }
  }
  
  processNodes(props.nodes)
  return result
})

// Methods
const updateContainerHeight = () => {
  const element = document.querySelector('.file-tree')
  if (element) {
    containerHeight.value = element.clientHeight
  }
}

// Lifecycle
onMounted(() => {
  updateContainerHeight()
  window.addEventListener('resize', updateContainerHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerHeight)
})
</script>

<style scoped>
.file-tree {
  height: 100%;
  overflow: hidden;
}
</style>