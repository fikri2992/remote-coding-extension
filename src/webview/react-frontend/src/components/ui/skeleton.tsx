import * as React from 'react'
import { cn } from '../../lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200', 'neo:rounded-none neo:border-2 neo:border-border neo:bg-muted', className)} {...props} />
}
