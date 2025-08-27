import type { 
  TerminalSession, 
  TerminalOutput, 
  TerminalCommand, 
  TerminalSettings, 
  TerminalMessage,
  CreateTerminalRequest,
  TerminalInputData,
  TerminalStreamData,
  TerminalResizeData
} from '../types/terminal'

export function isValidTerminalSession(obj: any): obj is TerminalSession {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.cwd === 'string' &&
    typeof obj.shell === 'string' &&
    typeof obj.isActive === 'boolean' &&
    obj.createdAt instanceof Date &&
    obj.lastActivity instanceof Date &&
    (obj.pid === undefined || typeof obj.pid === 'number')
  )
}

export function isValidTerminalOutput(obj: any): obj is TerminalOutput {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.sessionId === 'string' &&
    typeof obj.content === 'string' &&
    ['stdout', 'stderr', 'stdin'].includes(obj.type) &&
    obj.timestamp instanceof Date &&
    (obj.isCommand === undefined || typeof obj.isCommand === 'boolean')
  )
}

export function isValidTerminalCommand(obj: any): obj is TerminalCommand {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.sessionId === 'string' &&
    typeof obj.command === 'string' &&
    obj.timestamp instanceof Date &&
    (obj.exitCode === undefined || typeof obj.exitCode === 'number') &&
    (obj.duration === undefined || typeof obj.duration === 'number')
  )
}

export function isValidTerminalSettings(obj: any): obj is TerminalSettings {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.fontSize === 'number' &&
    typeof obj.fontFamily === 'string' &&
    ['dark', 'light'].includes(obj.theme) &&
    ['block', 'underline', 'bar'].includes(obj.cursorStyle) &&
    typeof obj.cursorBlink === 'boolean' &&
    typeof obj.scrollback === 'number' &&
    typeof obj.bellSound === 'boolean' &&
    typeof obj.copyOnSelect === 'boolean' &&
    typeof obj.pasteOnRightClick === 'boolean' &&
    typeof obj.wordSeparator === 'string' &&
    typeof obj.allowTransparency === 'boolean' &&
    typeof obj.macOptionIsMeta === 'boolean' &&
    typeof obj.rightClickSelectsWord === 'boolean' &&
    ['alt', 'ctrl', 'shift'].includes(obj.fastScrollModifier) &&
    typeof obj.fastScrollSensitivity === 'number'
  )
}

export function isValidTerminalMessage(obj: any): obj is TerminalMessage {
  return (
    obj &&
    typeof obj === 'object' &&
    ['create', 'destroy', 'input', 'output', 'resize', 'list', 'switch'].includes(obj.type) &&
    (obj.sessionId === undefined || typeof obj.sessionId === 'string') &&
    typeof obj.timestamp === 'number'
  )
}

export function isValidCreateTerminalRequest(obj: any): obj is CreateTerminalRequest {
  return (
    obj &&
    typeof obj === 'object' &&
    (obj.name === undefined || typeof obj.name === 'string') &&
    (obj.cwd === undefined || typeof obj.cwd === 'string') &&
    (obj.shell === undefined || typeof obj.shell === 'string') &&
    (obj.env === undefined || (typeof obj.env === 'object' && obj.env !== null))
  )
}

export function isValidTerminalInputData(obj: any): obj is TerminalInputData {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.sessionId === 'string' &&
    typeof obj.input === 'string'
  )
}

export function isValidTerminalStreamData(obj: any): obj is TerminalStreamData {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.sessionId === 'string' &&
    typeof obj.data === 'string' &&
    ['data', 'exit', 'error'].includes(obj.type) &&
    (obj.exitCode === undefined || typeof obj.exitCode === 'number')
  )
}

export function isValidTerminalResizeData(obj: any): obj is TerminalResizeData {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.sessionId === 'string' &&
    typeof obj.cols === 'number' &&
    typeof obj.rows === 'number' &&
    obj.cols > 0 &&
    obj.rows > 0
  )
}

export function createTerminalValidationError(message: string, data?: any): Error {
  const error = new Error(`Terminal validation error: ${message}`)
  if (data) {
    ;(error as any).data = data
  }
  return error
}

export function validateSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string' && sessionId.length > 0
}

export function validateCommand(command: string): boolean {
  return typeof command === 'string' && command.trim().length > 0
}

export function validateTerminalDimensions(cols: number, rows: number): boolean {
  return (
    typeof cols === 'number' &&
    typeof rows === 'number' &&
    cols > 0 &&
    rows > 0 &&
    cols <= 1000 &&
    rows <= 1000
  )
}

export function sanitizeTerminalInput(input: string): string {
  // Remove null bytes and other potentially dangerous characters
  return input.replace(/\0/g, '').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
}

export function sanitizeTerminalOutput(output: string): string {
  // Allow ANSI escape sequences for terminal formatting but remove dangerous ones
  return output.replace(/\x1b\].*?\x07/g, '') // Remove OSC sequences
}