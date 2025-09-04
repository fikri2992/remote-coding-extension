import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useWebSocket } from '../components/WebSocketProvider'

const FileViewerPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { sendJson, addMessageListener } = useWebSocket()
  const [content, setContent] = useState<string>('')
  const [meta, setMeta] = useState<{ path?: string; truncated?: boolean; size?: number }>({})
  const [error, setError] = useState<string | null>(null)
  const pendingIdRef = useRef<string | null>(null)

  const filePath = (location.search as any)?.path || ''

  useEffect(() => {
    if (!filePath) return
    const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    pendingIdRef.current = id
    sendJson({ type: 'fileSystem', id, data: { fileSystemData: { operation: 'open', path: filePath } } })
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'fileSystem') return
      if (msg.data?.operation !== 'open') return
      if (!pendingIdRef.current || msg.id !== pendingIdRef.current) return
      if (msg.data?.ok && msg.data?.result) {
        const r = msg.data.result
        setContent(r.content || '')
        setMeta({ path: r.path, truncated: r.truncated, size: r.size })
        setError(null)
      } else {
        setError(msg.data?.error || 'Failed to open file')
      }
      pendingIdRef.current = null
    })
    return unsub
  }, [filePath])

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground truncate">
          {meta.path || filePath || 'File'} {meta.truncated ? <span className="ml-2 text-amber-600">(truncated)</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" onClick={() => navigate({ to: '/files' })}>Back</button>
        </div>
      </div>
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>
      )}
      <div className="rounded-md border border-border bg-background max-h-[calc(100vh-12rem)] overflow-auto">
        <pre className="p-3 text-xs whitespace-pre-wrap">{content}</pre>
      </div>
    </div>
  )
}

export default FileViewerPage

