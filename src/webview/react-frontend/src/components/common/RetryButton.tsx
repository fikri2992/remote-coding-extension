import React from 'react'

export const RetryButton: React.FC<{ onClick: () => void; label?: string; className?: string }>
  = ({ onClick, label = 'Retry', className }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)] ${className || ''}`}
  >
    {label}
  </button>
)

