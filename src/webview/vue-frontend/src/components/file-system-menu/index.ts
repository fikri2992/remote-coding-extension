// Main component
export { default as FileSystemMenu } from './FileSystemMenu.vue'

// Panel components
export { default as FileTreePanel } from './FileTreePanel.vue'
export { default as FilePreviewPanel } from './FilePreviewPanel.vue'

// Tree components
export { default as FileTreeNode } from './FileTreeNode.vue'

// Preview components
export { default as TextPreview } from './TextPreview.vue'
export { default as ImagePreview } from './ImagePreview.vue'
export { default as BinaryFileInfo } from './BinaryFileInfo.vue'
export { default as DirectoryInfo } from './DirectoryInfo.vue'

// UI components
export { default as ContextMenu } from './ContextMenu.vue'

// Types
export * from './types'

// Store
export { useFileSystemMenuStore } from '../../stores/fileSystemMenu'