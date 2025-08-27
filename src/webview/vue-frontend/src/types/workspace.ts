export interface FileNode {
  key: string
  label: string
  data?: {
    path: string
    name: string
    type: 'file' | 'directory'
    size?: number
    modified?: Date
  }
  children?: FileNode[]
  leaf?: boolean
}

export interface FileOperation {
  type: 'create' | 'delete' | 'rename' | 'move'
  path: string
  newPath?: string
  content?: string
}

export interface EditorInfo {
  path: string
  fileName: string
  language: string
  isDirty: boolean
  selection?: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}

export interface WorkspaceInfo {
  workspaceFolders?: string[]
  activeEditor?: EditorInfo
  openEditors?: string[]
}

import type { GitFile, GitCommit } from './git'

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFile[]
  unstaged: GitFile[]
  untracked: string[]
  hasChanges: boolean
}

// Re-export for backward compatibility
export type { GitFile, GitCommit as CommitInfo }
