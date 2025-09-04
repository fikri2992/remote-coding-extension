import React from 'react'
import { cn } from '../../lib/utils'

export const EmptyState: React.FC<{ title?: string; description?: string; className?: string }>
  = ({ title = 'Nothing here yet', description = 'Try refreshing or add something new.', className }) => (
  <div className={cn('text-center text-muted-foreground py-8', className)}>
    <div className="text-base font-medium mb-1">{title}</div>
    <div className="text-sm">{description}</div>
  </div>
)

