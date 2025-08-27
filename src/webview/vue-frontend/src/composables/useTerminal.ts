import { ref, computed, onUnmounted } from 'vue'
import type { 
  TerminalSession, 
  TerminalOutput, 
  TerminalSettings, 
  TerminalHistory,
  TerminalMessage,
  CreateTerminalRequest,
  TerminalInputData,
  TerminalStreamData,
  TerminalResizeData,
  TerminalComposable
} from '../types/terminal'
import type { WebSocketMessage } from '../types/websocket'
import { 
  TERMINAL_MAX_SESSIONS,
  TERMINAL_MAX_OUTPUT_LINES,
  TERMINAL_MAX_HISTORY_SIZE,
  TERMINAL_HEARTBEAT_INTERVAL,
  TERMINAL_INPUT_TIMEOUT,
  TERMINAL_RESIZE_DEBOUNCE,
  TERMINAL_DEFAULT_SETTINGS,
  TERMINAL_DEFAULT_SHELL
} from '../utils/constants'
import { 
  isValidTerminalSession,
  isValidTerminalOutput,
  isValidTerminalSettings,
  isValidTerminalMessage,
  isValidCreateTerminalRequest,
  isValidTerminalInputData,
  isValidTerminalStreamData,
  isValidTerminalResizeData,
  createTerminalValidationError,
  validateSessionId,
  validateCommand,
  validateTerminalDimensions,
  sanitizeTerminalInput,
  sanitizeTerminalOutput
} from '../utils/terminal-validator'
import { useWebSocket } from './useWebSocket'

export function useTerminal(): TerminalComposable {
  const webSocket = useWebSocket()
  
  // State
  const sessions = ref<TerminalSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const output = ref<Map<string, TerminalOutput[]>>(new Map())
  const history = ref<Map<string, TerminalHistory>>(new Map())
  const settings = ref<TerminalSettings>({ ...TERMINAL_DEFAULT_SETTINGS })
  const isConnected = ref(false)
  
  // Timers and cleanup
  const heartbeatTimer = ref<NodeJS.Timeout | null>(null)
  const resizeTimers = ref<Map<string, NodeJS.Timeout>>(new Map())
  
  // Event callbacks
  const outputCallbacks = ref<Array<(output: TerminalOutput) => void>>([])
  const sessionCreatedCallbacks = ref<Array<(session: TerminalSession) => void>>([])
  const sessionDestroyedCallbacks = ref<Array<(sessionId: string) => void>>([])
  const sessionSwitchedCallbacks = ref<Array<(sessionId: string) => void>>([])
  const settingsChangedCallbacks = ref<Array<(settings: TerminalSettings) => void>>([])

  // Computed
  const activeSession = computed(() => {
    if (!activeSessionId.value) return null
    return sessions.value.find(session => session.id === activeSessionId.value) || null
  })

  // Initialize WebSocket connection and message handling
  const initializeWebSocket = (): void => {
    webSocket.onConnect(() => {
      isConnected.value = true
      startHeartbeat()
      // Refresh sessions list on reconnect
      listSessions()
    })

    webSocket.onDisconnect(() => {
      isConnected.value = false
      stopHeartbeat()
    })

    webSocket.onMessage((message: WebSocketMessage) => {
      // Handle terminal-related broadcast messages
      if (message.type === 'broadcast' && message.data && message.data.type === 'terminal') {
        if (isValidTerminalMessage(message.data)) {
          handleTerminalMessage(message.data)
        }
      }
    })
  }

  // Handle terminal-specific messages
  const handleTerminalMessage = (message: TerminalMessage): void => {
    try {
      switch (message.type) {
        case 'output':
          if (message.data && isValidTerminalStreamData(message.data)) {
            handleTerminalOutput(message.data)
          }
          break
        case 'list':
          if (Array.isArray(message.data)) {
            updateSessionsList(message.data)
          }
          break
        case 'create':
          if (message.data && isValidTerminalSession(message.data)) {
            addSession(message.data)
          }
          break
        case 'destroy':
          if (message.sessionId) {
            removeSession(message.sessionId)
          }
          break
        case 'switch':
          if (message.sessionId) {
            setActiveSession(message.sessionId)
          }
          break
      }
    } catch (error) {
      console.error('Error handling terminal message:', error)
    }
  }

  // Handle terminal output
  const handleTerminalOutput = (streamData: TerminalStreamData): void => {
    const { sessionId, data, type } = streamData
    
    if (!validateSessionId(sessionId)) {
      console.error('Invalid session ID in terminal output:', sessionId)
      return
    }

    const sanitizedData = sanitizeTerminalOutput(data)
    const outputItem: TerminalOutput = {
      id: `output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      content: sanitizedData,
      type: type === 'error' ? 'stderr' : 'stdout',
      timestamp: new Date(),
      isCommand: false
    }

    if (isValidTerminalOutput(outputItem)) {
      // Add to output map
      const sessionOutput = output.value.get(sessionId) || []
      sessionOutput.push(outputItem)
      
      // Limit output lines to prevent memory issues
      if (sessionOutput.length > TERMINAL_MAX_OUTPUT_LINES) {
        sessionOutput.splice(0, sessionOutput.length - TERMINAL_MAX_OUTPUT_LINES)
      }
      
      output.value.set(sessionId, sessionOutput)
      
      // Update session last activity
      updateSessionActivity(sessionId)
      
      // Trigger callbacks
      outputCallbacks.value.forEach(callback => {
        try {
          callback(outputItem)
        } catch (error) {
          console.error('Error in output callback:', error)
        }
      })
    }
  }

  // Session management
  const createSession = async (options: CreateTerminalRequest = {}): Promise<TerminalSession> => {
    if (sessions.value.length >= TERMINAL_MAX_SESSIONS) {
      throw new Error(`Maximum number of terminal sessions (${TERMINAL_MAX_SESSIONS}) reached`)
    }

    if (!isValidCreateTerminalRequest(options)) {
      throw createTerminalValidationError('Invalid create terminal request', options)
    }

    const message: WebSocketMessage = {
      type: 'command',
      command: 'terminal.create',
      args: [{
        name: options.name || `Terminal ${sessions.value.length + 1}`,
        cwd: options.cwd || process.cwd(),
        shell: options.shell || TERMINAL_DEFAULT_SHELL,
        env: options.env || {}
      }],
      timestamp: Date.now()
    }

    try {
      const response = await webSocket.sendMessageWithResponse(message, TERMINAL_INPUT_TIMEOUT)
      
      if (response && isValidTerminalSession(response)) {
        const session = response as TerminalSession
        addSession(session)
        
        // Initialize history for the session
        history.value.set(session.id, {
          sessionId: session.id,
          commands: [],
          maxSize: TERMINAL_MAX_HISTORY_SIZE,
          currentIndex: -1
        })
        
        // Initialize output for the session
        output.value.set(session.id, [])
        
        return session
      } else {
        throw new Error('Invalid session data received from server')
      }
    } catch (error) {
      const createError = error instanceof Error ? error : new Error('Failed to create terminal session')
      throw createError
    }
  }

  const destroySession = async (sessionId: string): Promise<void> => {
    if (!validateSessionId(sessionId)) {
      throw createTerminalValidationError('Invalid session ID', sessionId)
    }

    const message: WebSocketMessage = {
      type: 'command',
      command: 'terminal.destroy',
      args: [{ sessionId }],
      timestamp: Date.now()
    }

    try {
      await webSocket.sendMessageWithResponse(message, TERMINAL_INPUT_TIMEOUT)
      removeSession(sessionId)
    } catch (error) {
      const destroyError = error instanceof Error ? error : new Error('Failed to destroy terminal session')
      throw destroyError
    }
  }

  const switchSession = (sessionId: string): void => {
    if (!validateSessionId(sessionId)) {
      throw createTerminalValidationError('Invalid session ID', sessionId)
    }

    const session = sessions.value.find(s => s.id === sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    setActiveSession(sessionId)
  }

  const listSessions = async (): Promise<TerminalSession[]> => {
    const message: WebSocketMessage = {
      type: 'command',
      command: 'terminal.list',
      args: [],
      timestamp: Date.now()
    }

    try {
      const response = await webSocket.sendMessageWithResponse(message, TERMINAL_INPUT_TIMEOUT)
      
      if (Array.isArray(response)) {
        const validSessions = response.filter(isValidTerminalSession)
        updateSessionsList(validSessions)
        return validSessions
      } else {
        throw new Error('Invalid sessions list received from server')
      }
    } catch (error) {
      const listError = error instanceof Error ? error : new Error('Failed to list terminal sessions')
      throw listError
    }
  }

  const getSession = (sessionId: string): TerminalSession | null => {
    if (!validateSessionId(sessionId)) {
      return null
    }
    return sessions.value.find(session => session.id === sessionId) || null
  }

  // Input/Output operations
  const sendInput = async (sessionId: string, input: string): Promise<void> => {
    if (!validateSessionId(sessionId)) {
      throw createTerminalValidationError('Invalid session ID', sessionId)
    }

    const sanitizedInput = sanitizeTerminalInput(input)
    const inputData: TerminalInputData = {
      sessionId,
      input: sanitizedInput
    }

    if (!isValidTerminalInputData(inputData)) {
      throw createTerminalValidationError('Invalid input data', inputData)
    }

    const message: WebSocketMessage = {
      type: 'command',
      command: 'terminal.input',
      args: [inputData],
      timestamp: Date.now()
    }

    try {
      await webSocket.sendMessage(message)
      updateSessionActivity(sessionId)
    } catch (error) {
      const inputError = error instanceof Error ? error : new Error('Failed to send terminal input')
      throw inputError
    }
  }

  const sendCommand = async (sessionId: string, command: string): Promise<void> => {
    if (!validateCommand(command)) {
      throw createTerminalValidationError('Invalid command', command)
    }

    // Add command to history
    addToHistory(sessionId, command)
    
    // Add command to output for display
    const commandOutput: TerminalOutput = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      content: command,
      type: 'stdin',
      timestamp: new Date(),
      isCommand: true
    }

    const sessionOutput = output.value.get(sessionId) || []
    sessionOutput.push(commandOutput)
    output.value.set(sessionId, sessionOutput)

    // Send command with newline
    await sendInput(sessionId, command + '\n')
  }

  const getOutput = (sessionId: string): TerminalOutput[] => {
    if (!validateSessionId(sessionId)) {
      return []
    }
    return output.value.get(sessionId) || []
  }

  const clearOutput = (sessionId: string): void => {
    if (!validateSessionId(sessionId)) {
      return
    }
    output.value.set(sessionId, [])
  }

  const resizeTerminal = async (sessionId: string, cols: number, rows: number): Promise<void> => {
    if (!validateSessionId(sessionId)) {
      throw createTerminalValidationError('Invalid session ID', sessionId)
    }

    if (!validateTerminalDimensions(cols, rows)) {
      throw createTerminalValidationError('Invalid terminal dimensions', { cols, rows })
    }

    // Debounce resize operations
    const existingTimer = resizeTimers.value.get(sessionId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(async () => {
      const resizeData: TerminalResizeData = { sessionId, cols, rows }
      
      if (!isValidTerminalResizeData(resizeData)) {
        throw createTerminalValidationError('Invalid resize data', resizeData)
      }

      const message: WebSocketMessage = {
        type: 'command',
        command: 'terminal.resize',
        args: [resizeData],
        timestamp: Date.now()
      }

      try {
        await webSocket.sendMessage(message)
        resizeTimers.value.delete(sessionId)
      } catch (error) {
        const resizeError = error instanceof Error ? error : new Error('Failed to resize terminal')
        throw resizeError
      }
    }, TERMINAL_RESIZE_DEBOUNCE)

    resizeTimers.value.set(sessionId, timer)
  }

  // History management
  const getHistory = (sessionId: string): string[] => {
    if (!validateSessionId(sessionId)) {
      return []
    }
    const sessionHistory = history.value.get(sessionId)
    return sessionHistory ? sessionHistory.commands : []
  }

  const addToHistory = (sessionId: string, command: string): void => {
    if (!validateSessionId(sessionId) || !validateCommand(command)) {
      return
    }

    const sessionHistory = history.value.get(sessionId) || {
      sessionId,
      commands: [],
      maxSize: TERMINAL_MAX_HISTORY_SIZE,
      currentIndex: -1
    }

    // Don't add duplicate consecutive commands
    if (sessionHistory.commands.length === 0 || sessionHistory.commands[sessionHistory.commands.length - 1] !== command) {
      sessionHistory.commands.push(command)
      
      // Limit history size
      if (sessionHistory.commands.length > sessionHistory.maxSize) {
        sessionHistory.commands.shift()
      }
    }

    sessionHistory.currentIndex = sessionHistory.commands.length
    history.value.set(sessionId, sessionHistory)
  }

  const clearHistory = (sessionId: string): void => {
    if (!validateSessionId(sessionId)) {
      return
    }
    
    const sessionHistory = history.value.get(sessionId)
    if (sessionHistory) {
      sessionHistory.commands = []
      sessionHistory.currentIndex = -1
      history.value.set(sessionId, sessionHistory)
    }
  }

  const navigateHistory = (sessionId: string, direction: 'up' | 'down'): string | null => {
    if (!validateSessionId(sessionId)) {
      return null
    }

    const sessionHistory = history.value.get(sessionId)
    if (!sessionHistory || sessionHistory.commands.length === 0) {
      return null
    }

    if (direction === 'up') {
      if (sessionHistory.currentIndex > 0) {
        sessionHistory.currentIndex--
        return sessionHistory.commands[sessionHistory.currentIndex] || null
      }
    } else if (direction === 'down') {
      if (sessionHistory.currentIndex < sessionHistory.commands.length - 1) {
        sessionHistory.currentIndex++
        return sessionHistory.commands[sessionHistory.currentIndex] || null
      } else if (sessionHistory.currentIndex === sessionHistory.commands.length - 1) {
        sessionHistory.currentIndex = sessionHistory.commands.length
        return '' // Return empty string when going past the last command
      }
    }

    return null
  }

  // Settings management
  const updateSettings = (newSettings: Partial<TerminalSettings>): void => {
    const updatedSettings = { ...settings.value, ...newSettings }
    
    if (!isValidTerminalSettings(updatedSettings)) {
      throw createTerminalValidationError('Invalid terminal settings', updatedSettings)
    }

    settings.value = updatedSettings
    
    // Trigger callbacks
    settingsChangedCallbacks.value.forEach(callback => {
      try {
        callback(updatedSettings)
      } catch (error) {
        console.error('Error in settings changed callback:', error)
      }
    })

    // Save to localStorage
    try {
      localStorage.setItem('terminal-settings', JSON.stringify(updatedSettings))
    } catch (error) {
      console.error('Failed to save terminal settings:', error)
    }
  }

  const resetSettings = (): void => {
    updateSettings({ ...TERMINAL_DEFAULT_SETTINGS })
  }

  const exportSettings = (): TerminalSettings => {
    return { ...settings.value }
  }

  const importSettings = (newSettings: TerminalSettings): void => {
    if (!isValidTerminalSettings(newSettings)) {
      throw createTerminalValidationError('Invalid terminal settings for import', newSettings)
    }
    updateSettings(newSettings)
  }

  // Private helper functions
  const addSession = (session: TerminalSession): void => {
    if (!isValidTerminalSession(session)) {
      console.error('Invalid session data:', session)
      return
    }

    const existingIndex = sessions.value.findIndex(s => s.id === session.id)
    if (existingIndex >= 0) {
      sessions.value[existingIndex] = session
    } else {
      sessions.value.push(session)
    }

    // Set as active if it's the first session or no active session
    if (!activeSessionId.value || sessions.value.length === 1) {
      setActiveSession(session.id)
    }

    // Trigger callbacks
    sessionCreatedCallbacks.value.forEach(callback => {
      try {
        callback(session)
      } catch (error) {
        console.error('Error in session created callback:', error)
      }
    })
  }

  const removeSession = (sessionId: string): void => {
    const sessionIndex = sessions.value.findIndex(s => s.id === sessionId)
    if (sessionIndex >= 0) {
      sessions.value.splice(sessionIndex, 1)
      
      // Clean up associated data
      output.value.delete(sessionId)
      history.value.delete(sessionId)
      
      // Clear any pending resize timer
      const timer = resizeTimers.value.get(sessionId)
      if (timer) {
        clearTimeout(timer)
        resizeTimers.value.delete(sessionId)
      }

      // Switch to another session if this was active
      if (activeSessionId.value === sessionId) {
        if (sessions.value.length > 0) {
          const firstSession = sessions.value[0]
          if (firstSession) {
            setActiveSession(firstSession.id)
          }
        } else {
          activeSessionId.value = null
        }
      }

      // Trigger callbacks
      sessionDestroyedCallbacks.value.forEach(callback => {
        try {
          callback(sessionId)
        } catch (error) {
          console.error('Error in session destroyed callback:', error)
        }
      })
    }
  }

  const setActiveSession = (sessionId: string): void => {
    if (activeSessionId.value !== sessionId) {
      activeSessionId.value = sessionId
      
      // Trigger callbacks
      sessionSwitchedCallbacks.value.forEach(callback => {
        try {
          callback(sessionId)
        } catch (error) {
          console.error('Error in session switched callback:', error)
        }
      })
    }
  }

  const updateSessionsList = (sessionsList: TerminalSession[]): void => {
    const validSessions = sessionsList.filter(isValidTerminalSession)
    sessions.value = validSessions

    // Ensure active session is still valid
    if (activeSessionId.value && !validSessions.find(s => s.id === activeSessionId.value)) {
      if (validSessions.length > 0) {
        const firstSession = validSessions[0]
        if (firstSession) {
          setActiveSession(firstSession.id)
        }
      } else {
        activeSessionId.value = null
      }
    }
  }

  const updateSessionActivity = (sessionId: string): void => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      session.lastActivity = new Date()
    }
  }

  const startHeartbeat = (): void => {
    if (heartbeatTimer.value) {
      clearInterval(heartbeatTimer.value)
    }

    heartbeatTimer.value = setInterval(() => {
      if (isConnected.value) {
        // Send heartbeat to keep terminal sessions alive
        const message: WebSocketMessage = {
          type: 'command',
          command: 'terminal.heartbeat',
          args: [],
          timestamp: Date.now()
        }

        webSocket.sendMessage(message).catch(error => {
          console.error('Failed to send terminal heartbeat:', error)
        })
      }
    }, TERMINAL_HEARTBEAT_INTERVAL)
  }

  const stopHeartbeat = (): void => {
    if (heartbeatTimer.value) {
      clearInterval(heartbeatTimer.value)
      heartbeatTimer.value = null
    }
  }

  // Load settings from localStorage
  const loadSettings = (): void => {
    try {
      const savedSettings = localStorage.getItem('terminal-settings')
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings)
        if (isValidTerminalSettings(parsedSettings)) {
          settings.value = parsedSettings
        }
      }
    } catch (error) {
      console.error('Failed to load terminal settings:', error)
    }
  }

  // Event handler registration
  const onOutput = (callback: (output: TerminalOutput) => void): void => {
    outputCallbacks.value.push(callback)
  }

  const onSessionCreated = (callback: (session: TerminalSession) => void): void => {
    sessionCreatedCallbacks.value.push(callback)
  }

  const onSessionDestroyed = (callback: (sessionId: string) => void): void => {
    sessionDestroyedCallbacks.value.push(callback)
  }

  const onSessionSwitched = (callback: (sessionId: string) => void): void => {
    sessionSwitchedCallbacks.value.push(callback)
  }

  const onSettingsChanged = (callback: (settings: TerminalSettings) => void): void => {
    settingsChangedCallbacks.value.push(callback)
  }

  // Initialize
  initializeWebSocket()
  loadSettings()

  // Cleanup on unmount
  onUnmounted(() => {
    stopHeartbeat()
    
    // Clear all timers
    resizeTimers.value.forEach(timer => clearTimeout(timer))
    resizeTimers.value.clear()
  })

  return {
    // State
    sessions,
    activeSession,
    activeSessionId,
    output,
    history,
    settings,
    isConnected,

    // Session management
    createSession,
    destroySession,
    switchSession,
    listSessions,
    getSession,

    // Input/Output
    sendInput,
    sendCommand,
    getOutput,
    clearOutput,
    resizeTerminal,

    // History management
    getHistory,
    addToHistory,
    clearHistory,
    navigateHistory,

    // Settings
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings,

    // Event handlers
    onOutput,
    onSessionCreated,
    onSessionDestroyed,
    onSessionSwitched,
    onSettingsChanged
  }
}