import React from 'react'
import { VirtualList } from '../lists/VirtualList'

export interface GitStatusItem { path: string; state: 'staged' | 'unstaged' | 'untracked' | 'conflicted' }

export const GitStatusList: React.FC<{ items: GitStatusItem[]; className?: string }>
  = ({ items, className }) => (
  <VirtualList
    items={items}
    itemKey={(it) => `${it.state}:${it.path}`}
    className={className}
    renderItem={(it) => (
      <div className="flex items-center justify-between px-3 py-2 text-sm border-b border-border/60">
        <span className="truncate mr-3">{it.path}</span>
        <span className="rounded px-2 py-0.5 text-xs bg-muted">
          {it.state}
        </span>
      </div>
    )}
  />
)

