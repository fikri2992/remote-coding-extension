import React from 'react'
import { cn } from '../../lib/utils'

export const ErrorState: React.FC<{ message?: string; onRetry?: () => void; className?: string }>
  = ({ message = 'Something went wrong.', onRetry, className }) => (
  <div className={cn('rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800', className)}>
    <div className="flex items-center justify-between">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="ml-3 rounded-md border border-destructive bg-card px-2 py-1 text-destructive hover:bg-destructive/10 neo:rounded-none neo:border-[3px] neo:shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[3px_3px_0_0_rgba(255,255,255,0.9)]">
          Retry
        </button>
      )}
    </div>
  </div>
)

