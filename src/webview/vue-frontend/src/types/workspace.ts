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

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFile[]
  unstaged: GitFile[]
  untracked: string[]
  hasChanges: boolean
}

export interface GitFile {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | 'C'
  staged: boolean
}

export interface CommitInfo {
  hash: string
  message: string
  author: string
  date: Date
  files: GitFile[]
}