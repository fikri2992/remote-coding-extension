// Export all type definitions
export * from './common'
export * from './errors'
export * from './websocket'
export * from './commands'
export * from './filesystem'
export * from './git'
export * from './terminal'
export * from './chat'

// Export workspace types with renamed FileOperation to avoid conflict
export type {
  FileNode,
  EditorInfo,
  WorkspaceInfo,
  GitStatus,
  GitFile,
  CommitInfo
} from './workspace'
export type { FileOperation as WorkspaceFileOperation } from './workspace'