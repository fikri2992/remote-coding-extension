import React from 'react'
import { VirtualList } from '../lists/VirtualList'
import { FileNodeItem, FileNodeLike } from './FileNodeItem'

export interface FileTreeProps {
  nodes: FileNodeLike[]
  onOpen: (node: FileNodeLike) => void
  onLongPress?: (node: FileNodeLike) => void
  className?: string
}

export const FileTree: React.FC<FileTreeProps> = ({ nodes, onOpen, onLongPress, className }) => {
  return (
    <VirtualList
      items={nodes}
      itemKey={(n) => n.path}
      renderItem={(n) => (
        <FileNodeItem node={n} onOpen={onOpen} onLongPress={onLongPress} />
      )}
      className={className}
    />
  )
}

