/**
 * File System Configuration Manager for CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileSystemServiceConfig } from './FileSystemTypes';

export class FileSystemConfigManager {
  public config: FileSystemServiceConfig;

  constructor(configPath?: string, envVars: NodeJS.ProcessEnv = process.env) {
    this.config = this.loadConfig(configPath, envVars);
  }

  private loadConfig(configPath?: string, envVars: NodeJS.ProcessEnv = process.env): FileSystemServiceConfig {
    const defaultConfig: FileSystemServiceConfig = {
      workspaceRoot: envVars.PWD || process.cwd(),
      allowedPaths: [],
      deniedPaths: [
        '/etc', '/usr', '/bin', '/sbin', '/proc', '/sys', // System directories
        '~/.ssh', '~/.aws', '~/.config'                   // Sensitive directories
      ],
      maxTextFileSize: 1024 * 1024,        // 1MB
      maxBinaryFileSize: 100 * 1024 * 1024, // 100MB
      maxTreeDepth: 10,
      maxFilesPerDirectory: 1000,
      enablePathValidation: true,
      requireWorkspaceContainment: true,
      allowSymlinks: false,
      allowHiddenFiles: true,
      enableFileWatching: true,
      maxWatchersPerClient: 50,
      watcherDebounceMs: 100,
      enableCaching: true,
      cacheTimeoutMs: 5000,
      enableParallelOperations: true,
      enableDebug: envVars.KIRO_FS_DEBUG === '1',
      logLevel: 'info'
    };

    // Load from config file if provided
    if (configPath) {
      try {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(configData);
        return { ...defaultConfig, ...userConfig };
      } catch (error) {
        console.warn(`Failed to load filesystem config from ${configPath}:`, error);
      }
    }

    return defaultConfig;
  }

  isPathAllowed(filePath: string): boolean {
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

  isPathInWorkspace(filePath: string): boolean {
    if (!this.config.requireWorkspaceContainment) return true;
    
    const resolvedPath = path.resolve(filePath);
    const resolvedWorkspace = path.resolve(this.config.workspaceRoot);
    
    return resolvedPath.startsWith(resolvedWorkspace);
  }

  updateConfig(updates: Partial<FileSystemServiceConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  saveConfig(configPath: string): void {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(configPath, configData, 'utf-8');
      console.log(`Configuration saved to ${configPath}`);
    } catch (error) {
      console.error(`Failed to save configuration to ${configPath}:`, error);
    }
  }

  getConfig(): FileSystemServiceConfig {
    return { ...this.config };
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate workspace root
    if (!this.config.workspaceRoot || typeof this.config.workspaceRoot !== 'string') {
      errors.push('Workspace root must be a valid string path');
    }

    // Validate file sizes
    if (this.config.maxTextFileSize <= 0) {
      errors.push('Max text file size must be positive');
    }

    if (this.config.maxBinaryFileSize <= 0) {
      errors.push('Max binary file size must be positive');
    }

    if (this.config.maxTextFileSize > this.config.maxBinaryFileSize) {
      errors.push('Max text file size cannot be larger than max binary file size');
    }

    // Validate limits
    if (this.config.maxTreeDepth <= 0) {
      errors.push('Max tree depth must be positive');
    }

    if (this.config.maxFilesPerDirectory <= 0) {
      errors.push('Max files per directory must be positive');
    }

    if (this.config.maxWatchersPerClient <= 0) {
      errors.push('Max watchers per client must be positive');
    }

    if (this.config.watcherDebounceMs < 0) {
      errors.push('Watcher debounce time cannot be negative');
    }

    if (this.config.cacheTimeoutMs < 0) {
      errors.push('Cache timeout cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
