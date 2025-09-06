import React from 'react'
import { cn } from '../../lib/utils'

export const DiffView: React.FC<{ diff: string; className?: string }>
  = ({ diff, className }) => (
  <pre className={cn(
    'rounded-md border border-border bg-background p-3 overflow-auto text-xs leading-relaxed',
    'neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]',
    className
  )}>
    {diff || 'No changes'}
  </pre>
)
