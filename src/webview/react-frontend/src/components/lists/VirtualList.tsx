import React from 'react'
import { cn } from '../../lib/utils'

export interface VirtualListProps<T> {
  items: T[]
  itemKey: (item: T, index: number) => string | number
  renderItem: (item: T, index: number) => React.ReactNode
  /* Optional virtualization hints (not used in MVP implementation) */
  itemSize?: number
  overscan?: number
  className?: string
}

// MVP: simple passthrough renderer. Swap with react-virtual/react-window later.
export function VirtualList<T>({ items, itemKey, renderItem, className }: VirtualListProps<T>) {
  return (
    <div className={cn('neo:divide-y-[3px] neo:divide-border', className)}>
      {items.map((it, i) => (
        <div key={itemKey(it, i)} className="neo:bg-background neo:[&:hover]:bg-accent/10">
          {renderItem(it, i)}
        </div>
      ))}
    </div>
  )
}
