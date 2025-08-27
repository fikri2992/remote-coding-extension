import type { FileOperation, FileSearchOptions } from '../types/filesystem'
import { isValidFilePath } from './validators'

export interface FileValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validate file system node data
 */
export function validateFileSystemNode(node: any): FileValidationResult {
  if (!node || typeof node !== 'object') {
    return { isValid: false, error: 'Node must be an object' }
  }

  if (!node.path || typeof node.path !== 'string') {
    return { isValid: false, error: 'Node must have a valid path' }
  }

  if (!isValidFilePath(node.path)) {
    return { isValid: false, error: 'Invalid file path format' }
  }

  if (!node.name || typeof node.name !== 'string') {
    return { isValid: false, error: 'Node must have a valid name' }
  }

  if (!node.type || !['file', 'directory'].includes(node.type)) {
    return { isValid: false, error: 'Node type must be "file" or "directory"' }
  }

  return { isValid: true }
}

/**
 * Validate file operation data
 */
export function validateFileOperation(operation: FileOperation): FileValidationResult {
  if (!operation || typeof operation !== 'object') {
    return { isValid: false, error: 'Operation must be an object' }
  }

  if (!operation.type || !['create', 'delete', 'rename', 'move', 'copy'].includes(operation.type)) {
    return { isValid: false, error: 'Invalid operation type' }
  }

  if (!operation.path || !isValidFilePath(operation.path)) {
    return { isValid: false, error: 'Invalid source path' }
  }

  // Validate newPath for operations that require it
  if (['rename', 'move', 'copy'].includes(operation.type)) {
    if (!operation.newPath || !isValidFilePath(operation.newPath)) {
      return { isValid: false, error: 'Invalid target path' }
    }

    // Check if source and target are the same
    if (operation.path === operation.newPath) {
      return { isValid: false, error: 'Source and target paths cannot be the same' }
    }
  }

  return { isValid: true }
}

/**
 * Validate file search options
 */
export function validateFileSearchOptions(options: FileSearchOptions): FileValidationResult {
  if (!options || typeof options !== 'object') {
    return { isValid: false, error: 'Search options must be an object' }
  }

  if (!options.query || typeof options.query !== 'string' || options.query.trim() === '') {
    return { isValid: false, error: 'Search query is required' }
  }

  if (options.maxResults !== undefined) {
    if (typeof options.maxResults !== 'number' || options.maxResults < 1 || options.maxResults > 10000) {
      return { isValid: false, error: 'Max results must be between 1 and 10000' }
    }
  }

  if (options.excludePatterns && !Array.isArray(options.excludePatterns)) {
    return { isValid: false, error: 'Exclude patterns must be an array' }
  }

  if (options.includePatterns && !Array.isArray(options.includePatterns)) {
    return { isValid: false, error: 'Include patterns must be an array' }
  }

  return { isValid: true }
}

/**
 * Validate file name for creation
 */
export function validateFileName(name: string): FileValidationResult {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return { isValid: false, error: 'File name is required' }
  }

  const trimmedName = name.trim()

  // Check for invalid characters
  const invalidChars = /[<>:"|?*\\/]/
  if (invalidChars.test(trimmedName)) {
    return { isValid: false, error: 'File name contains invalid characters' }
  }

  // Check for reserved names (Windows)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
  if (reservedNames.includes(trimmedName.toUpperCase())) {
    return { isValid: false, error: 'File name is reserved' }
  }

  // Check length
  if (trimmedName.length > 255) {
    return { isValid: false, error: 'File name is too long (max 255 characters)' }
  }

  // Check for leading/trailing dots or spaces
  if (trimmedName.startsWith('.') && trimmedName.length === 1) {
    return { isValid: false, error: 'File name cannot be just a dot' }
  }

  if (trimmedName === '..') {
    return { isValid: false, error: 'File name cannot be ".."' }
  }

  if (trimmedName.endsWith(' ') || trimmedName.endsWith('.')) {
    return { isValid: false, error: 'File name cannot end with space or dot' }
  }

  return { isValid: true }
}

/**
 * Validate directory name for creation
 */
export function validateDirectoryName(name: string): FileValidationResult {
  // Directory names follow the same rules as file names
  return validateFileName(name)
}

/**
 * Validate file content size
 */
export function validateFileContentSize(content: string, maxSize: number = 50 * 1024 * 1024): FileValidationResult {
  if (typeof content !== 'string') {
    return { isValid: false, error: 'Content must be a string' }
  }

  const sizeInBytes = new Blob([content]).size
  if (sizeInBytes > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    return { isValid: false, error: `Content size exceeds maximum limit of ${maxSizeMB}MB` }
  }

  return { isValid: true }
}

/**
 * Validate path for file operations
 */
export function validateOperationPath(path: string, operation: 'read' | 'write' | 'delete'): FileValidationResult {
  if (!isValidFilePath(path)) {
    return { isValid: false, error: 'Invalid file path' }
  }

  // Additional validation based on operation type
  switch (operation) {
    case 'write':
      // Check if path is not a system directory
      const systemPaths = ['/system', '/proc', '/dev', 'C:\\Windows', 'C:\\System32']
      if (systemPaths.some(sysPath => path.toLowerCase().startsWith(sysPath.toLowerCase()))) {
        return { isValid: false, error: 'Cannot write to system directories' }
      }
      break

    case 'delete':
      // Check if path is not a critical system file
      const criticalPaths = ['/', 'C:\\', '/home', '/usr', 'C:\\Users']
      if (criticalPaths.includes(path)) {
        return { isValid: false, error: 'Cannot delete critical system paths' }
      }
      break
  }

  return { isValid: true }
}

/**
 * Create validation error for file operations
 */
export function createFileValidationError(message: string, path?: string, operation?: string): Error {
  const errorMessage = path 
    ? `File validation error for "${path}": ${message}`
    : `File validation error: ${message}`
  
  const error = new Error(errorMessage)
  error.name = 'FileValidationError'
  
  // Add additional properties for debugging
  if (path) {
    (error as any).path = path
  }
  if (operation) {
    (error as any).operation = operation
  }
  
  return error
}

/**
 * Sanitize file path for safe operations
 */
export function sanitizeFilePath(path: string): string {
  if (!path || typeof path !== 'string') {
    return ''
  }

  // Normalize path separators
  let sanitized = path.replace(/\\/g, '/')

  // Remove multiple consecutive slashes
  sanitized = sanitized.replace(/\/+/g, '/')

  // Remove leading and trailing whitespace
  sanitized = sanitized.trim()

  // Remove dangerous path traversal sequences
  sanitized = sanitized.replace(/\.\.+/g, '.')

  return sanitized
}

/**
 * Check if path is safe for operations
 */
export function isSafePath(path: string): boolean {
  const sanitized = sanitizeFilePath(path)
  
  // Check for path traversal attempts
  if (sanitized.includes('../') || sanitized.includes('..\\')) {
    return false
  }

  // Check for absolute paths that might be dangerous
  const dangerousPaths = [
    '/etc', '/bin', '/sbin', '/usr/bin', '/usr/sbin',
    'C:\\Windows', 'C:\\System32', 'C:\\Program Files'
  ]

  return !dangerousPaths.some(dangerous => 
    sanitized.toLowerCase().startsWith(dangerous.toLowerCase())
  )
}

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  if (!path || typeof path !== 'string') {
    return ''
  }

  const fileName = path.split('/').pop() || path.split('\\').pop() || ''
  const lastDot = fileName.lastIndexOf('.')
  
  return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : ''
}

/**
 * Check if file type is supported for operations
 */
export function isSupportedFileType(path: string, supportedTypes?: string[]): boolean {
  if (!supportedTypes || supportedTypes.length === 0) {
    return true // All types supported if no restriction
  }

  const extension = getFileExtension(path)
  return supportedTypes.includes(extension)
}