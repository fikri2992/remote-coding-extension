import React from 'react'
import { cn } from '../../lib/utils'

export interface Crumb { name: string; path: string }

export const Breadcrumbs: React.FC<{ items: Crumb[]; onNavigate: (path: string) => void; className?: string }>
  = ({ items, onNavigate, className }) => (
  <nav className={cn('text-sm text-muted-foreground', className)} aria-label="Breadcrumb">
    <ol className="flex items-center gap-1 overflow-x-auto neo:gap-2">
      {items.map((c, idx) => (
        <li key={c.path} className="flex items-center">
          <button
            className={cn('px-1 py-0.5 rounded hover:text-foreground', 'neo:px-2 neo:py-1 neo:rounded-none neo:border-2 neo:border-border neo:shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[3px_3px_0_0_rgba(255,255,255,0.35)]', idx === items.length - 1 && 'font-medium text-foreground neo:bg-primary neo:text-primary-foreground')}
            onClick={() => onNavigate(c.path)}
          >
            {c.name}
          </button>
          {idx < items.length - 1 && <span className="px-1 neo:px-2 neo:text-foreground">▮</span>}
        </li>
      ))}
    </ol>
  </nav>
)
