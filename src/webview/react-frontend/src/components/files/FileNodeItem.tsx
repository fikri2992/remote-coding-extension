import React from 'react'
import { cn } from '../../lib/utils'
import { File } from 'lucide-react'
import { getFileIcon } from './getFileIcon'
import PendingSpinner from '../feedback/PendingSpinner'
import { useRipple } from '../../lib/hooks/useRipple'

export interface FileNodeLike {
  name: string
  path: string
  type: 'file' | 'directory'
  depth?: number
  size?: number // File size in bytes
  lastModified?: Date | string // Last modification date
  itemCount?: number // For directories - number of items inside
}

// Utility function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Utility function to format date
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}


export const FileNodeItem: React.FC<{
  node: FileNodeLike
  onOpen: (node: FileNodeLike) => void
  onLongPress?: (node: FileNodeLike) => void
  viewMode?: 'compact' | 'detailed'
  pending?: boolean
}>
  = React.memo(({ node, onOpen, onLongPress, viewMode = 'detailed', pending = false }) => {
  const icon = React.useMemo(() => getFileIcon(node.name, node.type), [node.name, node.type])
  const isCompact = viewMode === 'compact'
  const ripple = useRipple()
  
  // Memoize formatted values for performance
  const formattedSize = React.useMemo(() => 
    node.size !== undefined ? formatFileSize(node.size) : null, 
    [node.size]
  )
  
  const formattedDate = React.useMemo(() => 
    node.lastModified ? formatDate(node.lastModified) : null, 
    [node.lastModified]
  )
  
  const fileExtension = React.useMemo(() => 
    node.type === 'file' && node.name.includes('.') 
      ? node.name.split('.').pop()?.toUpperCase() 
      : null, 
    [node.name, node.type]
  )
  
  return (
    <button
      className={cn(
        'w-full flex items-center text-left transition-colors duration-150',
        'hover:bg-muted/60 active:bg-muted/80 active:scale-[0.99]',
        'neo:rounded-none neo:hover:bg-accent/10 neo:duration-100',
        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-muted/40',
        'relative overflow-hidden',
        // Responsive spacing and sizing
        isCompact 
          ? 'gap-2 px-3 py-2 min-h-[40px] sm:min-h-[36px]'
          : 'gap-3 px-4 py-3 min-h-[48px] sm:min-h-[44px]'
      )}
      aria-busy={pending || undefined}
      style={{ paddingLeft: (node.depth ? node.depth * (isCompact ? 12 : 16) : 0) + (isCompact ? 12 : 16) }}
      onClick={() => onOpen(node)}
      onPointerDown={(e) => {
        ripple.onPointerDown(e)
        if (!onLongPress) return
        let timer: any
        const clear = () => timer && clearTimeout(timer)
        timer = setTimeout(() => onLongPress(node), 450)
        const up = () => { clear(); window.removeEventListener('pointerup', up, true) }
        window.addEventListener('pointerup', up, true)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(node)
        }
        if (e.key === 'ContextMenu' && onLongPress) {
          e.preventDefault()
          onLongPress(node)
        }
      }}
    >
      {/* Enhanced icon with responsive sizing */}
      <div className="flex-shrink-0">
        {icon ? React.cloneElement(icon, {
          className: cn(
            icon.props.className,
            isCompact ? 'w-4 h-4' : 'w-5 h-5'
          )
        }) : (
          <File className={cn('text-gray-500', isCompact ? 'w-4 h-4' : 'w-5 h-5')} />
        )}
      </div>
      
      {/* Improved typography and file information */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'truncate font-medium leading-relaxed',
            'text-foreground neo:font-semibold',
            node.type === 'directory' ? 'text-foreground' : 'text-foreground/90',
            isCompact ? 'text-sm' : 'text-base'
          )}>
            {node.name}
          </span>
          
          {/* File extension badge - only in detailed mode */}
          {!isCompact && fileExtension && (
            <span className="px-1.5 py-0.5 text-xs text-muted-foreground/70 font-mono bg-muted/30 rounded neo:rounded-none neo:border neo:border-border/30">
              {fileExtension}
            </span>
          )}
        </div>
        
        {/* Enhanced file/directory information - only in detailed mode */}
        {!isCompact && (
          <div className="flex items-center gap-3 mt-0.5">
            {/* File size or directory item count */}
            {node.type === 'file' && formattedSize && (
              <span className="text-xs text-muted-foreground/60">
                {formattedSize}
              </span>
            )}
            
            {node.type === 'directory' && node.itemCount !== undefined && (
              <span className="text-xs text-muted-foreground/60">
                {node.itemCount} {node.itemCount === 1 ? 'item' : 'items'}
              </span>
            )}
            
            {/* Last modified date */}
            {formattedDate && (
              <>
                {(formattedSize || node.itemCount !== undefined) && (
                  <span className="text-xs text-muted-foreground/40">•</span>
                )}
                <span className="text-xs text-muted-foreground/60">
                  {formattedDate}
                </span>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Directory indicator */}
      {node.type === 'directory' && (
        <div className="flex-shrink-0 text-muted-foreground/50">
          {pending ? (
            <div className="ml-1">
              <PendingSpinner size="xs" />
            </div>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      )}
      {ripple.Ripple}
    </button>
  )
})

