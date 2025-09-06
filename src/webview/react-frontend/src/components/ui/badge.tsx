import * as React from 'react'
import { cn } from '../../lib/utils'

export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }) {
  const variants: Record<string, string> = {
    default: 'bg-gray-100 text-gray-800 neo:bg-muted neo:text-foreground',
    secondary: 'bg-blue-100 text-blue-800 neo:bg-accent neo:text-accent-foreground',
    success: 'bg-green-100 text-green-800 neo:bg-green-500 neo:text-white',
    warning: 'bg-yellow-100 text-yellow-800 neo:bg-yellow-500 neo:text-black',
    destructive: 'bg-red-100 text-red-800 neo:bg-destructive neo:text-destructive-foreground',
  }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', 'neo:rounded-none neo:border-2 neo:border-border neo:shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[3px_3px_0_0_rgba(255,255,255,0.9)] neo:font-bold', variants[variant], className)} {...props} />
}
