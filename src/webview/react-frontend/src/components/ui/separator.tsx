import * as React from 'react'
import { cn } from '../../lib/utils'

export function Separator({ className, orientation = 'horizontal', ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="separator"
      className={cn(
        'bg-gray-200',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        'neo:bg-foreground',
        orientation === 'horizontal' ? 'neo:h-1' : 'neo:w-1',
        className,
      )}
      {...props}
    />
  )
}
