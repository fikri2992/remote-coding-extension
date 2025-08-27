import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export interface AppSettings {
  // Server Configuration
  httpPort: number
  websocketPort: number
  allowedOrigins: string[]
  maxConnections: number
  enableCors: boolean
  
  // UI Preferences
  useEnhancedUI: boolean
  autoSave: boolean
  showLineNumbers: boolean
  wordWrap: boolean
  fontSize: number
  fontFamily: string
  
  // Editor Settings
  tabSize: number
  insertSpaces: boolean
  detectIndentation: boolean
  trimTrailingWhitespace: boolean
  
  // Terminal Settings
  terminalFontSize: number
  terminalFontFamily: string
  terminalCursorStyle: 'block' | 'line' | 'underline'
  
  // Git Settings
  autoFetch: boolean
  confirmSync: boolean
  showInlineChanges: boolean
  
  // Performance Settings
  enableVirtualScrolling: boolean
  maxFileSize: number // in MB
  enableCodeSplitting: boolean
}

const defaultSettings: AppSettings = {
  // Server Configuration
  httpPort: 8080,
  websocketPort: 8081,
  allowedOrigins: ['*'],
  maxConnections: 10,
  enableCors: true,
  
  // UI Preferences
  useEnhancedUI: true,
  autoSave: true,
  showLineNumbers: true,
  wordWrap: true,
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Consolas, monospace',
  
  // Editor Settings
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: true,
  trimTrailingWhitespace: true,
  
  // Terminal Settings
  terminalFontSize: 14,
  terminalFontFamily: 'JetBrains Mono, Consolas, monospace',
  terminalCursorStyle: 'block',
  
  // Git Settings
  autoFetch: false,
  confirmSync: true,
  showInlineChanges: true,
  
  // Performance Settings
  enableVirtualScrolling: true,
  maxFileSize: 10,
  enableCodeSplitting: true
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<AppSettings>({ ...defaultSettings })
  const isLoading = ref(false)
  const lastSaved = ref<Date | null>(null)
  const hasUnsavedChanges = ref(false)

  // Getters
  const serverConfig = computed(() => ({
    httpPort: settings.value.httpPort,
    websocketPort: settings.value.websocketPort,
    allowedOrigins: settings.value.allowedOrigins,
    maxConnections: settings.value.maxConnections,
    enableCors: settings.value.enableCors
  }))

  const editorConfig = computed(() => ({
    fontSize: settings.value.fontSize,
    fontFamily: settings.value.fontFamily,
    tabSize: settings.value.tabSize,
    insertSpaces: settings.value.insertSpaces,
    detectIndentation: settings.value.detectIndentation,
    trimTrailingWhitespace: settings.value.trimTrailingWhitespace,
    showLineNumbers: settings.value.showLineNumbers,
    wordWrap: settings.value.wordWrap
  }))

  const terminalConfig = computed(() => ({
    fontSize: settings.value.terminalFontSize,
    fontFamily: settings.value.terminalFontFamily,
    cursorStyle: settings.value.terminalCursorStyle
  }))

  const gitConfig = computed(() => ({
    autoFetch: settings.value.autoFetch,
    confirmSync: settings.value.confirmSync,
    showInlineChanges: settings.value.showInlineChanges
  }))

  // Watch for changes to mark as unsaved
  watch(settings, () => {
    hasUnsavedChanges.value = true
  }, { deep: true })

  // Actions
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    settings.value = { ...settings.value, ...newSettings }
  }

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    settings.value[key] = value
  }

  const resetToDefaults = () => {
    settings.value = { ...defaultSettings }
    hasUnsavedChanges.value = true
  }

  const resetSection = (section: 'server' | 'ui' | 'editor' | 'terminal' | 'git' | 'performance') => {
    switch (section) {
      case 'server':
        updateSettings({
          httpPort: defaultSettings.httpPort,
          websocketPort: defaultSettings.websocketPort,
          allowedOrigins: [...defaultSettings.allowedOrigins],
          maxConnections: defaultSettings.maxConnections,
          enableCors: defaultSettings.enableCors
        })
        break
      case 'ui':
        updateSettings({
          useEnhancedUI: defaultSettings.useEnhancedUI,
          autoSave: defaultSettings.autoSave,
          showLineNumbers: defaultSettings.showLineNumbers,
          wordWrap: defaultSettings.wordWrap,
          fontSize: defaultSettings.fontSize,
          fontFamily: defaultSettings.fontFamily
        })
        break
      case 'editor':
        updateSettings({
          tabSize: defaultSettings.tabSize,
          insertSpaces: defaultSettings.insertSpaces,
          detectIndentation: defaultSettings.detectIndentation,
          trimTrailingWhitespace: defaultSettings.trimTrailingWhitespace
        })
        break
      case 'terminal':
        updateSettings({
          terminalFontSize: defaultSettings.terminalFontSize,
          terminalFontFamily: defaultSettings.terminalFontFamily,
          terminalCursorStyle: defaultSettings.terminalCursorStyle
        })
        break
      case 'git':
        updateSettings({
          autoFetch: defaultSettings.autoFetch,
          confirmSync: defaultSettings.confirmSync,
          showInlineChanges: defaultSettings.showInlineChanges
        })
        break
      case 'performance':
        updateSettings({
          enableVirtualScrolling: defaultSettings.enableVirtualScrolling,
          maxFileSize: defaultSettings.maxFileSize,
          enableCodeSplitting: defaultSettings.enableCodeSplitting
        })
        break
    }
  }

  const loadFromStorage = async () => {
    isLoading.value = true
    try {
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to ensure all properties exist
        settings.value = { ...defaultSettings, ...parsed }
        hasUnsavedChanges.value = false
      }
    } catch (error) {
      console.warn('Failed to load settings from storage:', error)
      // Reset to defaults on error
      settings.value = { ...defaultSettings }
    } finally {
      isLoading.value = false
    }
  }

  const saveToStorage = async () => {
    try {
      localStorage.setItem('app-settings', JSON.stringify(settings.value))
      lastSaved.value = new Date()
      hasUnsavedChanges.value = false
      return true
    } catch (error) {
      console.error('Failed to save settings to storage:', error)
      return false
    }
  }

  const exportSettings = () => {
    return JSON.stringify(settings.value, null, 2)
  }

  const importSettings = (settingsJson: string) => {
    try {
      const imported = JSON.parse(settingsJson)
      // Validate imported settings have required structure
      const merged = { ...defaultSettings, ...imported }
      settings.value = merged
      return true
    } catch (error) {
      console.error('Failed to import settings:', error)
      return false
    }
  }

  const validateSettings = () => {
    const errors: string[] = []
    
    if (settings.value.httpPort < 1 || settings.value.httpPort > 65535) {
      errors.push('HTTP port must be between 1 and 65535')
    }
    
    if (settings.value.websocketPort < 1 || settings.value.websocketPort > 65535) {
      errors.push('WebSocket port must be between 1 and 65535')
    }
    
    if (settings.value.maxConnections < 1) {
      errors.push('Max connections must be at least 1')
    }
    
    if (settings.value.fontSize < 8 || settings.value.fontSize > 72) {
      errors.push('Font size must be between 8 and 72')
    }
    
    if (settings.value.tabSize < 1 || settings.value.tabSize > 8) {
      errors.push('Tab size must be between 1 and 8')
    }
    
    return errors
  }

  return {
    // State
    settings,
    isLoading,
    lastSaved,
    hasUnsavedChanges,
    // Getters
    serverConfig,
    editorConfig,
    terminalConfig,
    gitConfig,
    // Actions
    updateSettings,
    updateSetting,
    resetToDefaults,
    resetSection,
    loadFromStorage,
    saveToStorage,
    exportSettings,
    importSettings,
    validateSettings
  }
})
