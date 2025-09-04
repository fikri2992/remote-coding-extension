import React from 'react'
import { cn } from '../../lib/utils'

export const DiffView: React.FC<{ diff: string; className?: string }>
  = ({ diff, className }) => (
  <pre className={cn('rounded-md border border-border bg-background p-3 overflow-auto text-xs leading-relaxed', className)}>
    {diff || 'No changes'}
  </pre>
)

