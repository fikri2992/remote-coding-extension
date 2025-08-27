export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  sessionId?: string
  timestamp: Date
  url: string
  userAgent: string
  buildVersion?: string
  environment?: string
  errorInfo?: string
  store?: string
  filename?: string
  lineno?: number
  colno?: number
  element?: string
  src?: string
  recoveryAction?: string
  additionalData?: Record<string, any>
}

export interface ErrorReport {
  id: string
  error: Error
  context: ErrorContext
  severity: ErrorSeverity
  category: ErrorCategory
  fingerprint?: string
  breadcrumbs: Breadcrumb[]
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ErrorCategory = 
  | 'network'
  | 'validation'
  | 'authentication'
  | 'permission'
  | 'websocket'
  | 'filesystem'
  | 'git'
  | 'terminal'
  | 'ui'
  | 'unknown'

export interface Breadcrumb {
  timestamp: Date
  category: string
  message: string
  level: 'debug' | 'info' | 'warning' | 'error'
  data?: Record<string, any> | undefined
}

export interface ErrorRecoveryAction {
  label: string
  action: () => void | Promise<void>
  primary?: boolean
}

export interface UserFriendlyError {
  title: string
  message: string
  recoveryActions?: ErrorRecoveryAction[]
  showTechnicalDetails?: boolean
  reportable?: boolean
}

export interface ErrorHandlerConfig {
  enableConsoleLogging: boolean
  enableErrorReporting: boolean
  enableUserNotifications: boolean
  maxBreadcrumbs: number
  reportingEndpoint?: string
  ignoredErrors: (string | RegExp)[]
  beforeSend?: (errorReport: ErrorReport) => ErrorReport | null
}

export class AppError extends Error {
  public readonly category: ErrorCategory
  public readonly severity: ErrorSeverity
  public readonly context: Partial<ErrorContext>
  public readonly userFriendly: UserFriendlyError
  public readonly recoverable: boolean

  constructor(
    message: string,
    category: ErrorCategory = 'unknown',
    severity: ErrorSeverity = 'medium',
    context: Partial<ErrorContext> = {},
    userFriendly?: Partial<UserFriendlyError>,
    recoverable = true
  ) {
    super(message)
    this.name = 'AppError'
    this.category = category
    this.severity = severity
    this.context = context
    this.recoverable = recoverable
    
    this.userFriendly = {
      title: userFriendly?.title || this.getDefaultTitle(),
      message: userFriendly?.message || this.getDefaultMessage(),
      recoveryActions: userFriendly?.recoveryActions || [],
      showTechnicalDetails: userFriendly?.showTechnicalDetails ?? true,
      reportable: userFriendly?.reportable ?? true
    }
  }

  private getDefaultTitle(): string {
    const titles: Record<ErrorCategory, string> = {
      network: 'Connection Error',
      validation: 'Invalid Input',
      authentication: 'Authentication Error',
      permission: 'Permission Denied',
      websocket: 'Connection Error',
      filesystem: 'File System Error',
      git: 'Git Operation Error',
      terminal: 'Terminal Error',
      ui: 'Interface Error',
      unknown: 'Unexpected Error'
    }
    return titles[this.category]
  }

  private getDefaultMessage(): string {
    const messages: Record<ErrorCategory, string> = {
      network: 'Unable to connect to the server. Please check your connection and try again.',
      validation: 'The information provided is not valid. Please check your input and try again.',
      authentication: 'Authentication failed. Please log in again.',
      permission: 'You do not have permission to perform this action.',
      websocket: 'Lost connection to the server. Attempting to reconnect...',
      filesystem: 'Unable to access the file system. Please try again.',
      git: 'Git operation failed. Please check your repository status.',
      terminal: 'Terminal operation failed. Please try again.',
      ui: 'An interface error occurred. Please refresh the page.',
      unknown: 'An unexpected error occurred. Please try again or contact support.'
    }
    return messages[this.category]
  }
}