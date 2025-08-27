// Input validation utilities

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate port number
 */
export function isValidPort(port: number | string): boolean {
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port
  return Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535
}

/**
 * Validate file path
 */
export function isValidFilePath(path: string): boolean {
  // Basic validation - no empty string, no invalid characters
  if (!path || path.trim() === '') {
    return false
  }

  // Check for invalid characters (Windows and Unix)
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"|?*\x00-\x1f]/
  return !invalidChars.test(path)
}

/**
 * Validate Git branch name
 */
export function isValidBranchName(name: string): boolean {
  if (!name || name.trim() === '') {
    return false
  }

  // Git branch name rules
  const invalidPatterns = [
    /^\./, // Cannot start with dot
    /\.$/, // Cannot end with dot
    /\.\./, // Cannot contain double dots
    /[\s~^:?*[\\]/, // Cannot contain certain characters
    /\/$/, // Cannot end with slash
    /^\/|\/\// // Cannot start with slash or contain double slashes
  ]

  return !invalidPatterns.some(pattern => pattern.test(name))
}

/**
 * Validate commit message
 */
export function isValidCommitMessage(message: string): boolean {
  if (!message || message.trim() === '') {
    return false
  }

  // Should be at least 3 characters and not too long
  const trimmed = message.trim()
  return trimmed.length >= 3 && trimmed.length <= 500
}

/**
 * Validate WebSocket URL
 */
export function isValidWebSocketUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:'
  } catch {
    return false
  }
}

/**
 * Validate JSON string
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

/**
 * Validate command string (basic validation)
 */
export function isValidCommand(command: string): boolean {
  if (!command || command.trim() === '') {
    return false
  }

  // Should not contain dangerous characters
  const dangerousChars = /[;&|`$(){}]/
  return !dangerousChars.test(command)
}

/**
 * Validate file size
 */
export function isValidFileSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize
}

/**
 * Validate required field
 */
export function isRequired(value: any): boolean {
  if (value === null || value === undefined) {
    return false
  }
  if (typeof value === 'string') {
    return value.trim() !== ''
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return true
}

/**
 * Validate minimum length
 */
export function hasMinLength(value: string, minLength: number): boolean {
  return Boolean(value && value.length >= minLength)
}

/**
 * Validate maximum length
 */
export function hasMaxLength(value: string, maxLength: number): boolean {
  return !value || value.length <= maxLength
}

/**
 * Validate numeric range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Validate form data with multiple rules
 */
export function validateForm(
  data: Record<string, any>,
  rules: Record<string, Array<(value: any) => string | null>>
): ValidationResult {
  const errors: string[] = []

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field]

    for (const rule of fieldRules) {
      const error = rule(value)
      if (error) {
        errors.push(`${field}: ${error}`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
