import * as React from 'react'
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { cn } from '../../lib/utils'

export interface ConfirmDialogProps {
  open: boolean
  title?: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'default' | 'secondary' | 'destructive'
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  onOpenChange?: (open: boolean) => void
  loading?: boolean
  className?: string
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'destructive',
  onConfirm,
  onCancel,
  onOpenChange,
  loading = false,
  className,
}) => {
  const [submitting, setSubmitting] = React.useState(false)

  const handleClose = React.useCallback(() => {
    if (onOpenChange) onOpenChange(false)
    if (onCancel) onCancel()
  }, [onCancel, onOpenChange])

  const handleConfirm = React.useCallback(async () => {
    try {
      setSubmitting(true)
      await onConfirm()
      if (onOpenChange) onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }, [onConfirm, onOpenChange])

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className={cn('space-y-2', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && (
          <div className={cn('text-sm text-muted-foreground', 'neo:text-foreground neo:font-medium')}>
            {description}
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={submitting || loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={submitting || loading}
          >
            {(submitting || loading) ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}

export default ConfirmDialog

