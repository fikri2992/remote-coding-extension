import React from 'react'
import { VirtualList } from '../lists/VirtualList'

export interface GitStatusItem { path: string; state: 'staged' | 'unstaged' | 'untracked' | 'conflicted' }

export const GitStatusList: React.FC<{
  items: GitStatusItem[];
  className?: string;
  disabled?: boolean;
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
}>
  = ({ items, className, disabled, onStageFile, onUnstageFile }) => (
  <VirtualList
    items={items}
    itemKey={(it) => `${it.state}:${it.path}`}
    className={className}
    renderItem={(it) => (
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center px-3 py-3 min-h-[44px] text-sm border-b border-border/60 neo:border-b-2 gap-3">
        <span className="neo:font-semibold whitespace-pre-wrap break-words text-left" style={{ overflowWrap: 'anywhere' }} title={it.path}>{it.path}</span>
        <span className="justify-self-end rounded-full px-2.5 py-1 text-[11px] bg-muted capitalize neo:rounded-none neo:border-2 neo:border-border">
          {it.state}
        </span>
        {it.state === 'staged' ? (
          <button
            className="justify-self-end px-2 py-1 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50 neo:rounded-none neo:border-2"
            disabled={disabled}
            onClick={() => onUnstageFile && onUnstageFile(it.path)}
            title="Unstage file"
          >Unstage</button>
        ) : it.state === 'unstaged' || it.state === 'untracked' ? (
          <button
            className="justify-self-end px-2 py-1 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50 neo:rounded-none neo:border-2"
            disabled={disabled}
            onClick={() => onStageFile && onStageFile(it.path)}
            title="Stage file"
          >Stage</button>
        ) : (
          <span />
        )}
      </div>
    )}
  />
)
