// Application constants
export const APP_NAME = 'Web Automation Tunnel'
export const APP_VERSION = '1.0.0'

// WebSocket configuration
export const WS_RECONNECT_INTERVAL = 3000
export const WS_MAX_RECONNECT_ATTEMPTS = 5
export const WS_HEARTBEAT_INTERVAL = 30000
export const WS_MESSAGE_TIMEOUT = 10000
export const WS_MAX_QUEUE_SIZE = 100
export const WS_PING_TIMEOUT = 5000
export const WS_HEALTH_CHECK_INTERVAL = 10000
export const WS_MAX_CONSECUTIVE_FAILURES = 3

// API endpoints
export const API_BASE_URL = '/api'
export const WS_BASE_URL = '/ws'

// Local storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'app-settings',
  THEME: 'app-theme',
  SIDEBAR_STATE: 'sidebar-collapsed',
  RECENT_FILES: 'recent-files',
  CHAT_DRAFTS: 'chat-drafts',
  CHAT_SETTINGS: 'chat-settings',
  CHAT_HISTORY: 'chat-history'
} as const

// File size limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_FILES_PER_UPLOAD = 5

// UI constants
export const SIDEBAR_WIDTH = 256
export const HEADER_HEIGHT = 64
export const FOOTER_HEIGHT = 32

// Notification durations
export const NOTIFICATION_DURATION = {
  INFO: 5000,
  SUCCESS: 3000,
  WARNING: 7000,
  ERROR: 10000
} as const

// Git file status colors
export const GIT_STATUS_COLORS = {
  M: 'text-yellow-600', // Modified
  A: 'text-green-600', // Added
  D: 'text-red-600', // Deleted
  R: 'text-blue-600', // Renamed
  C: 'text-purple-600', // Copied
  U: 'text-orange-600', // Unmerged
  '??': 'text-gray-600', // Untracked
  '!!': 'text-gray-400' // Ignored
} as const

// Command execution constants
export const COMMAND_TIMEOUT = 30000 // 30 seconds
export const COMMAND_CACHE_TTL = 300000 // 5 minutes
export const COMMAND_MAX_HISTORY = 100
export const COMMAND_MAX_RETRIES = 3
export const COMMAND_RETRY_DELAY = 1000

// Quick command categories
export const COMMAND_CATEGORIES = {
  FILE: 'File Operations',
  EDITOR: 'Editor',
  GIT: 'Git',
  TERMINAL: 'Terminal',
  WORKSPACE: 'Workspace',
  DEBUG: 'Debug',
  EXTENSION: 'Extensions',
  CUSTOM: 'Custom'
} as const

// File system constants
export const FILE_OPERATION_TIMEOUT = 15000 // 15 seconds
export const FILE_SEARCH_MAX_RESULTS = 1000
export const FILE_WATCH_DEBOUNCE = 500 // 500ms
export const FILE_MAX_SIZE_DISPLAY = 50 * 1024 * 1024 // 50MB
export const FILE_TREE_MAX_DEPTH = 10

// File type icons mapping
export const FILE_TYPE_ICONS = {
  // Programming languages
  js: 'pi-file-code',
  ts: 'pi-file-code',
  jsx: 'pi-file-code',
  tsx: 'pi-file-code',
  vue: 'pi-file-code',
  html: 'pi-file-code',
  css: 'pi-file-code',
  scss: 'pi-file-code',
  sass: 'pi-file-code',
  less: 'pi-file-code',
  json: 'pi-file-code',
  xml: 'pi-file-code',
  yaml: 'pi-file-code',
  yml: 'pi-file-code',
  
  // Documents
  md: 'pi-file-text',
  txt: 'pi-file-text',
  pdf: 'pi-file-pdf',
  doc: 'pi-file-word',
  docx: 'pi-file-word',
  
  // Images
  png: 'pi-image',
  jpg: 'pi-image',
  jpeg: 'pi-image',
  gif: 'pi-image',
  svg: 'pi-image',
  webp: 'pi-image',
  
  // Archives
  zip: 'pi-file-archive',
  rar: 'pi-file-archive',
  tar: 'pi-file-archive',
  gz: 'pi-file-archive',
  
  // Default
  default: 'pi-file'
} as const

// Git operation constants
export const GIT_COMMAND_TIMEOUT = 30000 // 30 seconds
export const GIT_STATUS_REFRESH_INTERVAL = 5000 // 5 seconds
export const GIT_MAX_COMMIT_HISTORY = 50
export const GIT_DIFF_CONTEXT_LINES = 3
export const GIT_MAX_DIFF_SIZE = 1024 * 1024 // 1MB

// Terminal constants
// Note: In webview context, we can't access process.platform directly
// The shell will be determined by the VS Code extension backend
export const TERMINAL_DEFAULT_SHELL = 'default'
export const TERMINAL_MAX_SESSIONS = 10
export const TERMINAL_MAX_OUTPUT_LINES = 10000
export const TERMINAL_MAX_HISTORY_SIZE = 1000
export const TERMINAL_RECONNECT_INTERVAL = 2000
export const TERMINAL_HEARTBEAT_INTERVAL = 30000
export const TERMINAL_INPUT_TIMEOUT = 5000
export const TERMINAL_RESIZE_DEBOUNCE = 300
export const TERMINAL_SCROLL_SENSITIVITY = 3

// Terminal default settings
export const TERMINAL_DEFAULT_SETTINGS = {
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
  theme: 'dark' as const,
  cursorStyle: 'block' as const,
  cursorBlink: true,
  scrollback: 1000,
  bellSound: false,
  copyOnSelect: false,
  pasteOnRightClick: true,
  wordSeparator: ' ()[]{}\'"`',
  allowTransparency: false,
  macOptionIsMeta: false,
  rightClickSelectsWord: true,
  fastScrollModifier: 'alt' as const,
  fastScrollSensitivity: 5
} as const

// Chat constants
export const CHAT_MESSAGE_TIMEOUT = 10000 // 10 seconds
export const CHAT_TYPING_TIMEOUT = 3000 // 3 seconds
export const CHAT_MAX_MESSAGE_LENGTH = 4000 // 4000 characters
export const CHAT_MAX_ATTACHMENTS = 5
export const CHAT_HISTORY_PAGE_SIZE = 50
export const CHAT_PRESENCE_UPDATE_INTERVAL = 30000 // 30 seconds
export const CHAT_TYPING_DEBOUNCE = 1000 // 1 second
export const CHAT_MAX_ROOMS = 50
export const CHAT_MAX_NOTIFICATIONS = 100
export const CHAT_SEARCH_DEBOUNCE = 300 // 300ms
export const CHAT_RECONNECT_DELAY = 2000 // 2 seconds
export const CHAT_MAX_DRAFT_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days
export const CHAT_MAX_HISTORY_CACHE = 1000 // messages per room

// Mobile WebSocket constants
export const MOBILE_WS_RETRY_BASE_DELAY = 1000 // Base delay for exponential backoff
export const MOBILE_WS_MAX_RETRY_DELAY = 30000 // Maximum retry delay
export const MOBILE_WS_CONNECTION_QUALITY_CHECK_INTERVAL = 5000 // Check connection quality every 5s
export const MOBILE_WS_BANDWIDTH_THRESHOLD = 1.0 // Mbps threshold for bandwidth-aware mode
export const MOBILE_WS_RTT_THRESHOLD = 500 // ms threshold for poor connection
export const MOBILE_WS_GESTURE_DEBOUNCE = 50 // ms debounce for gesture events
export const MOBILE_WS_LAYOUT_SYNC_DEBOUNCE = 200 // ms debounce for layout changes
export const MOBILE_WS_PRIORITY_QUEUE_SIZE = 20 // Priority messages that bypass normal queue limits
export const MOBILE_WS_LOW_BANDWIDTH_QUEUE_SIZE = 50 // Reduced queue size for low bandwidth
export const MOBILE_WS_HAPTIC_COOLDOWN = 100 // ms cooldown between haptic events
