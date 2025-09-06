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
      <div className="flex items-center justify-between px-3 py-3 min-h-[44px] text-sm border-b border-border/60 neo:border-b-2">
        <span className="truncate mr-3 neo:font-semibold">{it.path}</span>
        <span className="rounded-full px-2.5 py-1 text-[11px] bg-muted capitalize neo:rounded-none neo:border-2 neo:border-border">
          {it.state}
        </span>
      </div>
    )}
  />
)
