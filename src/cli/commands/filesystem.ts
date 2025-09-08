/**
 * CLI File System Commands
 */

import { Command } from 'commander';
import { CLIFileSystemService } from '../services/FileSystemService';
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
    const fsService = new CLIFileSystemService((clientId, msg) => {
      console.log(JSON.stringify(msg));
      return true;
    }, config.config);
    
    try {
      const result = await fsService.getTree(targetPath, parseInt(options.depth));
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`📁 Tree for: ${result.path}`);
        printTree(result.children, 0);
      }
    } catch (error) {
      console.error('❌ Failed to get directory tree:', error instanceof Error ? error.message : String(error));
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
    const fsService = new CLIFileSystemService((clientId, msg) => {
      console.log(JSON.stringify(msg));
      return true;
    }, config.config);
    
    try {
      const result = await fsService.openFile(filePath, {
        encoding: options.encoding,
        maxLength: parseInt(options.maxBytes)
      });
      
      console.log(`📖 File: ${result.path}`);
      console.log(`   Size: ${formatBytes(result.size)}${result.truncated ? ' (truncated)' : ''}`);
      console.log(`   Encoding: ${result.encoding}`);
      console.log('--- Content ---');
      console.log(result.content);
    } catch (error) {
      console.error('❌ Failed to read file:', error instanceof Error ? error.message : String(error));
    }
  });

// File create command
filesystemCommand
  .command('create')
  .description('Create file or directory')
  .argument('<path>', 'File or directory path')
  .option('--type <type>', 'Type to create (file|directory)', 'file')
  .option('--content <content>', 'File content (for files)')
  .action(async (filePath, options) => {
    const config = new FileSystemConfigManager();
    const fsService = new CLIFileSystemService((clientId, msg) => {
      console.log(JSON.stringify(msg));
      return true;
    }, config.config);
    
    try {
      await fsService.createFile(filePath, options.content, { type: options.type as 'file' | 'directory' });
      console.log(`✅ Created ${options.type}: ${filePath}`);
    } catch (error) {
      console.error('❌ Failed to create file/directory:', error instanceof Error ? error.message : String(error));
    }
  });

// File delete command
filesystemCommand
  .command('delete')
  .description('Delete file or directory')
  .argument('<path>', 'File or directory path')
  .option('--recursive', 'Delete recursively (for directories)', false)
  .action(async (filePath, options) => {
    const config = new FileSystemConfigManager();
    const fsService = new CLIFileSystemService((clientId, msg) => {
      console.log(JSON.stringify(msg));
      return true;
    }, config.config);
    
    try {
      await fsService.deleteFile(filePath, { recursive: options.recursive });
      console.log(`✅ Deleted: ${filePath}`);
    } catch (error) {
      console.error('❌ Failed to delete file/directory:', error instanceof Error ? error.message : String(error));
    }
  });

// File rename command
filesystemCommand
  .command('rename')
  .description('Rename file or directory')
  .argument('<source>', 'Source path')
  .argument('<destination>', 'Destination path')
  .action(async (sourcePath, destPath) => {
    const config = new FileSystemConfigManager();
    const fsService = new CLIFileSystemService((clientId, msg) => {
      console.log(JSON.stringify(msg));
      return true;
    }, config.config);
    
    try {
      await fsService.renameFile(sourcePath, destPath);
      console.log(`✅ Renamed: ${sourcePath} -> ${destPath}`);
    } catch (error) {
      console.error('❌ Failed to rename file/directory:', error instanceof Error ? error.message : String(error));
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
    const fsService = new CLIFileSystemService((clientId, msg) => {
      const event = msg.data;
      console.log(`👁️  ${event.kind.toUpperCase()}: ${event.path}`);
      return true;
    }, config.config);
    
    try {
      await fsService.addWatcher('cli', watchPath);
      console.log(`👁️  Watching: ${watchPath}`);
      
      // Watch for specified timeout
      await new Promise(resolve => setTimeout(resolve, parseInt(options.timeout) * 1000));
      
      console.log('⏹️  Watch completed');
    } catch (error) {
      console.error('❌ Failed to watch path:', error instanceof Error ? error.message : String(error));
    }
  });

// File stats command
filesystemCommand
  .command('stats')
  .description('Show file or directory statistics')
  .argument('<path>', 'File or directory path')
  .action(async (targetPath) => {
    const config = new FileSystemConfigManager();
    const fsService = new CLIFileSystemService((clientId, msg) => {
      console.log(JSON.stringify(msg));
      return true;
    }, config.config);
    
    try {
      const info = await fsService.getFileStats(targetPath);
      
      console.log(`📊 Stats for: ${targetPath}`);
      console.log(`   Exists: ${info.exists}`);
      console.log(`   Type: ${info.isFile ? 'File' : info.isDirectory ? 'Directory' : 'Other'}`);
      console.log(`   Size: ${formatBytes(info.size)}`);
      console.log(`   Modified: ${info.modified.toISOString()}`);
      console.log(`   Permissions: ${info.permissions}`);
      console.log(`   Symbolic Link: ${info.isSymbolicLink}`);
    } catch (error) {
      console.error('❌ Failed to get file stats:', error instanceof Error ? error.message : String(error));
    }
  });

// Config command
filesystemCommand
  .command('config')
  .description('Show or update filesystem configuration')
  .option('--json', 'Output as JSON')
  .option('--save <path>', 'Save configuration to file')
  .action(async (options) => {
    const config = new FileSystemConfigManager();
    
    if (options.json) {
      console.log(JSON.stringify(config.getConfig(), null, 2));
    } else {
      const cfg = config.getConfig();
      console.log('📋 File System Configuration:');
      console.log(`   Workspace Root: ${cfg.workspaceRoot}`);
      console.log(`   Max Text File Size: ${formatBytes(cfg.maxTextFileSize)}`);
      console.log(`   Max Binary File Size: ${formatBytes(cfg.maxBinaryFileSize)}`);
      console.log(`   Max Tree Depth: ${cfg.maxTreeDepth}`);
      console.log(`   Max Files Per Directory: ${cfg.maxFilesPerDirectory}`);
      console.log(`   Path Validation: ${cfg.enablePathValidation}`);
      console.log(`   Workspace Containment: ${cfg.requireWorkspaceContainment}`);
      console.log(`   Allow Symlinks: ${cfg.allowSymlinks}`);
      console.log(`   Allow Hidden Files: ${cfg.allowHiddenFiles}`);
      console.log(`   File Watching: ${cfg.enableFileWatching}`);
      console.log(`   Max Watchers Per Client: ${cfg.maxWatchersPerClient}`);
      console.log(`   Watcher Debounce: ${cfg.watcherDebounceMs}ms`);
      console.log(`   Caching: ${cfg.enableCaching}`);
      console.log(`   Cache Timeout: ${cfg.cacheTimeoutMs}ms`);
      console.log(`   Parallel Operations: ${cfg.enableParallelOperations}`);
      console.log(`   Debug: ${cfg.enableDebug}`);
      console.log(`   Log Level: ${cfg.logLevel}`);
    }

    if (options.save) {
      config.saveConfig(options.save);
    }
  });

// Watcher stats command
filesystemCommand
  .command('watcher-stats')
  .description('Show file watcher statistics')
  .action(async () => {
    const config = new FileSystemConfigManager();
    const fsService = new CLIFileSystemService((clientId, msg) => {
      return true;
    }, config.config);
    
    try {
      const stats = fsService.getWatcherStats();
      
      console.log('📈 File Watcher Statistics:');
      console.log(`   Total Clients: ${stats.totalClients}`);
      console.log(`   Total Watchers: ${stats.totalWatchers}`);
      
      if (stats.clientStats.length > 0) {
        console.log('   Client Watchers:');
        stats.clientStats.forEach(stat => {
          console.log(`     ${stat.clientId}: ${stat.watcherCount} watchers`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to get watcher stats:', error instanceof Error ? error.message : String(error));
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
