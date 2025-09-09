import React from 'react'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../contexts/ReducedMotionContext'

export const PendingSpinner: React.FC<{ className?: string; size?: 'xs'|'sm'|'md'; colorClass?: string; title?: string }>
  = ({ className, size = 'xs', colorClass = 'border-primary', title }) => {
  const dim = size === 'md' ? 'w-4 h-4' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3'
  const reduced = useReducedMotion()
  return (
    <div className={cn('inline-flex items-center', className)} aria-hidden title={title}>
      {reduced ? (
        <div className={cn(dim, 'rounded-full bg-primary/60', colorClass.includes('blue') ? 'bg-blue-600/70' : '')} />
      ) : (
        <div className={cn(dim, 'border-2 border-t-transparent rounded-full animate-spin', colorClass)} />
      )}
    </div>
  )
}

export default PendingSpinner
