# CLI File System Service Migration Plan

## Goal
Migrate `FileSystemService.ts` from VS Code extension to standalone CLI, removing all VS Code dependencies while maintaining full filesystem operations and WebSocket integration.

## Current State Analysis

### What We Have
- ✅ Complete FileSystemService with workspace-scoped filesystem operations
- ✅ WebSocket-based file operations (tree, open, create, delete, rename, watch)
- ✅ File watching with real-time change notifications
- ✅ Workspace root resolution and path validation
- ✅ File size safety limits (1MB for text content)
- ✅ Directory tree traversal and file node generation
- ✅ File reading with UTF-8 encoding and truncation handling
- ✅ Client-specific watcher management

### What Needs to Change
- ❌ VS Code workspace root dependency (`process.cwd()` fallback)
- ❌ Enhanced CLI-specific filesystem features
- ❌ Better path resolution and validation
- ❌ Cross-platform compatibility improvements
- ❌ Enhanced security and access control

## CLI File System Service Plan

### Phase 1: Core CLI File System Service (1-2 days)

#### 1.1 Create CLI File System Service Structure
```bash
src/
├── cli/
│   └── services/
│       ├── FileSystemService.ts   # Main CLI filesystem service
│       ├── FileSystemConfig.ts    # Configuration management
│       ├── PathResolver.ts       # Path resolution and validation
│       ├── FileWatcher.ts        # File watching management
│       ├── FileSystemTypes.ts     # Type definitions
│       └── FileSystemSecurity.ts  # Security and access control
└── server/
    └── FileSystemService.ts      # Original (keep for reference)
```

#### 1.2 CLI File System Configuration Manager
Create `src/cli/services/FileSystemConfig.ts`:
```typescript
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
  
  // Debug and logging
  enableDebug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export class FileSystemConfigManager {
  private config: FileSystemServiceConfig;

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

  isPathAllowed(path: string): boolean {
    const resolvedPath = path.resolve(path);
    
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

  isPathInWorkspace(path: string): boolean {
    if (!this.config.requireWorkspaceContainment) return true;
    
    const resolvedPath = path.resolve(path);
    const resolvedWorkspace = path.resolve(this.config.workspaceRoot);
    
    return resolvedPath.startsWith(resolvedWorkspace);
  }

  // ... other config methods
}
```

#### 1.3 Enhanced Path Resolver
Create `src/cli/services/PathResolver.ts`:
```typescript
import * as path from 'path';
import * as fs from 'fs/promises';

export interface PathResolutionOptions {
  workspaceRoot?: string;
  allowAbsolute?: boolean;
  allowRelative?: boolean;
  requireWorkspaceContainment?: boolean;
  followSymlinks?: boolean;
}

export class PathResolver {
  constructor(private config: FileSystemServiceConfig) {}

  async resolvePath(
    inputPath: string, 
    options: PathResolutionOptions = {}
  ): Promise<{ resolvedPath: string; normalizedPath: string; isValid: boolean; error?: string }> {
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
      if (!this.config.isPathAllowed(normalizedPath)) {
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

  async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
    size: number;
    modified: Date;
    permissions: string;
  }> {
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
}
```

### Phase 2: Enhanced File System Features (2 days)

#### 2.1 File System Security Manager
Create `src/cli/services/FileSystemSecurity.ts`:
```typescript
import * as path from 'path';
import * as fs from 'fs/promises';

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  risk: 'none' | 'low' | 'medium' | 'high' | 'critical';
  suggestions?: string[];
}

export class FileSystemSecurityManager {
  constructor(private config: FileSystemServiceConfig) {}

  async checkPathSafety(filePath: string, operation: 'read' | 'write' | 'delete' | 'execute'): Promise<SecurityCheckResult> {
    const resolvedPath = path.resolve(filePath);
    
    // Check denied paths
    for (const deniedPath of this.config.deniedPaths) {
      const resolvedDenied = path.resolve(deniedPath);
      if (resolvedPath.startsWith(resolvedDenied)) {
        return {
          allowed: false,
          reason: `Path is in denied list: ${deniedPath}`,
          risk: 'critical',
          suggestions: ['Choose a different path', 'Update configuration to allow this path']
        };
      }
    }

    // Check system-critical paths
    const systemPaths = [
      '/etc/passwd', '/etc/shadow', '/etc/sudoers',
      '/usr/bin', '/usr/sbin', '/bin', '/sbin',
      '/proc', '/sys', '/dev'
    ];

    for (const systemPath of systemPaths) {
      if (resolvedPath === systemPath || resolvedPath.startsWith(systemPath + '/')) {
        return {
          allowed: false,
          reason: `Access to system path denied: ${systemPath}`,
          risk: 'critical',
          suggestions: ['System paths are protected', 'Use user-writable locations']
        };
      }
    }

    // Check file extensions for risky operations
    const riskyExtensions = {
      write: ['.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd', '.ps1'],
      execute: ['.exe', '.sh', '.bat', '.cmd', '.ps1', '.py', '.js']
    };

    if (operation in riskyExtensions) {
      const ext = path.extname(resolvedPath).toLowerCase();
      if (riskyExtensions[operation as keyof typeof riskyExtensions].includes(ext)) {
        return {
          allowed: false,
          reason: `Risky file extension for ${operation}: ${ext}`,
          risk: 'high',
          suggestions: [
            'Consider if this operation is necessary',
            'Use a different file extension',
            'Enable unsafe mode if required'
          ]
        };
      }
    }

    // Check file size for write operations
    if (operation === 'write') {
      try {
        const stats = await fs.stat(resolvedPath);
        if (stats.size > this.config.maxBinaryFileSize) {
          return {
            allowed: false,
            reason: `File too large: ${stats.size} bytes`,
            risk: 'medium',
            suggestions: [
              'Use a smaller file',
              'Increase size limits in configuration',
              'Compress the file first'
            ]
          };
        }
      } catch {
        // File doesn't exist yet, which is fine for write operations
      }
    }

    // Check hidden files
    const fileName = path.basename(resolvedPath);
    if (fileName.startsWith('.') && !this.config.allowHiddenFiles) {
      return {
        allowed: false,
        reason: 'Hidden files are not allowed',
        risk: 'low',
        suggestions: [
          'Enable hidden files in configuration',
          'Use a different filename'
        ]
      };
    }

    // Check for potential path traversal attacks
    if (resolvedPath.includes('..') && !this.config.enablePathValidation) {
      return {
        allowed: false,
        reason: 'Path traversal detected',
        risk: 'high',
        suggestions: [
          'Use absolute paths',
          'Enable proper path validation',
          'Sanitize input paths'
        ]
      };
    }

    return {
      allowed: true,
      risk: 'none'
    };
  }

  async sanitizeFileName(fileName: string): Promise<string> {
    // Remove or replace dangerous characters
    const dangerousChars = /[<>:"/\\|?*\x00-\x1F]/g;
    let sanitized = fileName.replace(dangerousChars, '_');
    
    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[. ]+|[. ]+$/g, '');
    
    // Prevent reserved filenames (Windows)
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    
    const baseName = path.parse(sanitized).name.toUpperCase();
    if (reservedNames.includes(baseName)) {
      sanitized = `_${sanitized}`;
    }
    
    // Ensure filename is not empty
    if (!sanitized) {
      sanitized = 'unnamed_file';
    }
    
    return sanitized;
  }

  async checkDirectorySafety(dirPath: string): Promise<SecurityCheckResult> {
    const resolvedPath = path.resolve(dirPath);
    
    // Check if directory exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return {
          allowed: false,
          reason: 'Path is not a directory',
          risk: 'medium',
          suggestions: ['Check the path and try again']
        };
      }
    } catch {
      // Directory doesn't exist, which might be fine for create operations
    }

    // Check for excessive nesting
    const depth = resolvedPath.split(path.sep).length;
    if (depth > this.config.maxTreeDepth) {
      return {
        allowed: false,
        reason: `Directory depth too great: ${depth} levels`,
        risk: 'medium',
        suggestions: [
          'Use a shallower directory structure',
          'Increase max depth in configuration'
        ]
      };
    }

    // Check for too many files in directory
    try {
      const files = await fs.readdir(resolvedPath);
      if (files.length > this.config.maxFilesPerDirectory) {
        return {
          allowed: false,
          reason: `Too many files in directory: ${files.length}`,
          risk: 'low',
          suggestions: [
            'Organize files into subdirectories',
            'Increase file limit in configuration'
          ]
        };
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return {
      allowed: true,
      risk: 'none'
    };
  }
}
```

#### 2.2 Enhanced File Watcher Manager
Create `src/cli/services/FileWatcher.ts`:
```typescript
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface FileWatcherEvent {
  type: 'create' | 'change' | 'delete' | 'rename';
  path: string;
  timestamp: number;
  size?: number;
  isDirectory?: boolean;
}

export class FileWatcherManager extends EventEmitter {
  private watchersByClient: Map<string, Map<string, fs.FSWatcher>> = new Map();
  private config: FileSystemServiceConfig;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: FileSystemServiceConfig) {
    super();
    this.config = config;
  }

  async addWatcher(clientId: string, watchPath: string): Promise<boolean> {
    if (!this.config.enableFileWatching) {
      return false;
    }

    // Check if client has too many watchers
    const clientWatchers = this.watchersByClient.get(clientId);
    if (clientWatchers && clientWatchers.size >= this.config.maxWatchersPerClient) {
      return false;
    }

    try {
      const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(watchPath, filename.toString());
        this.handleFileEvent(clientId, {
          type: eventType === 'rename' ? 'change' : eventType,
          path: fullPath,
          timestamp: Date.now()
        });
      });

      watcher.on('error', (error) => {
        console.error(`File watcher error for ${watchPath}:`, error);
        this.removeWatcher(clientId, watchPath);
      });

      // Store watcher
      if (!this.watchersByClient.has(clientId)) {
        this.watchersByClient.set(clientId, new Map());
      }
      this.watchersByClient.get(clientId)!.set(watchPath, watcher);

      return true;
    } catch (error) {
      console.error(`Failed to create file watcher for ${watchPath}:`, error);
      return false;
    }
  }

  removeWatcher(clientId: string, watchPath: string): boolean {
    const clientWatchers = this.watchersByClient.get(clientId);
    if (!clientWatchers) return false;

    const watcher = clientWatchers.get(watchPath);
    if (!watcher) return false;

    try {
      watcher.close();
      clientWatchers.delete(watchPath);
      return true;
    } catch (error) {
      console.error(`Failed to close file watcher for ${watchPath}:`, error);
      return false;
    }
  }

  removeAllClientWatchers(clientId: string): void {
    const clientWatchers = this.watchersByClient.get(clientId);
    if (!clientWatchers) return;

    for (const [watchPath, watcher] of clientWatchers) {
      try {
        watcher.close();
      } catch (error) {
        console.error(`Failed to close file watcher for ${watchPath}:`, error);
      }
    }

    this.watchersByClient.delete(clientId);
  }

  private handleFileEvent(clientId: string, event: FileWatcherEvent): void {
    // Debounce events
    const debounceKey = `${clientId}:${event.path}`;
    const existingTimer = this.debounceTimers.get(debounceKey);
    
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(debounceKey);
      
      // Get file info for enhanced event data
      this.enhanceEventWithFileInfo(event).then(enhancedEvent => {
        this.emit('fileEvent', { clientId, event: enhancedEvent });
      });
    }, this.config.watcherDebounceMs);

    this.debounceTimers.set(debounceKey, timer);
  }

  private async enhanceEventWithFileInfo(event: FileWatcherEvent): Promise<FileWatcherEvent> {
    try {
      const stats = await fs.promises.stat(event.path);
      return {
        ...event,
        size: stats.size,
        isDirectory: stats.isDirectory()
      };
    } catch {
      // File might not exist (delete event)
      return event;
    }
  }

  getWatcherStats(): { totalClients: number; totalWatchers: number; clientStats: Array<{ clientId: string; watcherCount: number }> } {
    const totalClients = this.watchersByClient.size;
    let totalWatchers = 0;
    const clientStats: Array<{ clientId: string; watcherCount: number }> = [];

    for (const [clientId, watchers] of this.watchersByClient) {
      const watcherCount = watchers.size;
      totalWatchers += watcherCount;
      clientStats.push({ clientId, watcherCount });
    }

    return {
      totalClients,
      totalWatchers,
      clientStats
    };
  }
}
```

### Phase 3: CLI Integration (1 day)

#### 3.1 CLI File System Commands
Create `src/cli/commands/filesystem.ts`:
```typescript
import { Command } from 'commander';
import { FileSystemService } from '../services/FileSystemService';
import { FileSystemConfigManager } from '../services/FileSystemConfig';

export const filesystemCommand = new Command('fs')
  .description('File system operations and management')
  .option('--workspace <path>', 'Workspace path')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = new FileSystemConfigManager(undefined, {
      ...process.env,
      KIRO_FS_DEBUG: options.debug ? '1' : undefined
    });

    console.log('📁 File System Service Configuration:');
    console.log(`   Workspace Root: ${config.config.workspaceRoot}`);
    console.log(`   Max Text File Size: ${formatBytes(config.config.maxTextFileSize)}`);
    console.log(`   Max Binary File Size: ${formatBytes(config.config.maxBinaryFileSize)}`);
    console.log(`   File Watching: ${config.config.enableFileWatching}`);
    console.log(`   Debug: ${config.config.enableDebug}`);
  });

// File tree command
filesystemCommand
  .command('tree')
  .description('Show directory tree')
  .argument('[path]', 'Directory path', '.')
  .option('--depth <number>', 'Maximum depth', '5')
  .option('--json', 'Output as JSON')
  .action(async (targetPath, options) => {
    const config = new FileSystemConfigManager();
    const fsService = new FileSystemService((clientId, msg) => console.log(JSON.stringify(msg)), config.config);
    
    try {
      const result = await fsService.getTree(targetPath);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`📁 Tree for: ${result.path}`);
        printTree(result.children, 0);
      }
    } catch (error) {
      console.error('❌ Failed to get directory tree:', error.message);
    }
  });

// File read command
filesystemCommand
  .command('read')
  .description('Read file contents')
  .argument('<path>', 'File path')
  .option('--encoding <encoding>', 'File encoding', 'utf8')
  .option('--max-bytes <number>', 'Maximum bytes to read', '1024')
  .action(async (filePath, options) => {
    const config = new FileSystemConfigManager();
    const fsService = new FileSystemService((clientId, msg) => console.log(JSON.stringify(msg)), config.config);
    
    try {
      const result = await fsService.openFile(filePath);
      
      console.log(`📖 File: ${result.path}`);
      console.log(`   Size: ${formatBytes(result.size)}${result.truncated ? ' (truncated)' : ''}`);
      console.log(`   Encoding: ${result.encoding}`);
      console.log('--- Content ---');
      console.log(result.content);
    } catch (error) {
      console.error('❌ Failed to read file:', error.message);
    }
  });

// File watch command
filesystemCommand
  .command('watch')
  .description('Watch file or directory for changes')
  .argument('<path>', 'Path to watch')
  .option('--timeout <seconds>', 'Watch timeout in seconds', '60')
  .action(async (watchPath, options) => {
    const config = new FileSystemConfigManager();
    const fsService = new FileSystemService((clientId, msg) => {
      const event = msg.data;
      console.log(`👁️  ${event.kind.toUpperCase()}: ${event.path}`);
    }, config.config);
    
    try {
      await fsService.addWatcher('cli', watchPath);
      console.log(`👁️  Watching: ${watchPath}`);
      
      // Watch for specified timeout
      await new Promise(resolve => setTimeout(resolve, parseInt(options.timeout) * 1000));
      
      console.log('⏹️  Watch completed');
    } catch (error) {
      console.error('❌ Failed to watch path:', error.message);
    }
  });

// File stats command
filesystemCommand
  .command('stats')
  .description('Show file or directory statistics')
  .argument('<path>', 'File or directory path')
  .action(async (targetPath, options) => {
    const config = new FileSystemConfigManager();
    const fsService = new FileSystemService((clientId, msg) => console.log(JSON.stringify(msg)), config.config);
    
    try {
      const resolved = await fsService.pathResolver.resolvePath(targetPath);
      const info = await fsService.pathResolver.getFileInfo(resolved.resolvedPath);
      
      console.log(`📊 Stats for: ${targetPath}`);
      console.log(`   Exists: ${info.exists}`);
      console.log(`   Type: ${info.isFile ? 'File' : info.isDirectory ? 'Directory' : 'Other'}`);
      console.log(`   Size: ${formatBytes(info.size)}`);
      console.log(`   Modified: ${info.modified.toISOString()}`);
      console.log(`   Permissions: ${info.permissions}`);
      console.log(`   Symbolic Link: ${info.isSymbolicLink}`);
    } catch (error) {
      console.error('❌ Failed to get file stats:', error.message);
    }
  });

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function printTree(nodes: any[], depth: number, prefix = '') {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const currentPrefix = prefix + (isLast ? '└── ' : '├── ');
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    
    console.log(currentPrefix + (node.type === 'directory' ? '📁 ' : '📄 ') + node.name);
    
    if (node.type === 'directory' && node.children) {
      printTree(node.children, depth + 1, childPrefix);
    }
  }
}
```

#### 3.2 WebSocket Integration
Update the main CLI server to handle filesystem operations:
```typescript
// In src/cli/server.ts or WebSocket handler
import { CLIFileSystemService } from './services/FileSystemService';
import { FileSystemConfigManager } from './services/FileSystemConfig';

export class CliServer {
  private fileSystemService: CLIFileSystemService;
  private fileSystemConfig: FileSystemServiceConfig;

  constructor() {
    this.fileSystemConfig = new FileSystemConfigManager().config;
    this.fileSystemService = new CLIFileSystemService(
      (clientId: string, message: any) => this.sendToClient(clientId, message),
      this.fileSystemConfig
    );
  }

  async handleFileSystemOperation(clientId: string, message: any) {
    const { operation, ...data } = message.data;
    
    try {
      let result;
      
      switch (operation) {
        case 'tree':
          result = await this.fileSystemService.getTree(data.path);
          this.sendToClient(clientId, {
            type: 'fileSystem',
            id: message.id,
            data: { operation, result, success: true }
          });
          break;
          
        case 'open':
          result = await this.fileSystemService.openFile(data.path);
          this.sendToClient(clientId, {
            type: 'fileSystem',
            id: message.id,
            data: { operation, result, success: true }
          });
          break;
          
        case 'create':
          await this.fileSystemService.createFile(data.path, data.content, data.options);
          this.sendToClient(clientId, {
            type: 'fileSystem',
            id: message.id,
            data: { operation, success: true }
          });
          break;
          
        case 'delete':
          await this.fileSystemService.deleteFile(data.path, data.options);
          this.sendToClient(clientId, {
            type: 'fileSystem',
            id: message.id,
            data: { operation, success: true }
          });
          break;
          
        case 'rename':
          await this.fileSystemService.renameFile(data.path, data.options.newPath);
          this.sendToClient(clientId, {
            type: 'fileSystem',
            id: message.id,
            data: { operation, success: true }
          });
          break;
          
        case 'watch':
          await this.fileSystemService.addWatcher(clientId, data.path);
          this.sendToClient(clientId, {
            type: 'fileSystem',
            id: message.id,
            data: { operation, success: true }
          });
          break;
          
        default:
          throw new Error(`Unknown filesystem operation: ${operation}`);
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'fileSystem',
        id: message.id,
        data: { operation, error: error.message, success: false }
      });
    }
  }

  onClientDisconnect(clientId: string) {
    this.fileSystemService.handleClientDisconnect(clientId);
  }
}
```

### Phase 4: Testing and Validation (1 day)

#### 4.1 Test Scenarios
```typescript
// tests/filesystem-service.test.ts
import { CLIFileSystemService } from '../src/cli/services/FileSystemService';
import { FileSystemConfigManager } from '../src/cli/services/FileSystemConfig';

describe('CLIFileSystemService', () => {
  let fileSystemService: CLIFileSystemService;
  let config: FileSystemServiceConfig;
  let testDir: string;

  beforeEach(async () => {
    const configManager = new FileSystemConfigManager();
    config = configManager.config;
    testDir = createTestDirectory();
    
    fileSystemService = new CLIFileSystemService(
      (clientId, msg) => console.log(JSON.stringify(msg)),
      config
    );
  });

  afterEach(async () => {
    await cleanupTestDirectory(testDir);
  });

  test('should get directory tree', async () => {
    // Create test files and directories
    await createTestFiles(testDir);
    
    const result = await fileSystemService.getTree(testDir);
    
    expect(result.path).toBeDefined();
    expect(result.children).toBeDefined();
    expect(result.children.length).toBeGreaterThan(0);
  });

  test('should read file contents', async () => {
    const testFile = path.join(testDir, 'test.txt');
    const testContent = 'Hello, CLI File System!';
    
    await fs.promises.writeFile(testFile, testContent);
    
    const result = await fileSystemService.openFile(testFile);
    
    expect(result.path).toBeDefined();
    expect(result.content).toBe(testContent);
    expect(result.size).toBe(testContent.length);
  });

  test('should create file', async () => {
    const testFile = path.join(testDir, 'newfile.txt');
    const testContent = 'New file content';
    
    await fileSystemService.createFile(testFile, testContent, { type: 'file' });
    
    const exists = await fs.promises.access(testFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    const content = await fs.promises.readFile(testFile, 'utf8');
    expect(content).toBe(testContent);
  });

  test('should validate paths', async () => {
    const validPath = path.join(testDir, 'valid.txt');
    const invalidPath = '/etc/passwd'; // Should be denied
    
    const validResult = await fileSystemService.pathResolver.resolvePath(validPath);
    expect(validResult.isValid).toBe(true);
    
    const invalidResult = await fileSystemService.pathResolver.resolvePath(invalidPath);
    expect(invalidResult.isValid).toBe(false);
  });

  test('should handle file watching', async () => {
    const testFile = path.join(testDir, 'watchme.txt');
    const events: any[] = [];
    
    // Create mock send function
    const mockSend = (clientId: string, message: any) => {
      if (message.type === 'fileSystem' && message.data.event === 'watch') {
        events.push(message.data);
      }
    };
    
    const service = new CLIFileSystemService(mockSend, config);
    
    await service.addWatcher('test', testDir);
    await fs.promises.writeFile(testFile, 'test content');
    
    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].kind).toBe('create');
  });
});
```

#### 4.2 CLI Command Testing
```bash
# Test filesystem configuration
npm run build:cli
node ./out/cli/index.js fs config

# Test directory tree
node ./out/cli/index.js fs tree .
node ./out/cli/index.js fs tree . --depth 2 --json

# Test file reading
echo "test content" > test.txt
node ./out/cli/index.js fs read test.txt
node ./out/cli/index.js fs read test.txt --max-bytes 5

# Test file watching
node ./out/cli/index.js fs watch . --timeout 10

# Test file stats
node ./out/cli/index.js fs stats test.txt

# Test error handling
node ./out/cli/index.js fs read /nonexistent/file
node ./out/cli/index.js fs read /etc/passwd  # Should be denied
```

## Success Criteria

### Minimum Viable Product
- [ ] CLI File System service completely independent of VS Code APIs
- [ ] Basic file operations (read, write, create, delete, rename)
- [ ] Directory tree traversal and generation
- [ ] WebSocket integration for web interface
- [ ] Path resolution and validation

### Enhanced Features
- [ ] File watching with real-time notifications
- [ ] Security and access control
- [ ] Cross-platform compatibility
- [ ] Configuration management
- [ ] Performance optimization (caching, parallel operations)
- [ ] Comprehensive error handling
- [ ] CLI commands for filesystem operations

## Files to Create/Modify

### New Files
- `src/cli/services/FileSystemService.ts` - Main CLI filesystem service
- `src/cli/services/FileSystemConfig.ts` - Configuration management
- `src/cli/services/PathResolver.ts` - Path resolution and validation
- `src/cli/services/FileWatcher.ts` - File watching management
- `src/cli/services/FileSystemTypes.ts` - Type definitions
- `src/cli/services/FileSystemSecurity.ts` - Security and access control
- `src/cli/commands/filesystem.ts` - CLI filesystem commands
- `tests/filesystem-service.test.ts` - Test suite

### Modified Files
- `src/cli/server.ts` - Integrate new File System service
- `src/cli/index.ts` - Add filesystem commands
- `package.json` - Add filesystem-related dependencies

### Files to Remove
- `src/server/FileSystemService.ts` - Replace with CLI version

## Timeline
- **Day 1**: Core CLI filesystem service and configuration
- **Day 2**: Enhanced features (security, path resolution, file watching)
- **Day 3**: CLI integration and WebSocket support
- **Day 4**: Testing, validation, and documentation
- **Day 5**: Cross-platform testing and polish

## Migration Strategy

1. **Parallel Development**: Keep original FileSystemService during development
2. **Feature Parity**: Ensure all original functionality is preserved
3. **Security First**: Implement path validation and security checks before enabling operations
4. **Incremental Testing**: Test each filesystem operation independently
5. **Performance Validation**: Ensure CLI performance matches or exceeds VS Code version
6. **Cross-Platform Focus**: Test on Windows, macOS, and Linux for compatibility

This plan provides a comprehensive roadmap for migrating the File System service from VS Code extension dependencies to a fully functional, secure CLI implementation.
