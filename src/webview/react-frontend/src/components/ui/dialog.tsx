import * as React from 'react'
import { cn } from '../../lib/utils'

const FOCUSABLE = 'a[href], button, textarea, input, select, details, [tabindex]:not([tabindex="-1"])'

export function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const lastFocusedRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    // Save last focused element
    lastFocusedRef.current = (document.activeElement as HTMLElement) || null

    // Focus first focusable in panel
    const panel = panelRef.current
    const focusables = panel ? (Array.from(panel.querySelectorAll(FOCUSABLE)) as HTMLElement[]) : []
    const toFocus = focusables[0] || panel
    try { toFocus?.focus() } catch {}

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        if (!panel) return
        const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)) as HTMLElement[]
        if (nodes.length === 0) {
          e.preventDefault()
          return
        }
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // Restore focus
      try { lastFocusedRef.current?.focus() } catch {}
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          // Mobile-first: comfortable width with padding
          'relative z-50 w-[92%] max-w-md rounded-lg bg-card p-4 shadow-xl sm:p-6',
          // Neo brutalist look
          'neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]'
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex items-center justify-between', className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold', 'neo:font-extrabold', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex items-center justify-end gap-2', className)} {...props} />
}
