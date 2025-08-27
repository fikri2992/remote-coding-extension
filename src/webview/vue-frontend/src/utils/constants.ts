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
  RECENT_FILES: 'recent-files'
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
