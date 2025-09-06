import * as React from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(
    'rounded-xl border border-border bg-card text-foreground shadow-sm',
    // Neo style - border replaces the regular border
    'neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)] neo:transition-transform neo:duration-100',
    className
  )} {...props} />
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-4 sm:p-6', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base sm:text-lg font-semibold leading-none tracking-tight', 'neo:font-extrabold neo:tracking-wide', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-6 pt-0', 'neo:border-t-2 neo:border-border neo:mt-2', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-4 sm:p-6 pt-0', 'neo:border-t-2 neo:border-border', className)} {...props} />
}
