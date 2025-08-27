import type { VSCodeCommand, CommandValidationResult } from '../types/commands'

/**
 * Validates a VS Code command structure
 */
export function isValidCommand(command: any): command is VSCodeCommand {
  if (!command || typeof command !== 'object') {
    return false
  }

  // Command must have a command string
  if (!command.command || typeof command.command !== 'string' || command.command.trim() === '') {
    return false
  }

  // Title is required
  if (!command.title || typeof command.title !== 'string' || command.title.trim() === '') {
    return false
  }

  // Optional fields validation
  if (command.category && typeof command.category !== 'string') {
    return false
  }

  if (command.description && typeof command.description !== 'string') {
    return false
  }

  if (command.args && !Array.isArray(command.args)) {
    return false
  }

  if (command.when && typeof command.when !== 'string') {
    return false
  }

  return true
}

/**
 * Validates command arguments
 */
export function validateCommandArgs(command: string, args?: any[]): CommandValidationResult {
  // Basic validation - command should not be empty
  if (!command || typeof command !== 'string' || command.trim() === '') {
    return {
      isValid: false,
      error: 'Command cannot be empty'
    }
  }

  // Validate command format (should be dot-separated)
  const commandPattern = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/
  if (!commandPattern.test(command)) {
    return {
      isValid: false,
      error: 'Command should follow the format: extension.commandName',
      suggestions: ['workbench.action.files.save', 'editor.action.formatDocument']
    }
  }

  // Validate args if provided
  if (args !== undefined) {
    if (!Array.isArray(args)) {
      return {
        isValid: false,
        error: 'Command arguments must be an array'
      }
    }

    // Check for circular references in args
    try {
      JSON.stringify(args)
    } catch (error) {
      return {
        isValid: false,
        error: 'Command arguments contain circular references or non-serializable values'
      }
    }
  }

  return { isValid: true }
}

/**
 * Sanitizes command arguments to prevent injection attacks
 */
export function sanitizeCommandArgs(args?: any[]): any[] | undefined {
  if (!args || !Array.isArray(args)) {
    return args
  }

  return args.map(arg => {
    if (typeof arg === 'string') {
      // Remove potentially dangerous characters
      return arg.replace(/[<>"'&]/g, '')
    }
    if (typeof arg === 'object' && arg !== null) {
      // Deep sanitize objects
      return sanitizeObject(arg)
    }
    return arg
  })
}

/**
 * Deep sanitizes an object
 */
function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item))
  }

  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = typeof key === 'string' ? key.replace(/[<>"'&]/g, '') : key
      sanitized[sanitizedKey] = sanitizeObject(value)
    }
    return sanitized
  }

  if (typeof obj === 'string') {
    return obj.replace(/[<>"'&]/g, '')
  }

  return obj
}

/**
 * Creates a validation error
 */
export function createCommandValidationError(message: string, command?: string, args?: any[]): Error {
  const error = new Error(`Command validation error: ${message}`)
  ;(error as any).command = command
  ;(error as any).args = args
  ;(error as any).type = 'CommandValidationError'
  return error
}

/**
 * Gets command suggestions based on partial input
 */
export function getCommandSuggestions(partial: string): string[] {
  const commonCommands = [
    'workbench.action.files.save',
    'workbench.action.files.saveAll',
    'workbench.action.files.openFile',
    'workbench.action.files.newUntitledFile',
    'editor.action.formatDocument',
    'editor.action.formatSelection',
    'editor.action.commentLine',
    'editor.action.copyLinesDownAction',
    'editor.action.copyLinesUpAction',
    'editor.action.deleteLines',
    'workbench.action.quickOpen',
    'workbench.action.showCommands',
    'workbench.action.terminal.new',
    'workbench.action.terminal.toggleTerminal',
    'git.commit',
    'git.push',
    'git.pull',
    'git.sync',
    'workbench.action.reloadWindow',
    'workbench.action.toggleSidebarVisibility'
  ]

  if (!partial || partial.trim() === '') {
    return commonCommands.slice(0, 10)
  }

  const lowerPartial = partial.toLowerCase()
  return commonCommands
    .filter(cmd => cmd.toLowerCase().includes(lowerPartial))
    .slice(0, 10)
}