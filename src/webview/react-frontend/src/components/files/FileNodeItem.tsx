import React from 'react'
import { cn } from '../../lib/utils'
import { Folder, File } from 'lucide-react'

export interface FileNodeLike {
  name: string
  path: string
  type: 'file' | 'directory'
  depth?: number
}

export const FileNodeItem: React.FC<{
  node: FileNodeLike
  onOpen: (node: FileNodeLike) => void
  onLongPress?: (node: FileNodeLike) => void
}>
  = ({ node, onOpen, onLongPress }) => {
  return (
    <button
      className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted active:scale-[0.99]')}
      style={{ paddingLeft: (node.depth ? node.depth * 12 : 0) + 12 }}
      onClick={() => onOpen(node)}
      onPointerDown={(_e) => {
        if (!onLongPress) return
        let timer: any
        const clear = () => timer && clearTimeout(timer)
        timer = setTimeout(() => onLongPress(node), 450)
        const up = () => { clear(); window.removeEventListener('pointerup', up, true) }
        window.addEventListener('pointerup', up, true)
      }}
    >
      {node.type === 'directory' ? <Folder className="w-4 h-4" /> : <File className="w-4 h-4" />}
      <span className="truncate text-sm text-foreground">{node.name}</span>
    </button>
  )
}

