import React from 'react'
import { cn } from '../../lib/utils'

export const ErrorState: React.FC<{ message?: string; onRetry?: () => void; className?: string }>
  = ({ message = 'Something went wrong.', onRetry, className }) => (
  <div className={cn('rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800', className)}>
    <div className="flex items-center justify-between">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="ml-3 rounded-md border border-red-300 bg-white px-2 py-1 text-red-700 hover:bg-red-100">
          Retry
        </button>
      )}
    </div>
  </div>
)

