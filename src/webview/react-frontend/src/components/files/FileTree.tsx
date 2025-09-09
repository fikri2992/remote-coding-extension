import React from 'react'
import { VirtualList } from '../lists/VirtualList'
import { FileNodeItem, FileNodeLike } from './FileNodeItem'
import { cn } from '../../lib/utils'

export interface FileTreeProps {
  nodes: FileNodeLike[]
  onOpen: (node: FileNodeLike) => void
  onLongPress?: (node: FileNodeLike) => void
  className?: string
  viewMode?: 'compact' | 'detailed'
  pendingPath?: string
}

export const FileTree: React.FC<FileTreeProps> = ({ nodes, onOpen, onLongPress, className, viewMode = 'detailed', pendingPath }) => {
  return (
    <div className={cn(viewMode === 'compact' ? "space-y-0" : "space-y-0.5", className)}>
      <VirtualList
        items={nodes}
        itemKey={(n) => n.path}
        renderItem={(n) => (
          <FileNodeItem node={n} onOpen={onOpen} onLongPress={onLongPress} viewMode={viewMode} pending={pendingPath === n.path} />
        )}
        className="space-y-0"
      />
    </div>
  )
}

