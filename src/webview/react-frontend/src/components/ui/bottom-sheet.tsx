import * as React from 'react'
import { cn } from '../../lib/utils'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}

export function BottomSheet({ open, onClose, children, className, ariaLabel }: BottomSheetProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label={ariaLabel || 'Sheet'}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn(
        'absolute inset-x-0 bottom-0 rounded-t-2xl bg-card shadow-xl border-t border-border',
        'p-4 sm:p-6 max-h-[85vh] overflow-auto',
        'neo:rounded-none neo:border-t-[3px] neo:shadow-[0_-6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[0_-6px_0_0_rgba(255,255,255,0.9)]',
        className
      )}>
        <div className="mx-auto h-1.5 w-10 rounded-full bg-muted mb-4 neo:rounded-none neo:border-2 neo:border-border" aria-hidden />
        {children}
      </div>
    </div>
  )
}

export function BottomSheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex items-center justify-between', className)} {...props} />
}

export function BottomSheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold', className)} {...props} />
}

export function BottomSheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex items-center justify-end gap-2', className)} {...props} />
}
