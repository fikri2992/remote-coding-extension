import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FileNode, EditorInfo, GitStatus, WorkspaceInfo } from '../types/workspace'

export const useWorkspaceStore = defineStore('workspace', () => {
  // State
  const workspaceFolders = ref<string[]>([])
  const activeEditor = ref<EditorInfo | null>(null)
  const openEditors = ref<string[]>([])
  const recentFiles = ref<string[]>([])
  const fileTree = ref<FileNode[]>([])
  const gitStatus = ref<GitStatus | null>(null)
  const workspaceName = ref<string>('')
  const workspaceRoot = ref<string>('')
  const isWorkspaceOpen = ref(false)

  // Getters
  const hasActiveEditor = computed(() => activeEditor.value !== null)
  const hasOpenEditors = computed(() => openEditors.value.length > 0)
  const hasWorkspace = computed(() => workspaceFolders.value.length > 0)
  const hasGitRepository = computed(() => gitStatus.value !== null)
  const hasUncommittedChanges = computed(() => {
    if (!gitStatus.value) return false
    return gitStatus.value.staged.length > 0 || 
           gitStatus.value.unstaged.length > 0 || 
           gitStatus.value.untracked.length > 0
  })
  const totalChangedFiles = computed(() => {
    if (!gitStatus.value) return 0
    return gitStatus.value.staged.length + 
           gitStatus.value.unstaged.length + 
           gitStatus.value.untracked.length
  })

  // Actions
  const updateWorkspaceInfo = (info: WorkspaceInfo) => {
    workspaceFolders.value = info.workspaceFolders || []
    if (info.activeEditor) {
      activeEditor.value = info.activeEditor
    }
    if (info.openEditors) {
      openEditors.value = info.openEditors
    }
    
    // Update workspace status
    isWorkspaceOpen.value = workspaceFolders.value.length > 0
    if (workspaceFolders.value.length > 0) {
      const rootPath = workspaceFolders.value[0]
      if (rootPath) {
        workspaceRoot.value = rootPath
        workspaceName.value = rootPath.split('/').pop() || 'Workspace'
      }
    }
  }

  const updateFileTree = (tree: FileNode[]) => {
    fileTree.value = tree
  }

  const updateGitStatus = (status: GitStatus) => {
    gitStatus.value = status
  }

  const setActiveEditor = (editor: EditorInfo) => {
    activeEditor.value = editor

    // Add to recent files if not already present
    if (!recentFiles.value.includes(editor.path)) {
      recentFiles.value.unshift(editor.path)
      // Keep only last 10 recent files
      if (recentFiles.value.length > 10) {
        recentFiles.value = recentFiles.value.slice(0, 10)
      }
    }
  }

  const closeEditor = (path: string) => {
    const index = openEditors.value.indexOf(path)
    if (index > -1) {
      openEditors.value.splice(index, 1)
    }
    
    // If closing active editor, clear it
    if (activeEditor.value?.path === path) {
      activeEditor.value = null
    }
  }

  const addToRecentFiles = (path: string) => {
    if (!recentFiles.value.includes(path)) {
      recentFiles.value.unshift(path)
      if (recentFiles.value.length > 10) {
        recentFiles.value = recentFiles.value.slice(0, 10)
      }
    }
  }

  const clearRecentFiles = () => {
    recentFiles.value = []
  }

  const reset = () => {
    workspaceFolders.value = []
    activeEditor.value = null
    openEditors.value = []
    recentFiles.value = []
    fileTree.value = []
    gitStatus.value = null
    workspaceName.value = ''
    workspaceRoot.value = ''
    isWorkspaceOpen.value = false
  }

  return {
    // State
    workspaceFolders,
    activeEditor,
    openEditors,
    recentFiles,
    fileTree,
    gitStatus,
    workspaceName,
    workspaceRoot,
    isWorkspaceOpen,
    // Getters
    hasActiveEditor,
    hasOpenEditors,
    hasWorkspace,
    hasGitRepository,
    hasUncommittedChanges,
    totalChangedFiles,
    // Actions
    updateWorkspaceInfo,
    updateFileTree,
    updateGitStatus,
    setActiveEditor,
    closeEditor,
    addToRecentFiles,
    clearRecentFiles,
    reset
  }
})
