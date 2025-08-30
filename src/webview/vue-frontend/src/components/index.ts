// Export all components by category

// Common utility components
export * from './common'

// Layout components
export { default as AppHeader } from './layout/AppHeader.vue'
export { default as AppSidebar } from './layout/AppSidebar.vue'
export { default as AppFooter } from './layout/AppFooter.vue'
export { default as CollapsibleHeader } from './layout/CollapsibleHeader.vue'
export { default as AdaptiveNavigation } from './layout/AdaptiveNavigation.vue'

// Automation components
export { default as CommandPanel } from './automation/CommandPanel.vue'

// File management components
export { default as FileExplorer } from './files/FileExplorer.vue'
export { default as FileTree } from './files/FileTree.vue'
export { default as FileTreeNode } from './files/FileTreeNode.vue'
export { default as FileViewer } from './files/FileViewer.vue'
export { default as FileSearch } from './files/FileSearch.vue'
export { default as VirtualList } from './files/VirtualList.vue'

// Mobile file preview components
export { default as MobileFilePreview } from './files/MobileFilePreview.vue'
export { default as MobileImagePreview } from './files/MobileImagePreview.vue'
export { default as MobileCodePreview } from './files/MobileCodePreview.vue'
export { default as MobileMarkdownPreview } from './files/MobileMarkdownPreview.vue'
export { default as MobileTextPreview } from './files/MobileTextPreview.vue'