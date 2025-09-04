import React from 'react'

export const RetryButton: React.FC<{ onClick: () => void; label?: string; className?: string }>
  = ({ onClick, label = 'Retry', className }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 ${className || ''}`}
  >
    {label}
  </button>
)

