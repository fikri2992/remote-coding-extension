/**
 * Type definitions for CLI File System Service
 */

export interface FileSystemServiceConfig {
  // Workspace settings
  workspaceRoot: string;
  allowedPaths: string[];
  deniedPaths: string[];
  
  // File operation limits
  maxTextFileSize: number;         // 1MB default
  maxBinaryFileSize: number;       // 100MB default
  maxTreeDepth: number;            // 10 levels default
  maxFilesPerDirectory: number;   // 1000 files default
  
  // Security settings
  enablePathValidation: boolean;
  requireWorkspaceContainment: boolean;
  allowSymlinks: boolean;
  allowHiddenFiles: boolean;
  
  // Watcher settings
  enableFileWatching: boolean;
  maxWatchersPerClient: number;
  watcherDebounceMs: number;
  
  // Performance settings
  enableCaching: boolean;
  cacheTimeoutMs: number;
  enableParallelOperations: boolean;

  // Ignore settings
  useGitIgnore?: boolean;             // default: true
  gitIgnoreFile?: string;             // optional explicit .gitignore path
  defaultIgnoreGlobs?: string[];      // additional defaults (e.g., vendor/)
  
  // Debug and logging
  enableDebug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileNode[];
}

export interface FileOperationOptions {
  type?: 'file' | 'directory';
  recursive?: boolean;
  encoding?: string;
  overwrite?: boolean;
}

export interface PathResolutionOptions {
  workspaceRoot?: string;
  allowAbsolute?: boolean;
  allowRelative?: boolean;
  requireWorkspaceContainment?: boolean;
  followSymlinks?: boolean;
}

export interface PathResolutionResult {
  resolvedPath: string;
  normalizedPath: string;
  isValid: boolean;
  error?: string;
}

export interface FileInfo {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size: number;
  modified: Date;
  permissions: string;
}

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  risk: 'none' | 'low' | 'medium' | 'high' | 'critical';
  suggestions?: string[];
}

export interface FileWatcherEvent {
  type: 'create' | 'change' | 'delete' | 'rename';
  path: string;
  timestamp: number;
  size?: number;
  isDirectory?: boolean;
}

export interface TreeResult {
  path: string;
  children: FileNode[];
}

export interface FileReadResult {
  path: string;
  content: string;
  encoding: 'utf8';
  truncated: boolean;
  size: number;
}
