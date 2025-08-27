export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface NotificationItem {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: Date
  autoClose?: boolean
}

export interface LoadingState {
  isLoading: boolean
  message?: string
  progress?: number
}

export interface ErrorInfo {
  code?: string
  message: string
  details?: any
  timestamp: Date
}
