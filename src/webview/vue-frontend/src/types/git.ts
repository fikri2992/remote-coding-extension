export interface GitRepository {
  path: string
  name: string
  branch: string
  remotes: GitRemote[]
}

export interface GitRemote {
  name: string
  url: string
  type: 'fetch' | 'push'
}

export interface GitBranch {
  name: string
  current: boolean
  remote?: string
  ahead: number
  behind: number
}

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: {
    name: string
    email: string
  }
  date: Date
  files: GitFile[]
}

export interface GitFile {
  path: string
  status: GitFileStatus
  staged: boolean
  additions?: number
  deletions?: number
}

export type GitFileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '??' | '!!'

export interface GitDiff {
  file: string
  hunks: GitDiffHunk[]
}

export interface GitDiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: GitDiffLine[]
}

export interface GitDiffLine {
  type: 'add' | 'remove' | 'context'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}