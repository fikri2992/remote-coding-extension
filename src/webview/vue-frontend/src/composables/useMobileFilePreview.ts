import { ref, computed, watch } from 'vue'
import { useFileSystem } from './useFileSystem'
import { useHapticFeedback } from './useHapticFeedback'
import type { FileSystemNode } from '../types/filesystem'

export interface MobileFilePreviewOptions {
  enableSwipeNavigation?: boolean
  enableHapticFeedback?: boolean
  preloadAdjacentFiles?: boolean
  maxPreloadDistance?: number
}

export interface MobileFilePreviewState {
  isVisible: boolean
  currentFilePath: string | null
  fileList: FileSystemNode[]
  currentIndex: number
  isLoading: boolean
  error: string | null
  preloadedFiles: Map<string, string>
}

const defaultOptions: Required<MobileFilePreviewOptions> = {
  enableSwipeNavigation: true,
  enableHapticFeedback: true,
  preloadAdjacentFiles: true,
  maxPreloadDistance: 2
}

export function useMobileFilePreview(options: MobileFilePreviewOptions = {}) {
  const config = { ...defaultOptions, ...options }
  
  // Composables
  const fileSystem = useFileSystem()
  const haptic = useHapticFeedback({ enabled: config.enableHapticFeedback })

  // State
  const state = ref<MobileFilePreviewState>({
    isVisible: false,
    currentFilePath: null,
    fileList: [],
    currentIndex: 0,
    isLoading: false,
    error: null,
    preloadedFiles: new Map()
  })

  // Computed
  const currentFile = computed(() => {
    if (state.value.currentFilePath) {
      return fileSystem.getNodeByPath(state.value.currentFilePath)
    }
    return state.value.fileList[state.value.currentIndex] || null
  })

  const canNavigatePrevious = computed(() => {
    return state.value.fileList.length > 1 && state.value.currentIndex > 0
  })

  const canNavigateNext = computed(() => {
    return state.value.fileList.length > 1 && state.value.currentIndex < state.value.fileList.length - 1
  })

  const isPreviewableFile = (file: FileSystemNode): boolean => {
    if (file.type !== 'file') return false
    
    const extension = fileSystem.getFileExtension(file.path)
    const previewableExtensions = [
      // Images
      'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico',
      // Code files
      'js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'sass', 'less',
      'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config',
      'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'swift',
      'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'sql',
      // Text files
      'txt', 'md', 'markdown', 'mdown', 'mkd', 'log', 'csv', 'tsv',
      // Config files
      'env', 'gitignore', 'gitattributes', 'editorconfig', 'prettierrc',
      'eslintrc', 'babelrc', 'npmrc', 'yarnrc'
    ]
    
    return previewableExtensions.includes(extension) || !extension
  }

  const getPreviewableFiles = (files: FileSystemNode[]): FileSystemNode[] => {
    return files.filter(isPreviewableFile).sort((a, b) => a.name.localeCompare(b.name))
  }

  // Methods
  const openPreview = async (filePath: string, contextFiles?: FileSystemNode[]) => {
    state.value.isLoading = true
    state.value.error = null
    
    try {
      // Set up file list
      if (contextFiles) {
        state.value.fileList = getPreviewableFiles(contextFiles)
        const fileIndex = state.value.fileList.findIndex(f => f.path === filePath)
        state.value.currentIndex = Math.max(0, fileIndex)
      } else {
        // Single file preview
        const file = fileSystem.getNodeByPath(filePath)
        if (file && isPreviewableFile(file)) {
          state.value.fileList = [file]
          state.value.currentIndex = 0
        } else {
          throw new Error('File is not previewable')
        }
      }
      
      state.value.currentFilePath = filePath
      state.value.isVisible = true
      
      // Preload adjacent files if enabled
      if (config.preloadAdjacentFiles) {
        preloadAdjacentFiles()
      }
      
      haptic.light()
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : 'Failed to open preview'
    } finally {
      state.value.isLoading = false
    }
  }

  const closePreview = () => {
    state.value.isVisible = false
    state.value.currentFilePath = null
    state.value.fileList = []
    state.value.currentIndex = 0
    state.value.error = null
    state.value.preloadedFiles.clear()
    haptic.light()
  }

  const navigateToFile = async (index: number) => {
    if (index < 0 || index >= state.value.fileList.length) return
    if (index === state.value.currentIndex) return

    const targetFile = state.value.fileList[index]
    if (!targetFile) return

    state.value.currentIndex = index
    state.value.currentFilePath = targetFile.path
    
    // Preload adjacent files
    if (config.preloadAdjacentFiles) {
      preloadAdjacentFiles()
    }
    
    haptic.light()
  }

  const navigatePrevious = async () => {
    if (canNavigatePrevious.value) {
      await navigateToFile(state.value.currentIndex - 1)
    }
  }

  const navigateNext = async () => {
    if (canNavigateNext.value) {
      await navigateToFile(state.value.currentIndex + 1)
    }
  }

  const preloadAdjacentFiles = async () => {
    const currentIndex = state.value.currentIndex
    const fileList = state.value.fileList
    
    // Determine files to preload
    const filesToPreload: FileSystemNode[] = []
    
    for (let i = 1; i <= config.maxPreloadDistance; i++) {
      // Previous files
      const prevIndex = currentIndex - i
      if (prevIndex >= 0) {
        filesToPreload.push(fileList[prevIndex]!)
      }
      
      // Next files
      const nextIndex = currentIndex + i
      if (nextIndex < fileList.length) {
        filesToPreload.push(fileList[nextIndex]!)
      }
    }
    
    // Preload files that aren't already cached
    for (const file of filesToPreload) {
      if (!state.value.preloadedFiles.has(file.path)) {
        try {
          const content = await fileSystem.readFile(file.path)
          state.value.preloadedFiles.set(file.path, content.content)
        } catch (error) {
          // Silently fail preloading
          console.warn(`Failed to preload file: ${file.path}`, error)
        }
      }
    }
  }

  const getPreloadedContent = (filePath: string): string | null => {
    return state.value.preloadedFiles.get(filePath) || null
  }

  const openFileInDirectory = async (filePath: string) => {
    try {
      // Get the parent directory
      const parentPath = fileSystem.getParentPath(filePath)
      
      // Load directory contents
      const parentNode = fileSystem.getNodeByPath(parentPath)
      if (!parentNode || !parentNode.children) {
        // Try to expand the directory to get its contents
        await fileSystem.expandNode(parentPath)
        const updatedParent = fileSystem.getNodeByPath(parentPath)
        if (!updatedParent?.children) {
          throw new Error('Could not load directory contents')
        }
      }
      
      const directoryFiles = parentNode?.children || []
      await openPreview(filePath, directoryFiles)
    } catch (error) {
      // Fallback to single file preview
      await openPreview(filePath)
    }
  }

  const refreshCurrentFile = async () => {
    if (!state.value.currentFilePath) return
    
    try {
      state.value.isLoading = true
      
      // Remove from preload cache to force refresh
      state.value.preloadedFiles.delete(state.value.currentFilePath)
      
      // The preview component will handle reloading the file
      haptic.light()
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : 'Failed to refresh file'
    } finally {
      state.value.isLoading = false
    }
  }

  const shareCurrentFile = async () => {
    if (!currentFile.value) return
    
    try {
      // Check if Web Share API is available
      if (!('share' in navigator)) {
        throw new Error('Sharing not supported on this device')
      }
      
      // Get file content
      const content = getPreloadedContent(currentFile.value.path) || 
                    (await fileSystem.readFile(currentFile.value.path)).content
      
      const shareData = {
        title: currentFile.value.name,
        text: `Sharing file: ${currentFile.value.name}`,
        files: [
          new File([content], currentFile.value.name, {
            type: getMimeType(currentFile.value.path)
          })
        ]
      }
      
      await navigator.share(shareData)
      haptic.light()
    } catch (error) {
      console.error('Failed to share file:', error)
      // Could show a toast notification here
    }
  }

  const getMimeType = (filePath: string): string => {
    const extension = fileSystem.getFileExtension(filePath)
    const mimeTypes: Record<string, string> = {
      // Text files
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json',
      'xml': 'application/xml',
      'csv': 'text/csv',
      'log': 'text/plain',
      
      // Code files
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'html': 'text/html',
      'css': 'text/css',
      'py': 'text/x-python',
      'java': 'text/x-java-source',
      'cpp': 'text/x-c++src',
      'c': 'text/x-csrc',
      'php': 'text/x-php',
      'rb': 'text/x-ruby',
      'go': 'text/x-go',
      'rs': 'text/x-rust',
      'swift': 'text/x-swift',
      'sh': 'text/x-shellscript',
      
      // Images
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon'
    }
    
    return mimeTypes[extension] || 'text/plain'
  }

  // Keyboard shortcuts
  const handleKeyboardShortcut = (event: KeyboardEvent) => {
    if (!state.value.isVisible) return
    
    switch (event.key) {
      case 'Escape':
        closePreview()
        event.preventDefault()
        break
      case 'ArrowLeft':
        if (canNavigatePrevious.value) {
          navigatePrevious()
          event.preventDefault()
        }
        break
      case 'ArrowRight':
        if (canNavigateNext.value) {
          navigateNext()
          event.preventDefault()
        }
        break
      case 'r':
        if (event.metaKey || event.ctrlKey) {
          refreshCurrentFile()
          event.preventDefault()
        }
        break
      case 's':
        if (event.metaKey || event.ctrlKey) {
          shareCurrentFile()
          event.preventDefault()
        }
        break
    }
  }

  // Watch for file system changes
  watch(() => fileSystem.fileTree.value.nodes, () => {
    // Update file list if files have changed
    if (state.value.isVisible && state.value.fileList.length > 0) {
      const updatedFileList = state.value.fileList.map(file => {
        const updatedFile = fileSystem.getNodeByPath(file.path)
        return updatedFile || file
      }).filter(file => fileSystem.exists(file.path))
      
      if (updatedFileList.length !== state.value.fileList.length) {
        state.value.fileList = updatedFileList
        
        // Adjust current index if necessary
        if (state.value.currentIndex >= updatedFileList.length) {
          state.value.currentIndex = Math.max(0, updatedFileList.length - 1)
        }
      }
    }
  })

  return {
    // State
    state: computed(() => state.value),
    currentFile,
    canNavigatePrevious,
    canNavigateNext,

    // Methods
    openPreview,
    closePreview,
    navigateToFile,
    navigatePrevious,
    navigateNext,
    openFileInDirectory,
    refreshCurrentFile,
    shareCurrentFile,
    getPreloadedContent,
    isPreviewableFile,
    getPreviewableFiles,
    handleKeyboardShortcut,

    // Configuration
    config: computed(() => config)
  }
}

// Global instance for app-wide use
let globalMobileFilePreview: ReturnType<typeof useMobileFilePreview> | null = null

export function useGlobalMobileFilePreview(options?: MobileFilePreviewOptions) {
  if (!globalMobileFilePreview) {
    globalMobileFilePreview = useMobileFilePreview(options)
  }
  return globalMobileFilePreview
}