import * as React from 'react'
import ConfirmDialog from '../../components/ui/confirm-dialog'

type ConfirmOptions = {
  title?: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'default' | 'secondary' | 'destructive'
}

export function useConfirm() {
  const [open, setOpen] = React.useState(false)
  const [opts, setOpts] = React.useState<ConfirmOptions>({})
  const resolverRef = React.useRef<(v: boolean) => void>()

  const confirm = React.useCallback((options?: ConfirmOptions) => {
    setOpts(options || {})
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const handleCancel = React.useCallback(() => {
    setOpen(false)
    resolverRef.current?.(false)
  }, [])

  const handleConfirm = React.useCallback(async () => {
    setOpen(false)
    resolverRef.current?.(true)
  }, [])

  const ConfirmUI = React.useCallback(() => (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      title={opts.title}
      description={opts.description}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel}
      confirmVariant={opts.confirmVariant}
    />
  ), [open, opts, handleCancel, handleConfirm])

  return [confirm, ConfirmUI] as const
}

export default useConfirm

