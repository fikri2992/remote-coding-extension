import React from 'react'
import { cn } from '../../lib/utils'

export interface Crumb { name: string; path: string }

export const Breadcrumbs: React.FC<{ items: Crumb[]; onNavigate: (path: string) => void; className?: string }>
  = ({ items, onNavigate, className }) => (
  <nav className={cn('text-sm text-muted-foreground', className)} aria-label="Breadcrumb">
    <ol className="flex items-center gap-1 overflow-x-auto">
      {items.map((c, idx) => (
        <li key={c.path} className="flex items-center">
          <button
            className={cn('px-1 py-0.5 rounded hover:text-foreground', idx === items.length - 1 && 'font-medium text-foreground')}
            onClick={() => onNavigate(c.path)}
          >
            {c.name}
          </button>
          {idx < items.length - 1 && <span className="px-1">/</span>}
        </li>
      ))}
    </ol>
  </nav>
)

