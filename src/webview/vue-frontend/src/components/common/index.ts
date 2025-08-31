// Common utility components
export { default as LoadingSpinner } from './LoadingSpinner.vue'
export { default as ErrorBoundary } from './ErrorBoundary.vue'
export { default as FallbackComponents } from './FallbackComponents.vue'
export { default as SafeComponent } from './SafeComponent.vue'
export { default as NotificationToast } from './NotificationToast.vue'
export { default as Modal } from './Modal.vue'
export { default as Dialog } from './Dialog.vue'
export { default as ConfirmationDialog } from './ConfirmationDialog.vue'
export { default as DebugPanel } from './DebugPanel.vue'

// Type definitions for component props
export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'white'
  message?: string
  overlay?: boolean
  center?: boolean
}

export interface ErrorBoundaryProps {
  title?: string
  message?: string
  showDetails?: boolean
  showReload?: boolean
  showReport?: boolean
  onRetry?: () => void | Promise<void>
  onReport?: (error: Error) => void
}

export interface ModalProps {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closable?: boolean
  closeOnOverlay?: boolean
  closeOnEscape?: boolean
  showHeader?: boolean
  showFooter?: boolean
  showCancel?: boolean
  showConfirm?: boolean
  cancelText?: string
  confirmText?: string
  loading?: boolean
  persistent?: boolean
  contentClass?: string
}

export interface DialogProps {
  modelValue: boolean
  title?: string
  message?: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'question'
  icon?: string
  size?: 'sm' | 'md' | 'lg'
  closable?: boolean
  closeOnOverlay?: boolean
  closeOnEscape?: boolean
  showCancel?: boolean
  showConfirm?: boolean
  cancelText?: string
  confirmText?: string
  loading?: boolean
  persistent?: boolean
}

export interface ConfirmationDialogProps {
  modelValue: boolean
  title?: string
  message?: string
  details?: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'question'
  destructive?: boolean
  destructiveWarning?: string
  requireConfirmation?: boolean
  confirmationText?: string
  showCancel?: boolean
  cancelText?: string
  confirmText?: string
  loading?: boolean
  persistent?: boolean
}

export interface FallbackComponentsProps {
  type?: 'automation' | 'file-system' | 'generic'
  error?: Error
  errorInfo?: any
}

export interface SafeComponentProps {
  componentName?: string
  title?: string
  message?: string
  category?: 'network' | 'validation' | 'authentication' | 'permission' | 'websocket' | 'filesystem' | 'git' | 'terminal' | 'ui' | 'unknown'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  showDetails?: boolean
  showReload?: boolean
  showReport?: boolean
  onRetry?: () => void | Promise<void>
  onError?: (error: Error, errorInfo: any) => void
}