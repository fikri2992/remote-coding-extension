/**
 * CLI File System Service - Enhanced filesystem operations with security and WebSocket integration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  FileSystemServiceConfig, 
  FileNode, 
  TreeResult, 
  FileReadResult, 
  FileOperationOptions,
  PathResolutionOptions,
  SecurityCheckResult
} from './FileSystemTypes';
import { FileSystemConfigManager } from './FileSystemConfig';
import { PathResolver } from './PathResolver';
import { FileSystemSecurityManager } from './FileSystemSecurity';
import { FileWatcherManager } from './FileWatcher';
import { GitIgnoreFilter } from './GitIgnoreFilter';

type SendFn = (clientId: string, message: any) => boolean;

export class CLIFileSystemService {
  private sendToClient: SendFn;
  private config: FileSystemServiceConfig;
  private pathResolver: PathResolver;
  private securityManager: FileSystemSecurityManager;
  private fileWatcher: FileWatcherManager;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private ignoreFilter: GitIgnoreFilter | null = null;

  constructor(sendFn: SendFn, config?: FileSystemServiceConfig) {
    this.sendToClient = sendFn;
    this.config = config || new FileSystemConfigManager().config;
    this.pathResolver = new PathResolver(this.config);
    this.securityManager = new FileSystemSecurityManager(this.config);
    this.fileWatcher = new FileWatcherManager(this.config);

    // Initialize .gitignore filter if enabled
    try {
      if (this.config.useGitIgnore !== false) {
        const wsRoot = this.config.workspaceRoot || process.cwd();
        const extra = Array.isArray(this.config.defaultIgnoreGlobs) ? this.config.defaultIgnoreGlobs : [];
        this.ignoreFilter = new GitIgnoreFilter(wsRoot, extra);
      }
    } catch {}

    // Set up file watcher event handling
    this.fileWatcher.on('fileEvent', ({ clientId, event }) => {
      this.sendToClient(clientId, {
        type: 'fileSystem',
        data: {
          event: 'watch',
          kind: event.type,
          path: event.path,
          timestamp: event.timestamp,
          size: event.size,
          isDirectory: event.isDirectory
        }
      });
    });
  }

  /** Handle an incoming WS message for fileSystem */
  public async handle(clientId: string, message: any): Promise<void> {
    const id = message.id;
    const data = message.data?.fileSystemData || (message.data as any);
    const op = data?.operation as string;

    console.log(`[FS Service] Handling operation: ${op}, path: ${data?.path}, clientId: ${clientId}`);
    console.log(`[FS Service] Workspace root: ${this.config.workspaceRoot}`);

    try {
      let result;
      
      switch (op) {
        case 'tree': {
          const target = data?.path || '.';
          const opts = (data?.options || {}) as { allowHiddenFiles?: boolean; useGitIgnore?: boolean; depth?: number };
          const depth = typeof opts.depth === 'number' ? opts.depth : undefined;
          const flags: { allowHiddenFiles?: boolean; useGitIgnore?: boolean } = {};
          if (typeof opts.allowHiddenFiles === 'boolean') flags.allowHiddenFiles = opts.allowHiddenFiles;
          if (typeof opts.useGitIgnore === 'boolean') flags.useGitIgnore = opts.useGitIgnore;
          console.log(`[FS Service] Tree operation - target: ${target}`);
          result = await this.getTree(target, depth, flags);
          console.log(`[FS Service] Tree result:`, result ? 'success' : 'failed');
          this.reply(clientId, id, op, { ok: true, result });
          break;
        }
          
        case 'open': {
          const target = data?.path;
          if (!target) {
            throw new Error('File path is required for open operation');
          }
          result = await this.openFile(target);
          this.reply(clientId, id, op, { ok: true, result });
          break;
        }
          
        case 'create': {
          const target = data?.path;
          const content = data?.content;
          const options = data?.options || {};
          
          if (!target) {
            throw new Error('File path is required for create operation');
          }
          
          await this.createFile(target, content, options);
          this.reply(clientId, id, op, { ok: true });
          break;
        }
          
        case 'delete': {
          const target = data?.path;
          const options = data?.options || {};
          
          if (!target) {
            throw new Error('File path is required for delete operation');
          }
          
          await this.deleteFile(target, options);
          this.reply(clientId, id, op, { ok: true });
          break;
        }
          
        case 'rename': {
          const target = data?.path;
          const options = data?.options || {};
          
          if (!target || !options.newPath) {
            throw new Error('Both source and destination paths are required for rename operation');
          }
          
          await this.renameFile(target, options.newPath);
          this.reply(clientId, id, op, { ok: true });
          break;
        }
          
        case 'watch': {
          const target = data?.path;
          if (!target) {
            throw new Error('Watch path is required for watch operation');
          }
          
          const success = await this.addWatcher(clientId, target);
          this.reply(clientId, id, op, { ok: success });
          break;
        }
          
        case 'unwatch': {
          const target = data?.path;
          if (!target) {
            throw new Error('Watch path is required for unwatch operation');
          }
          
          const success = this.removeWatcher(clientId, target);
          this.reply(clientId, id, op, { ok: success });
          break;
        }

        case 'stats': {
          const target = data?.path;
          if (!target) {
            throw new Error('File path is required for stats operation');
          }
          
          result = await this.getFileStats(target);
          this.reply(clientId, id, op, { ok: true, result });
          break;
        }

        default: {
          throw new Error(`Unsupported fileSystem operation: ${op}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.reply(clientId, id, op || 'unknown', { ok: false, error: msg });
    }
  }

  /** Dispose watchers for a client on disconnect */
  public onClientDisconnect(clientId: string) {
    this.fileWatcher.removeAllClientWatchers(clientId);
  }

  // --- Public API Methods ---

  async getTree(targetPath: string, maxDepth?: number, flags?: { allowHiddenFiles?: boolean; useGitIgnore?: boolean }): Promise<TreeResult> {
    console.log(`[FS Service] getTree called with targetPath: "${targetPath}" (type: ${typeof targetPath})`);
    const resolved = await this.pathResolver.resolvePath(targetPath);
    console.log(`[FS Service] Path resolution result:`, {
      inputPath: targetPath,
      isValid: resolved.isValid,
      resolvedPath: resolved.resolvedPath,
      normalizedPath: resolved.normalizedPath,
      error: resolved.error
    });
    
    if (!resolved.isValid) {
      console.log(`[FS Service] Path resolution failed for "${targetPath}": ${resolved.error}`);
      throw new Error(`Invalid path: ${resolved.error}`);
    }

    const cacheKey = `tree:${resolved.resolvedPath}:${maxDepth || 'default'}`;
    if (this.config.enableCaching) {
      const cached = this.getFromCache<TreeResult>(cacheKey);
      if (cached) return cached;
    }

    const result = await this.buildTree(resolved.resolvedPath, maxDepth || this.config.maxTreeDepth, 0, flags);
    
    if (this.config.enableCaching) {
      this.setCache(cacheKey, result);
    }

    return result;
  }

  async openFile(filePath: string, options?: { encoding?: string; maxLength?: number }): Promise<FileReadResult> {
    const resolved = await this.pathResolver.resolvePath(filePath);
    if (!resolved.isValid) {
      throw new Error(`Invalid file path: ${resolved.error}`);
    }

    // Security check
    const securityCheck = await this.securityManager.checkPathSafety(resolved.resolvedPath, 'read');
    if (!securityCheck.allowed) {
      throw new Error(`Security check failed: ${securityCheck.reason}`);
    }

    const cacheKey = `file:${resolved.resolvedPath}`;
    if (this.config.enableCaching) {
      const cached = this.getFromCache<FileReadResult>(cacheKey);
      if (cached) return cached;
    }

    const stats = await fs.stat(resolved.resolvedPath);
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    const size = Number(stats.size);
    const maxLength = options?.maxLength || this.config.maxTextFileSize;
    const truncated = size > maxLength;
    
    const bytes = await fs.readFile(resolved.resolvedPath);
    const slice = truncated ? bytes.slice(0, maxLength) : bytes;
    const content = slice.toString(options?.encoding as BufferEncoding || 'utf8');

    const result: FileReadResult = {
      path: await this.pathResolver.resolveRelativePath(resolved.resolvedPath),
      content,
      encoding: 'utf8',
      truncated,
      size
    };

    if (this.config.enableCaching) {
      this.setCache(cacheKey, result);
    }

    return result;
  }

  async createFile(filePath: string, content?: string | Uint8Array, options?: FileOperationOptions): Promise<void> {
    const resolved = await this.pathResolver.resolvePath(filePath);
    if (!resolved.isValid) {
      throw new Error(`Invalid file path: ${resolved.error}`);
    }

    // Security check
    const securityCheck = await this.securityManager.checkFileOperationSafety('create', resolved.resolvedPath);
    if (!securityCheck.allowed) {
      throw new Error(`Security check failed: ${securityCheck.reason}`);
    }

    const isDir = options?.type === 'directory';
    let parentDir = '';
    
    if (isDir) {
      await fs.mkdir(resolved.resolvedPath, { recursive: true });
      parentDir = path.dirname(resolved.resolvedPath);
    } else {
      // Ensure parent directory exists
      parentDir = path.dirname(resolved.resolvedPath);
      await fs.mkdir(parentDir, { recursive: true });

      let bytes: Uint8Array;
      if (typeof content === 'string') {
        bytes = Buffer.from(content, 'utf8');
      } else if (content instanceof Uint8Array) {
        bytes = content;
      } else {
        bytes = new Uint8Array();
      }

      await fs.writeFile(resolved.resolvedPath, Buffer.from(bytes));
    }

    // Clear cache for parent directory
    this.clearCacheForPath(parentDir);
  }

  async deleteFile(filePath: string, options?: FileOperationOptions): Promise<void> {
    const resolved = await this.pathResolver.resolvePath(filePath);
    if (!resolved.isValid) {
      throw new Error(`Invalid file path: ${resolved.error}`);
    }

    // Security check
    const securityCheck = await this.securityManager.checkFileOperationSafety('delete', resolved.resolvedPath);
    if (!securityCheck.allowed) {
      throw new Error(`Security check failed: ${securityCheck.reason}`);
    }

    const recursive = options?.recursive !== false;
    if (recursive) {
      await fs.rm(resolved.resolvedPath, { recursive: true, force: true });
    } else {
      await fs.unlink(resolved.resolvedPath);
    }

    // Clear cache
    this.clearCacheForPath(resolved.resolvedPath);
    const parentDir = path.dirname(resolved.resolvedPath);
    this.clearCacheForPath(parentDir);
  }

  async renameFile(sourcePath: string, destinationPath: string): Promise<void> {
    const sourceResolved = await this.pathResolver.resolvePath(sourcePath);
    const destResolved = await this.pathResolver.resolvePath(destinationPath);

    if (!sourceResolved.isValid) {
      throw new Error(`Invalid source path: ${sourceResolved.error}`);
    }
    if (!destResolved.isValid) {
      throw new Error(`Invalid destination path: ${destResolved.error}`);
    }

    // Security check
    const securityCheck = await this.securityManager.checkFileOperationSafety('rename', sourceResolved.resolvedPath, destResolved.resolvedPath);
    if (!securityCheck.allowed) {
      throw new Error(`Security check failed: ${securityCheck.reason}`);
    }

    await fs.rename(sourceResolved.resolvedPath, destResolved.resolvedPath);

    // Clear cache for both paths and their parent directories
    this.clearCacheForPath(sourceResolved.resolvedPath);
    this.clearCacheForPath(destResolved.resolvedPath);
    
    const sourceParent = path.dirname(sourceResolved.resolvedPath);
    const destParent = path.dirname(destResolved.resolvedPath);
    this.clearCacheForPath(sourceParent);
    this.clearCacheForPath(destParent);
  }

  async addWatcher(clientId: string, watchPath: string): Promise<boolean> {
    const resolved = await this.pathResolver.resolvePath(watchPath);
    if (!resolved.isValid) {
      throw new Error(`Invalid watch path: ${resolved.error}`);
    }

    // Validate watch path
    const validation = await this.fileWatcher.validateWatchPath(resolved.resolvedPath);
    if (!validation.valid) {
      throw new Error(`Invalid watch path: ${validation.error}`);
    }

    return await this.fileWatcher.addWatcher(clientId, resolved.resolvedPath);
  }

  removeWatcher(clientId: string, watchPath: string): boolean {
    return this.fileWatcher.removeWatcher(clientId, watchPath);
  }

  async getFileStats(filePath: string) {
    const resolved = await this.pathResolver.resolvePath(filePath);
    if (!resolved.isValid) {
      throw new Error(`Invalid file path: ${resolved.error}`);
    }

    return await this.pathResolver.getFileInfo(resolved.resolvedPath);
  }

  // --- Helper Methods ---

  private reply(clientId: string, id: string | undefined, operation: string, payload: any) {
    const body = {
      type: 'fileSystem',
      id,
      data: {
        operation,
        ...payload,
      },
    };
    this.sendToClient(clientId, body);
  }

  private async buildTree(absPath: string, maxDepth: number, currentDepth: number = 0, flags?: { allowHiddenFiles?: boolean; useGitIgnore?: boolean }): Promise<TreeResult> {
    if (currentDepth >= maxDepth) {
      return { path: await this.pathResolver.resolveRelativePath(absPath), children: [] };
    }

    try {
      const entries = await fs.readdir(absPath, { withFileTypes: true });
      const children: FileNode[] = [];

      for (const dirent of entries) {
        const childAbs = path.join(absPath, dirent.name);

        const allowHidden = flags?.allowHiddenFiles ?? this.config.allowHiddenFiles;
        const useGitIgnore = flags?.useGitIgnore ?? (this.config.useGitIgnore !== false);
        // Skip hidden files if not allowed
        if (!allowHidden && dirent.name.startsWith('.')) {
          continue;
        }

        // Apply .gitignore filter when available
        if (useGitIgnore && this.ignoreFilter && this.ignoreFilter.isIgnored(childAbs, dirent.isDirectory())) {
          continue;
        }
        const node: FileNode = {
          name: dirent.name,
          path: await this.pathResolver.resolveRelativePath(childAbs),
          type: dirent.isDirectory() ? 'directory' : 'file',
        };

        if (dirent.isDirectory()) {
          try {
            const stats = await fs.stat(childAbs);
            node.size = Number(stats.size);
            node.modified = new Date(Number(stats.mtime));
            
            if (currentDepth < maxDepth - 1) {
              const subtree = await this.buildTree(childAbs, maxDepth, currentDepth + 1, flags);
              node.children = subtree.children;
            }
          } catch (error) {
            // Skip directories we can't access
            continue;
          }
        } else {
          try {
            const stats = await fs.stat(childAbs);
            node.size = Number(stats.size);
            node.modified = new Date(Number(stats.mtime));
          } catch (error) {
            // Skip files we can't access
            continue;
          }
        }

        children.push(node);
      }

      return {
        path: await this.pathResolver.resolveRelativePath(absPath),
        children
      };
    } catch (error) {
      return {
        path: await this.pathResolver.resolveRelativePath(absPath),
        children: []
      };
    }
  }

  // --- Cache Management ---

  private getFromCache<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;

    if (Date.now() - cached.timestamp > this.config.cacheTimeoutMs) {
      this.cache.delete(key);
      return undefined;
    }

    return cached.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private clearCacheForPath(filePath: string): void {
    const keysToDelete: string[] = [];
    const normalizedPath = path.resolve(filePath);

    for (const key of this.cache.keys()) {
      if (key.startsWith(`tree:${normalizedPath}`) || 
          key.startsWith(`file:${normalizedPath}`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  clearAllCache(): void {
    this.cache.clear();
  }

  // --- Utility Methods ---

  getWatcherStats() {
    return this.fileWatcher.getWatcherStats();
  }

  getConfig(): FileSystemServiceConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<FileSystemServiceConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Update dependent services
    this.pathResolver = new PathResolver(this.config);
    this.securityManager = new FileSystemSecurityManager(this.config);
    
    // Restart file watcher if configuration changed significantly
    if (updates.enableFileWatching !== undefined || 
        updates.watcherDebounceMs !== undefined ||
        updates.maxWatchersPerClient !== undefined) {
      this.fileWatcher.cleanup();
      this.fileWatcher = new FileWatcherManager(this.config);
    }
  }

  cleanup(): void {
    this.fileWatcher.cleanup();
    this.clearAllCache();
  }
}
