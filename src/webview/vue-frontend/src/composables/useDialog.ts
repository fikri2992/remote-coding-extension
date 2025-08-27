import { reactive } from 'vue'

export interface DialogOptions {
  title?: string
  message?: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'question'
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}

export interface ConfirmationOptions extends DialogOptions {
  destructive?: boolean
  destructiveWarning?: string
  requireConfirmation?: boolean
  confirmationText?: string
}

export interface DialogState {
  isOpen: boolean
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'question'
  confirmText: string
  cancelText: string
  showCancel: boolean
  loading: boolean
  resolve?: ((value: boolean) => void) | undefined
}

export interface ConfirmationState extends DialogState {
  destructive: boolean
  destructiveWarning: string
  requireConfirmation: boolean
  confirmationText: string
}

export function useDialog() {
  const dialogState = reactive<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: true,
    loading: false
  })

  const confirmationState = reactive<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'question',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    showCancel: true,
    loading: false,
    destructive: false,
    destructiveWarning: '',
    requireConfirmation: false,
    confirmationText: 'DELETE'
  })

  const showDialog = (options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      Object.assign(dialogState, {
        isOpen: true,
        title: options.title || 'Information',
        message: options.message || '',
        type: options.type || 'info',
        confirmText: options.confirmText || 'OK',
        cancelText: options.cancelText || 'Cancel',
        showCancel: options.showCancel ?? true,
        loading: false,
        resolve
      })
    })
  }

  const showConfirmation = (options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      Object.assign(confirmationState, {
        isOpen: true,
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure you want to proceed?',
        type: options.type || 'question',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        showCancel: options.showCancel ?? true,
        loading: false,
        destructive: options.destructive || false,
        destructiveWarning: options.destructiveWarning || '',
        requireConfirmation: options.requireConfirmation || false,
        confirmationText: options.confirmationText || 'DELETE',
        resolve
      })
    })
  }

  const handleDialogConfirm = () => {
    if (dialogState.resolve) {
      dialogState.resolve(true)
    }
    dialogState.isOpen = false
    dialogState.resolve = undefined
  }

  const handleDialogCancel = () => {
    if (dialogState.resolve) {
      dialogState.resolve(false)
    }
    dialogState.isOpen = false
    dialogState.resolve = undefined
  }

  const handleConfirmationConfirm = () => {
    if (confirmationState.resolve) {
      confirmationState.resolve(true)
    }
    confirmationState.isOpen = false
    confirmationState.resolve = undefined
  }

  const handleConfirmationCancel = () => {
    if (confirmationState.resolve) {
      confirmationState.resolve(false)
    }
    confirmationState.isOpen = false
    confirmationState.resolve = undefined
  }

  // Convenience methods
  const showInfo = (message: string, title = 'Information') => {
    return showDialog({ message, title, type: 'info', showCancel: false })
  }

  const showSuccess = (message: string, title = 'Success') => {
    return showDialog({ message, title, type: 'success', showCancel: false })
  }

  const showWarning = (message: string, title = 'Warning') => {
    return showDialog({ message, title, type: 'warning' })
  }

  const showError = (message: string, title = 'Error') => {
    return showDialog({ message, title, type: 'error', showCancel: false })
  }

  const confirm = (message: string, title = 'Confirm') => {
    return showConfirmation({ message, title, type: 'question' })
  }

  const confirmDestructive = (
    message: string,
    title = 'Confirm Destructive Action',
    options: Partial<ConfirmationOptions> = {}
  ) => {
    return showConfirmation({
      message,
      title,
      type: 'error',
      destructive: true,
      destructiveWarning: 'This action cannot be undone.',
      confirmText: 'Delete',
      ...options
    })
  }

  return {
    // State
    dialogState,
    confirmationState,

    // Methods
    showDialog,
    showConfirmation,
    handleDialogConfirm,
    handleDialogCancel,
    handleConfirmationConfirm,
    handleConfirmationCancel,

    // Convenience methods
    showInfo,
    showSuccess,
    showWarning,
    showError,
    confirm,
    confirmDestructive
  }
}