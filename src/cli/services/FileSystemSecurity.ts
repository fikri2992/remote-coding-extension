/**
 * File System Security Manager for CLI
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { FileSystemServiceConfig, SecurityCheckResult } from './FileSystemTypes';

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

  async checkFileOperationSafety(
    operation: 'read' | 'write' | 'delete' | 'create' | 'rename',
    filePath: string,
    destinationPath?: string
  ): Promise<SecurityCheckResult> {
    // Check source file safety
    const sourceCheck = await this.checkPathSafety(filePath, operation === 'read' ? 'read' : 'write');
    if (!sourceCheck.allowed) {
      return sourceCheck;
    }

    // Check destination file safety for rename operations
    if (operation === 'rename' && destinationPath) {
      const destCheck = await this.checkPathSafety(destinationPath, 'write');
      if (!destCheck.allowed) {
        return destCheck;
      }
    }

    // Additional checks for specific operations
    switch (operation) {
      case 'delete':
        // Prevent deletion of system files
        if (this.isSystemFile(filePath)) {
          return {
            allowed: false,
            reason: 'Cannot delete system files',
            risk: 'critical',
            suggestions: ['System files are protected from deletion']
          };
        }
        break;

      case 'create':
        // Check if parent directory exists and is safe
        const parentDir = path.dirname(filePath);
        const parentCheck = await this.checkDirectorySafety(parentDir);
        if (!parentCheck.allowed) {
          return parentCheck;
        }
        break;

      case 'rename':
        // Check if we're renaming across different drives (Windows-specific)
        if (process.platform === 'win32' && destinationPath) {
          const sourceDrive = path.parse(filePath).root;
          const destDrive = path.parse(destinationPath).root;
          if (sourceDrive !== destDrive) {
            return {
              allowed: false,
              reason: 'Cannot rename files across different drives',
              risk: 'medium',
              suggestions: ['Copy the file instead of renaming across drives']
            };
          }
        }
        break;
    }

    return {
      allowed: true,
      risk: 'none'
    };
  }

  private isSystemFile(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);
    const systemFiles = [
      '/etc/passwd', '/etc/shadow', '/etc/sudoers',
      '/boot', '/system', '/Windows/System32'
    ];

    return systemFiles.some(systemFile => 
      resolvedPath === systemFile || resolvedPath.startsWith(systemFile + '/')
    );
  }

  async validateFileContent(content: string | Uint8Array): Promise<{
    valid: boolean;
    risk: 'none' | 'low' | 'medium' | 'high';
    issues: string[];
  }> {
    const issues: string[] = [];
    let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none';

    // Convert content to string for analysis
    const contentStr = typeof content === 'string' ? content : 
      Buffer.from(content).toString('utf-8');

    // Check for potentially dangerous content patterns
    const dangerousPatterns = [
      { pattern: /<script[\s>]/i, risk: 'high' as const, message: 'JavaScript script tag detected' },
      { pattern: /eval\s*\(/i, risk: 'high' as const, message: 'eval() function detected' },
      { pattern: /exec\s*\(/i, risk: 'high' as const, message: 'exec() function detected' },
      { pattern: /system\s*\(/i, risk: 'high' as const, message: 'system() function detected' },
      { pattern: /shell_exec\s*\(/i, risk: 'high' as const, message: 'shell_exec() function detected' },
      { pattern: /passthru\s*\(/i, risk: 'high' as const, message: 'passthru() function detected' },
      { pattern: /document\.cookie/i, risk: 'medium' as const, message: 'Cookie access detected' },
      { pattern: /localStorage/i, risk: 'medium' as const, message: 'Local storage access detected' },
      { pattern: /sessionStorage/i, risk: 'medium' as const, message: 'Session storage access detected' }
    ];

    for (const { pattern, risk, message } of dangerousPatterns) {
      if (pattern.test(contentStr)) {
        issues.push(message);
        if (risk === 'high' || riskLevel === 'none') {
          riskLevel = risk;
        } else if (risk === 'medium' && riskLevel !== 'high') {
          riskLevel = risk;
        }
      }
    }

    // Check for very large content
    if (contentStr.length > this.config.maxTextFileSize) {
      issues.push(`Content size ${contentStr.length} exceeds maximum allowed size`);
      riskLevel = riskLevel === 'none' ? 'medium' : riskLevel;
    }

    return {
      valid: issues.length === 0,
      risk: riskLevel,
      issues
    };
  }

  async checkAccessPermissions(filePath: string): Promise<{
    canRead: boolean;
    canWrite: boolean;
    canExecute: boolean;
    error?: string;
  }> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check read permission
      let canRead = false;
      try {
        await fs.access(filePath, fs.constants.R_OK);
        canRead = true;
      } catch {
        canRead = false;
      }

      // Check write permission
      let canWrite = false;
      try {
        await fs.access(filePath, fs.constants.W_OK);
        canWrite = true;
      } catch {
        canWrite = false;
      }

      // Check execute permission
      let canExecute = false;
      try {
        await fs.access(filePath, fs.constants.X_OK);
        canExecute = true;
      } catch {
        canExecute = false;
      }

      return {
        canRead,
        canWrite,
        canExecute
      };
    } catch (error) {
      return {
        canRead: false,
        canWrite: false,
        canExecute: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
