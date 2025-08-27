// Export all components by category

// Common utility components
export * from './common'

// Layout components
export { default as AppHeader } from './layout/AppHeader.vue'
export { default as AppSidebar } from './layout/AppSidebar.vue'
export { default as AppFooter } from './layout/AppFooter.vue'

// Automation components
export { default as CommandPanel } from './automation/CommandPanel.vue'

// File management components
export { default as FileExplorer } from './files/FileExplorer.vue'
export { default as FileTree } from './files/FileTree.vue'
export { default as FileTreeNode } from './files/FileTreeNode.vue'
export { default as FileViewer } from './files/FileViewer.vue'
export { default as FileSearch } from './files/FileSearch.vue'
export { default as VirtualList } from './files/VirtualList.vue'