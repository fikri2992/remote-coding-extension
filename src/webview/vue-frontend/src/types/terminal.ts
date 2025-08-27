import type { Ref } from 'vue'

export interface TerminalSession {
  id: string
  name: string
  cwd: string
  shell: string
  isActive: boolean
  createdAt: Date
  lastActivity: Date
  pid?: number
}

export interface TerminalOutput {
  id: string
  sessionId: string
  content: string
  type: 'stdout' | 'stderr' | 'stdin'
  timestamp: Date
  isCommand?: boolean
}

export interface TerminalCommand {
  id: string
  sessionId: string
  command: string
  timestamp: Date
  exitCode?: number
  duration?: number
}

export interface TerminalSettings {
  fontSize: number
  fontFamily: string
  theme: 'dark' | 'light'
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  bellSound: boolean
  copyOnSelect: boolean
  pasteOnRightClick: boolean
  wordSeparator: string
  allowTransparency: boolean
  macOptionIsMeta: boolean
  rightClickSelectsWord: boolean
  fastScrollModifier: 'alt' | 'ctrl' | 'shift'
  fastScrollSensitivity: number
}

export interface TerminalHistory {
  sessionId: string
  commands: string[]
  maxSize: number
  currentIndex: number
}

export interface TerminalStreamData {
  sessionId: string
  data: string
  type: 'data' | 'exit' | 'error'
  exitCode?: number
}

export interface TerminalResizeData {
  sessionId: string
  cols: number
  rows: number
}

export interface TerminalMessage {
  type: 'create' | 'destroy' | 'input' | 'output' | 'resize' | 'list' | 'switch'
  sessionId?: string
  data?: any
  timestamp: number
}

export interface CreateTerminalRequest {
  name?: string
  cwd?: string
  shell?: string
  env?: Record<string, string>
}

export interface TerminalInputData {
  sessionId: string
  input: string
}

export interface TerminalState {
  sessions: TerminalSession[]
  activeSessionId: string | null
  output: Map<string, TerminalOutput[]>
  history: Map<string, TerminalHistory>
  settings: TerminalSettings
  isConnected: boolean
}

export interface TerminalComposable {
  // State
  sessions: Ref<TerminalSession[]>
  activeSession: Ref<TerminalSession | null>
  activeSessionId: Ref<string | null>
  output: Ref<Map<string, TerminalOutput[]>>
  history: Ref<Map<string, TerminalHistory>>
  settings: Ref<TerminalSettings>
  isConnected: Ref<boolean>

  // Session management
  createSession: (options?: CreateTerminalRequest) => Promise<TerminalSession>
  destroySession: (sessionId: string) => Promise<void>
  switchSession: (sessionId: string) => void
  listSessions: () => Promise<TerminalSession[]>
  getSession: (sessionId: string) => TerminalSession | null

  // Input/Output
  sendInput: (sessionId: string, input: string) => Promise<void>
  sendCommand: (sessionId: string, command: string) => Promise<void>
  getOutput: (sessionId: string) => TerminalOutput[]
  clearOutput: (sessionId: string) => void
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>

  // History management
  getHistory: (sessionId: string) => string[]
  addToHistory: (sessionId: string, command: string) => void
  clearHistory: (sessionId: string) => void
  navigateHistory: (sessionId: string, direction: 'up' | 'down') => string | null

  // Settings
  updateSettings: (newSettings: Partial<TerminalSettings>) => void
  resetSettings: () => void
  exportSettings: () => TerminalSettings
  importSettings: (settings: TerminalSettings) => void

  // Event handlers
  onOutput: (callback: (output: TerminalOutput) => void) => void
  onSessionCreated: (callback: (session: TerminalSession) => void) => void
  onSessionDestroyed: (callback: (sessionId: string) => void) => void
  onSessionSwitched: (callback: (sessionId: string) => void) => void
  onSettingsChanged: (callback: (settings: TerminalSettings) => void) => void
}