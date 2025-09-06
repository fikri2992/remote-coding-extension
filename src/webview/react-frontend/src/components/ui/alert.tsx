import * as React from 'react'
import { cn } from '../../lib/utils'

export function Alert({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'info' | 'success' | 'warning' | 'destructive' }) {
  const variants: Record<string, string> = {
    default: 'bg-card text-foreground border-border',
    info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-800',
    success: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-200 dark:border-yellow-800',
    destructive: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-800',
  }
  return <div className={cn('rounded-lg border p-4 text-sm', 'neo:rounded-none neo:border-[5px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.35)] neo:font-semibold', variants[variant], className)} {...props} />
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-1 font-medium', 'neo:font-extrabold', className)} {...props} />
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('leading-relaxed', 'neo:text-foreground', className)} {...props} />
}
