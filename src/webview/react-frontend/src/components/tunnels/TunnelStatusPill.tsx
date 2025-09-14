import React from 'react'
import { Activity, AlertCircle, Loader2, PauseCircle } from 'lucide-react'
import { useReducedMotion } from '../../contexts/ReducedMotionContext'
import type { TunnelInfo } from '../../types/tunnel'

export const TunnelStatusPill: React.FC<{ status: TunnelInfo['status']; className?: string }> = ({ status, className }) => {
  const reduced = useReducedMotion()

  const base = 'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium'

  if (status === 'running') {
    return (
      <span className={[base, 'bg-green-50 text-green-700 border-green-200', className].filter(Boolean).join(' ')}>
        <span className="relative inline-flex h-2.5 w-2.5">
          {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60"></span>}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
        </span>
        Live
      </span>
    )
  }

  if (status === 'starting') {
    return (
      <span className={[base, 'bg-blue-50 text-blue-700 border-blue-200', className].filter(Boolean).join(' ')}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
        Connecting…
      </span>
    )
  }

  if (status === 'stopping') {
    return (
      <span className={[base, 'bg-yellow-50 text-yellow-700 border-yellow-200', className].filter(Boolean).join(' ')}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
        Stopping…
      </span>
    )
  }

  if (status === 'stopped') {
    return (
      <span className={[base, 'bg-gray-50 text-gray-700 border-gray-200', className].filter(Boolean).join(' ')}>
        <PauseCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
        Stopped
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className={[base, 'bg-red-50 text-red-700 border-red-200', className].filter(Boolean).join(' ')}>
        <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
        Error
      </span>
    )
  }

  return (
    <span className={[base, 'bg-gray-50 text-gray-700 border-gray-200', className].filter(Boolean).join(' ')}>
      <Activity className="h-3.5 w-3.5" strokeWidth={2.5} />
      Unknown
    </span>
  )
}
