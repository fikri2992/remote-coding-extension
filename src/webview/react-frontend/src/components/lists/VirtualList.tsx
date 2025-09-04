import React from 'react'

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
    <div className={className}>
      {items.map((it, i) => (
        <div key={itemKey(it, i)}>{renderItem(it, i)}</div>
      ))}
    </div>
  )
}

