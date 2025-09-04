import * as React from 'react'
import { cn } from '../../lib/utils'

export function RadioGroup({ className, value, onChange, children }: {
  className?: string
  value?: string
  onChange?: (value: string) => void
  children: React.ReactNode
}) {
  return <div className={cn('grid gap-2', className)} role="radiogroup">{React.Children.map(children, (child: any) => child && React.cloneElement(child, { groupValue: value, onChange }))}</div>
}

export function RadioGroupItem({ value, groupValue, onChange, className, children }: {
  value: string
  groupValue?: string
  onChange?: (value: string) => void
  className?: string
  children?: React.ReactNode
}) {
  const checked = groupValue === value
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={() => onChange?.(value)}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
        checked
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-foreground hover:bg-muted',
        className,
      )}
    >
      <span className={cn('h-3 w-3 rounded-full border', checked ? 'border-primary bg-primary' : 'border-border')} />
      {children}
    </button>
  )
}
