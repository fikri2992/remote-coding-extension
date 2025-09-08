/**
 * Enhanced Path Resolver for CLI File System Service
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  PathResolutionOptions, 
  PathResolutionResult, 
  FileInfo, 
  FileSystemServiceConfig 
} from './FileSystemTypes';

export class PathResolver {
  constructor(private config: FileSystemServiceConfig) {}

  async resolvePath(
    inputPath: string, 
    options: PathResolutionOptions = {}
  ): Promise<PathResolutionResult> {
    try {
      const workspaceRoot = options.workspaceRoot || this.config.workspaceRoot;
      const resolvedWorkspace = path.resolve(workspaceRoot);
      
      // Handle empty, null, or undefined paths
      if (!inputPath || inputPath.trim() === '') {
        return {
          resolvedPath: resolvedWorkspace,
          normalizedPath: '/',
          isValid: true
        };
      }

      // Handle special path tokens
      if (inputPath === '/' || inputPath === '\\' || inputPath === '.' || inputPath === './') {
        return {
          resolvedPath: resolvedWorkspace,
          normalizedPath: '/',
          isValid: true
        };
      }

      let resolvedPath: string;
      
      // Handle absolute paths
      if (path.isAbsolute(inputPath)) {
        if (!options.allowAbsolute && options.allowAbsolute !== undefined) {
          return {
            resolvedPath: inputPath,
            normalizedPath: inputPath,
            isValid: false,
            error: 'Absolute paths not allowed'
          };
        }
        resolvedPath = path.resolve(inputPath);
      } 
      // Handle relative paths
      else {
        if (!options.allowRelative && options.allowRelative !== undefined) {
          return {
            resolvedPath: inputPath,
            normalizedPath: inputPath,
            isValid: false,
            error: 'Relative paths not allowed'
          };
        }
        
        // Handle leading slash as workspace-relative
        if (inputPath.startsWith('/') || inputPath.startsWith('\\')) {
          resolvedPath = path.join(resolvedWorkspace, inputPath.slice(1));
        } else {
          resolvedPath = path.join(resolvedWorkspace, inputPath);
        }
      }

      // Normalize the path
      const normalizedPath = path.normalize(resolvedPath);
      
      // Check workspace containment
      const requireContainment = options.requireWorkspaceContainment ?? 
        this.config.requireWorkspaceContainment;
      
      if (requireContainment && !normalizedPath.startsWith(resolvedWorkspace)) {
        return {
          resolvedPath: normalizedPath,
          normalizedPath,
          isValid: false,
          error: 'Path outside workspace'
        };
      }

      // Check if path exists (optional)
      try {
        await fs.access(normalizedPath);
      } catch {
        // Path doesn't exist, but that might be okay for create operations
      }

      // Check path against allowed/denied lists
      if (!this.isPathAllowed(normalizedPath)) {
        return {
          resolvedPath: normalizedPath,
          normalizedPath,
          isValid: false,
          error: 'Path not allowed by security policy'
        };
      }

      // Handle symlinks
      if (this.config.allowSymlinks && options.followSymlinks) {
        try {
          const stats = await fs.stat(normalizedPath);
          if (stats.isSymbolicLink()) {
            const realPath = await fs.realpath(normalizedPath);
            return {
              resolvedPath: realPath,
              normalizedPath: normalizedPath,
              isValid: true
            };
          }
        } catch (error) {
          // Not a symlink or can't read it
        }
      }

      return {
        resolvedPath: normalizedPath,
        normalizedPath: normalizedPath.replace(/\\/g, '/'),
        isValid: true
      };
    } catch (error) {
      return {
        resolvedPath: inputPath,
        normalizedPath: inputPath,
        isValid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async resolveRelativePath(absolutePath: string): Promise<string> {
    const workspaceRoot = path.resolve(this.config.workspaceRoot);
    const resolvedPath = path.resolve(absolutePath);
    
    if (resolvedPath === workspaceRoot) {
      return '/';
    }
    
    if (resolvedPath.startsWith(workspaceRoot)) {
      const relative = resolvedPath.slice(workspaceRoot.length);
      return relative.replace(/\\/g, '/') || '/';
    }
    
    // If path is outside workspace, return absolute path
    return resolvedPath.replace(/\\/g, '/');
  }

  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(filePath);
      const lstats = await fs.lstat(filePath); // For symlink detection
      
      return {
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymbolicLink: lstats.isSymbolicLink(),
        size: stats.size,
        modified: stats.mtime,
        permissions: stats.mode.toString(8)
      };
    } catch (error) {
      return {
        exists: false,
        isFile: false,
        isDirectory: false,
        isSymbolicLink: false,
        size: 0,
        modified: new Date(),
        permissions: '0'
      };
    }
  }

  async validatePathDepth(filePath: string): Promise<{ valid: boolean; depth: number; error?: string }> {
    try {
      const resolvedPath = path.resolve(filePath);
      const depth = resolvedPath.split(path.sep).length;
      
      if (depth > this.config.maxTreeDepth) {
        return {
          valid: false,
          depth,
          error: `Path depth ${depth} exceeds maximum allowed depth ${this.config.maxTreeDepth}`
        };
      }
      
      return { valid: true, depth };
    } catch (error) {
      return {
        valid: false,
        depth: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getDirectorySize(dirPath: string): Promise<{ size: number; fileCount: number; error?: string }> {
    try {
      let totalSize = 0;
      let fileCount = 0;
      
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          fileCount++;
        } else if (entry.isDirectory()) {
          const subDirResult = await this.getDirectorySize(fullPath);
          totalSize += subDirResult.size;
          fileCount += subDirResult.fileCount;
        }
      }
      
      return { size: totalSize, fileCount };
    } catch (error) {
      return {
        size: 0,
        fileCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private isPathAllowed(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);
    
    // Check denied paths first
    for (const deniedPath of this.config.deniedPaths) {
      const resolvedDenied = path.resolve(deniedPath);
      if (resolvedPath.startsWith(resolvedDenied)) {
        return false;
      }
    }
    
    // If allowed paths are specified, check those
    if (this.config.allowedPaths.length > 0) {
      for (const allowedPath of this.config.allowedPaths) {
        const resolvedAllowed = path.resolve(allowedPath);
        if (resolvedPath.startsWith(resolvedAllowed)) {
          return true;
        }
      }
      return false;
    }
    
    return true;
  }

  async sanitizePath(inputPath: string): Promise<string> {
    // Remove any potentially dangerous characters or patterns
    let sanitized = inputPath
      .replace(/\.\./g, '') // Remove parent directory references
      .replace(/[<>:"|?*]/g, '_') // Replace invalid characters
      .replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    
    // Ensure path is not empty
    if (!sanitized) {
      sanitized = 'unnamed_path';
    }
    
    return sanitized;
  }

  async expandHomeDirectory(inputPath: string): Promise<string> {
    if (inputPath.startsWith('~')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      return inputPath.replace('~', homeDir);
    }
    return inputPath;
  }
}
