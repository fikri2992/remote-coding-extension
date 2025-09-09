import React from 'react'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../contexts/ReducedMotionContext'

export const TopProgressBar: React.FC<{ active: boolean; className?: string }>
  = ({ active, className }) => {
  const reduced = useReducedMotion()
  return (
    <div className={cn('relative h-0.5', className)} aria-hidden>
      {active && (
        <div className={cn('absolute inset-0 overflow-hidden', reduced ? 'bg-primary/20' : undefined)}>
          {reduced ? (
            <div className="h-full w-full bg-primary/50" />
          ) : (
            <div className="h-full w-1/3 bg-primary/80 animate-[progressSlide_1.2s_linear_infinite] rounded-r" />
          )}
        </div>
      )}
      {!reduced && (
        <style>{`
          @keyframes progressSlide {
            0% { transform: translateX(-120%); }
            60% { transform: translateX(160%); }
            100% { transform: translateX(160%); }
          }
        `}</style>
      )}
    </div>
  )
}

export default TopProgressBar
