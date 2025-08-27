import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileNode, EditorInfo, GitStatus, WorkspaceInfo } from '../types/workspace'

export const useWorkspaceStore = defineStore('workspace', () => {
  // State
  const workspaceFolders = ref<string[]>([])
  const activeEditor = ref<EditorInfo | null>(null)
  const openEditors = ref<string[]>([])
  const recentFiles = ref<string[]>([])
  const fileTree = ref<FileNode[]>([])
  const gitStatus = ref<GitStatus | null>(null)

  // Actions
  const updateWorkspaceInfo = (info: WorkspaceInfo) => {
    workspaceFolders.value = info.workspaceFolders || []
    if (info.activeEditor) {
      activeEditor.value = info.activeEditor
    }
    if (info.openEditors) {
      openEditors.value = info.openEditors
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

  return {
    // State
    workspaceFolders,
    activeEditor,
    openEditors,
    recentFiles,
    fileTree,
    gitStatus,
    // Actions
    updateWorkspaceInfo,
    updateFileTree,
    updateGitStatus,
    setActiveEditor
  }
})
