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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start px-3 py-3 min-h-[44px] text-sm border-b border-border/60 neo:border-b-2 gap-3">
        <span className="neo:font-semibold whitespace-pre-wrap break-words text-left" style={{ overflowWrap: 'anywhere' }} title={it.path}>{it.path}</span>
        <span className="justify-self-end rounded-full px-2.5 py-1 text-[11px] bg-muted capitalize neo:rounded-none neo:border-2 neo:border-border">
          {it.state}
        </span>
      </div>
    )}
  />
)
