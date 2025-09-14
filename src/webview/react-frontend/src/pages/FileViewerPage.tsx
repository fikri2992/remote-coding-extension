
import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useWebSocket } from '../components/WebSocketProvider'
import { useFileCache } from '../contexts/FileCacheContext'
import { useViewState } from '../contexts/ViewStateContext'
import { SyntaxHighlighter } from '../components/code/SyntaxHighlighter'
import CodeViewer, { type CodeViewerHandle } from '../components/code/CodeViewer'
import { CodeToolbar, type CodeTheme, type FontSize } from '../components/code/CodeToolbar'
import { CodeBottomBar } from '../components/code/CodeBottomBar'
import CodeOptionsSheet from '../components/code/CodeOptionsSheet'
import CodeSearchRow from '../components/code/CodeSearchRow'
import CodeSelectionRow from '../components/code/CodeSelectionRow'
import { usePersistentState } from '../lib/hooks/usePersistentState'
import { useMediaQuery } from '../lib/hooks/useMediaQuery'
import MarkdownRenderer from '../components/code/MarkdownRenderer'
import GoToLineModal from '../components/code/GoToLineModal'
import { cn } from '../lib/utils'
import { TopProgressBar } from '../components/feedback/TopProgressBar'
import { usePendingNav } from '../contexts/PendingNavContext'
import { useDelayedFlag } from '../lib/hooks/useDelayedFlag'
import { useLiveRegion } from '../contexts/LiveRegionContext'
import { useToast } from '../components/ui/toast'
import PendingSpinner from '../components/feedback/PendingSpinner'
import { useRipple } from '../lib/hooks/useRipple'
import ImagePreview from '../components/files/ImagePreview'
import MediaTabs from '../components/files/MediaTabs'
import BinaryCodeNotice from '../components/files/BinaryCodeNotice'
import type { ImageFileData, ImagePreviewState } from '../types/image'

const FileViewerPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { sendJson, addMessageListener, isConnected } = useWebSocket()
  const { setFile, peekFile } = useFileCache()
  const { getFileState, setFileState } = useViewState()
  const pendingNav = usePendingNav()
  const live = useLiveRegion()
  const { show } = useToast()
  const backRipple = useRipple()
  const viewerRefreshRipple = useRipple()

  const [content, setContent] = useState<string>('')
  const [meta, setMeta] = useState<{ path?: string; truncated?: boolean; size?: number; encoding?: string; contentType?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const refreshSpinnerDelayed = useDelayedFlag(refreshing, 150)
  
  // Image handling state
  const [imageState, setImageState] = useState<ImagePreviewState>({
    mediaView: 'preview',
    isLoading: false,
  })
  const [imageData, setImageData] = useState<ImageFileData | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const [fontSize, setFontSize] = usePersistentState<FontSize>('fontSize', 'base')
  const [showLineNumbers, setShowLineNumbers] = usePersistentState<boolean>('lineNumbers', true)
  const [theme, setTheme] = usePersistentState<CodeTheme>('theme', 'default')
  const [wrap, setWrap] = usePersistentState<boolean>('wrap', false)
  const [indentGuides, setIndentGuides] = usePersistentState<boolean>('indentGuides', false)
  const [wrapColumn, setWrapColumn] = usePersistentState<number | undefined>('wrapColumn', undefined)
  const [whitespace, setWhitespace] = usePersistentState<boolean>('whitespace', false)
  const [languageOverride, setLanguageOverride] = usePersistentState<string | undefined>('language', undefined)
  const [isMarkdownRendered, setIsMarkdownRendered] = usePersistentState<boolean>('mdRendered', true)

  const viewerRef = useRef<CodeViewerHandle | null>(null)
  const bottomBarRef = useRef<HTMLDivElement | null>(null)
  const [bottomPad, setBottomPad] = useState<number>(0)
  const [fileStats, setFileStats] = useState<{ lines: number; length: number }>({ lines: 0, length: 0 })
  const [selInfo, setSelInfo] = useState<{ chars: number; lines: number }>({ chars: 0, lines: 0 })
  const selInfoRef = useRef<{ chars: number; lines: number }>({ chars: 0, lines: 0 })
  const selectionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const selectionThrottleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSelectionUpdateRef = useRef<number>(0)
  const isSelectingRef = useRef<boolean>(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [gotoOpen, setGotoOpen] = useState(false)
  const [searchQuery, setSearchQuery] = usePersistentState<string>('searchQuery', '')
  const [searchOpts, setSearchOpts] = usePersistentState<{ caseSensitive: boolean; regexp: boolean; wholeWord: boolean }>('searchOpts', { caseSensitive: false, regexp: false, wholeWord: false })
  const isMobile = useMediaQuery('(max-width: 767px)')
  const pendingIdRef = useRef<string | null>(null)
  const fileWsUnsubRef = useRef<(() => void) | null>(null)

  const filePath = (location.search as any)?.path || ''
  const fromDir = (location.search as any)?.from as string | undefined
  const pathname = (location as any)?.pathname || ''
  
  // Image detection helpers
  const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg'])
  
  const isImageFile = (path: string): boolean => {
    const ext = path.split('.').pop()?.toLowerCase()
    return ext ? imageExtensions.has(ext) : false
  }
  
  const isSvgFile = (path: string): boolean => {
    return path.toLowerCase().endsWith('.svg')
  }
  
  const breadcrumbs = React.useMemo(() => {
    const path = (meta.path || filePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
    if (!path) return [] as { name: string; full: string }[]
    const parts = path.split('/')
    const acc: { name: string; full: string }[] = []
    parts.forEach((p: string, i: number) => {
      const full = '/' + parts.slice(0, i + 1).join('/')
      acc.push({ name: p || '/', full })
    })
    return acc
  }, [meta.path, filePath])

  const loadFile = async (path: string, background: boolean = false) => {
    if (!path || !isConnected) return

    const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    pendingIdRef.current = id
    // Cancel any previous in-flight listener before starting a new request
    if (fileWsUnsubRef.current) {
      try { fileWsUnsubRef.current() } catch {}
      fileWsUnsubRef.current = null
    }
    if (!background) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    
    sendJson({ type: 'fileSystem', id, data: { fileSystemData: { operation: 'open', path } } })
    
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'fileSystem') return
      if (msg.data?.operation !== 'open') return
      if (!pendingIdRef.current || msg.id !== pendingIdRef.current) return
      
      if (msg.data?.ok && msg.data?.result) {
        const r = msg.data.result
        
        // Handle image files
        if (isImageFile(path)) {
          const imageFileData: ImageFileData = {
            path: r.path,
            size: r.size || 0,
            contentType: r.contentType || 'application/octet-stream',
            encoding: r.encoding || 'utf8',
            truncated: r.truncated || false,
          }
          
          if (r.encoding === 'base64' && r.base64) {
            // Raster image
            imageFileData.base64 = r.base64
          } else if (r.content) {
            // SVG or text-based image
            imageFileData.content = r.content
          }
          
          setImageData(imageFileData)
          setContent(r.content || '')
          setMeta({ 
            path: r.path, 
            truncated: r.truncated || false, 
            size: r.size || 0,
            encoding: r.encoding,
            contentType: r.contentType
          })
          
          // Create blob URL for raster images
          if (r.encoding === 'base64' && r.base64) {
            // Clean up previous blob URL
            if (blobUrlRef.current) {
              URL.revokeObjectURL(blobUrlRef.current)
              blobUrlRef.current = null
            }
            
            // Create new blob URL
            const byteCharacters = atob(r.base64)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: imageFileData.contentType })
            blobUrlRef.current = URL.createObjectURL(blob)
            setImageState(prev => ({ ...prev, blobUrl: blobUrlRef.current || undefined }))
          } else if (isSvgFile(path) && r.content) {
            // Create blob URL for SVG
            if (blobUrlRef.current) {
              URL.revokeObjectURL(blobUrlRef.current)
              blobUrlRef.current = null
            }
            
            const blob = new Blob([r.content], { type: 'image/svg+xml' })
            blobUrlRef.current = URL.createObjectURL(blob)
            setImageState(prev => ({ ...prev, blobUrl: blobUrlRef.current || undefined }))
          }
        } else {
          // Handle regular files
          const contentStr = r.content || ''
          // Precompute file stats before first render to avoid initial flicker
          try {
            const len = contentStr.length
            let lines = 0
            for (let i = 0; i < contentStr.length; i++) {
              if (contentStr.charCodeAt(i) === 10) lines++ // '\n'
            }
            if (len > 0) lines += 1
            setFileStats({ lines, length: len })
          } catch {}

          const fileContent = {
            path: r.path,
            content: contentStr,
            size: r.size || 0,
            truncated: r.truncated || false,
            mimeType: r.mimeType,
            encoding: r.encoding,
          }
          
          // Cache the result
          setFile(path, fileContent).catch(console.warn)
          
          setContent(fileContent.content)
          setMeta({ path: fileContent.path, truncated: fileContent.truncated, size: fileContent.size })
          
          // Clear image data when not an image
          setImageData(null)
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current)
            blobUrlRef.current = null
          }
          setImageState(prev => ({ ...prev, blobUrl: undefined }))
        }
        
        setError(null)
        pendingNav.finish(path)
        live.announce('Loaded')
      } else {
        const errText = msg.data?.error || 'Failed to open file'
        setError(errText)
        pendingNav.fail(msg.data?.error)
        live.announce('Failed to open file')
        show({ title: 'Failed to open', description: errText, variant: 'destructive' })
      }
      
      pendingIdRef.current = null
      setLoading(false)
      setRefreshing(false)
      unsub()
      if (fileWsUnsubRef.current === unsub) fileWsUnsubRef.current = null
    })
    // Track unsubscribe so we can cancel on route change/unmount
    fileWsUnsubRef.current = unsub
  }

  useEffect(() => {
    // Guard against transient updates when navigating away from this route
    if (pathname !== '/files/view') return
    if (!filePath) return
    // Try view-state first for instant paint
    const vs = getFileState(filePath)
    if (vs && typeof vs.content === 'string' && vs.content.length > 0) {
      setContent(vs.content)
      // Precompute file stats from cached view-state for stable gutter width
      try {
        const len = vs.content.length
        let lines = 0
        for (let i = 0; i < vs.content.length; i++) {
          if (vs.content.charCodeAt(i) === 10) lines++ // '\n'
        }
        if (len > 0) lines += 1
        setFileStats({ lines, length: len })
      } catch {}
      if (vs.meta) setMeta(vs.meta)
      setLoading(false)
      setRefreshing(true)
      loadFile(filePath, true)
      return
    }
    // Try memory cache (allow stale)
    const cached = peekFile(filePath, { allowStale: true })
    if (cached) {
      setContent(cached.content)
      // Precompute file stats from cache for stable gutter width
      try {
        const len = cached.content.length
        let lines = 0
        for (let i = 0; i < cached.content.length; i++) {
          if (cached.content.charCodeAt(i) === 10) lines++ // '\n'
        }
        if (len > 0) lines += 1
        setFileStats({ lines, length: len })
      } catch {}
      setMeta({ path: cached.path, truncated: cached.truncated, size: cached.size })
      setLoading(false)
      setRefreshing(true)
      loadFile(filePath, true)
      return
    }
    // Otherwise, do regular fetch
    setRefreshing(false)
    loadFile(filePath, false)
  }, [filePath, isConnected, pathname])

  // Persist view-state whenever content/meta updates
  useEffect(() => {
    if (!filePath) return
    setFileState(filePath, { content, meta })
  }, [filePath, content, meta, setFileState])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const copyToClipboard = async () => {
    try { await navigator.clipboard.writeText(content) } catch (err) { console.error('Failed to copy:', err) }
  }
  const copySelection = async () => {
    try {
      const sel = viewerRef.current?.getSelectionInfo()
      if (!sel || !sel.text) return
      await navigator.clipboard.writeText(sel.text)
    } catch (err) { console.error('Failed to copy selection:', err) }
  }
  const downloadFile = () => {
    try {
      let blob: Blob
      let url: string
      
      if (imageData && imageData.base64) {
        // Handle binary image files
        const byteCharacters = atob(imageData.base64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        blob = new Blob([byteArray], { type: imageData.contentType })
      } else if (imageData && imageData.content) {
        // Handle SVG files
        blob = new Blob([imageData.content], { type: 'image/svg+xml' })
      } else {
        // Handle text files
        blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      }
      
      url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const name = (meta.path || filePath || 'file.txt').split('/').pop() || 'file.txt'
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) { console.error('Failed to download:', err) }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSearchOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (selectionUpdateTimeoutRef.current) {
        clearTimeout(selectionUpdateTimeoutRef.current)
      }
      if (selectionThrottleTimeoutRef.current) {
        clearTimeout(selectionThrottleTimeoutRef.current)
      }
      // Cancel any pending WS listener on unmount to avoid late toasts
      if (fileWsUnsubRef.current) {
        try { fileWsUnsubRef.current() } catch {}
        fileWsUnsubRef.current = null
      }
      pendingIdRef.current = null
    }
  }, [])

  // If we navigate away from the file viewer route, cancel any pending listener
  useEffect(() => {
    if (pathname !== '/files/view') {
      if (fileWsUnsubRef.current) {
        try { fileWsUnsubRef.current() } catch {}
        fileWsUnsubRef.current = null
      }
      pendingIdRef.current = null
    }
  }, [pathname])

  // Close search row on significant scroll in the viewer area
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    let lastY = el.scrollTop
    const onScroll = () => {
      const dy = Math.abs(el.scrollTop - lastY)
      lastY = el.scrollTop
      if (dy > 30 && searchOpen) setSearchOpen(false)
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [searchOpen])

  const shouldFallback = React.useMemo(() => fileStats.length > 1_000_000 || fileStats.lines > 20000 || !!meta.truncated, [fileStats.length, fileStats.lines, meta.truncated])
  const languageOptions = React.useMemo(() => ['javascript', 'typescript', 'json', 'html', 'css', 'markdown', 'xml'], [])
  const isMarkdown = React.useMemo(() => (filePath || '').toLowerCase().endsWith('.md'), [filePath])
  const selectionActive = React.useMemo(() => selInfoRef.current.chars > 0, [selInfoRef.current.chars])
  const showSelectionRow = React.useMemo(() => selectionActive && !searchOpen && !optionsOpen, [selectionActive, searchOpen, optionsOpen])

  // Chunked viewing for very large files
  const CHUNK_LINE_THRESHOLD = 3000
  const CHUNK_SIZE = 1000
  const [chunkIndex, setChunkIndex] = useState(0)
  const isChunked = fileStats.lines >= CHUNK_LINE_THRESHOLD
  const totalChunks = isChunked ? Math.ceil((fileStats.lines || 0) / CHUNK_SIZE) : 1
  const chunkStart = isChunked ? chunkIndex * CHUNK_SIZE + 1 : 1
  const chunkEnd = isChunked ? Math.min((chunkIndex + 1) * CHUNK_SIZE, fileStats.lines || 0) : fileStats.lines || 0
  const visibleContent = React.useMemo(() => {
    if (!isChunked) return content
    const lines = content.split('\n')
    return lines.slice(chunkStart - 1, chunkEnd).join('\n')
  }, [content, isChunked, chunkStart, chunkEnd])

  const showTopBar = useDelayedFlag(pendingNav.isActive, 200)

  // Measure mobile bottom bar height and pad the scroll container accordingly
  useEffect(() => {
    const el = bottomBarRef.current
    if (!el) { setBottomPad(0); return }
    const measure = () => setBottomPad(el.offsetHeight || 0)
    measure()
    let ro: ResizeObserver | null = null
    try {
      ro = new ResizeObserver(() => measure())
      ro.observe(el)
    } catch {}
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      if (ro) try { ro.disconnect() } catch {}
    }
  }, [optionsOpen, searchOpen, wrap, showLineNumbers, indentGuides, whitespace, fontSize])

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)] flex flex-col h-full min-h-0">
      {/* Header - Mobile Responsive */}
      <div className="p-3 sm:p-4 border-b border-border bg-muted/20 neo:border-b-[2px]" aria-busy={loading || refreshing || undefined}>
        <TopProgressBar active={showTopBar} />
        {/* Top row: Breadcrumbs and Back button */}
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm sm:text-base font-medium text-foreground truncate">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {breadcrumbs.length === 0 && (meta.path || filePath || 'File')}
                {breadcrumbs.map((b, idx) => (
                  <React.Fragment key={b.full}>
                    {idx > 0 && <span className="text-muted-foreground/60">/</span>}
                    <button
                      className="text-foreground/90 hover:underline truncate whitespace-nowrap"
                      onClick={() => navigate({ to: '/files', search: { path: b.full } as any })}
                      title={b.full}
                    >
                      {b.name || '/'}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
            
            {/* Mobile file info */}
            <div className="md:hidden flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {meta.size && <span>{formatFileSize(meta.size)}</span>}
              <span>{fileStats.lines} lines</span>
              <span className="font-mono">{filePath.split('.').pop()?.toUpperCase()}</span>
              {meta.truncated && <span className="text-amber-600 font-medium">(truncated)</span>}
            </div>
            
            {/* Desktop file info */}
            <div className="hidden md:flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {meta.size && <span>{formatFileSize(meta.size)}</span>}
              {meta.truncated && <span className="text-amber-600 font-medium">(truncated)</span>}
              <span>{fileStats.lines} lines</span>
              <span className="font-mono">{filePath.split('.').pop()?.toUpperCase()}</span>
            </div>
          </div>
          
          {/* Back + Refresh */}
          <div className="flex items-center gap-2 ml-2 shrink-0">
            {refreshing && (
              <div className="hidden sm:flex items-center gap-1 text-blue-600 text-xs mr-1">
                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Refreshing…</span>
              </div>
            )}
            <button 
              onClick={() => {
                // Prefer returning to the directory we came from if provided
                const dest = fromDir || (breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].full : '/')
                pendingNav.start({ type: 'directory', path: dest, label: 'Back' })
                live.announce('Opening parent')
                navigate({ to: '/files', search: { path: dest } as any })
              }} 
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px]"
              onPointerDown={(e) => backRipple.onPointerDown(e as any)}
            >
              {pendingNav.isActive ? (
                <span className="inline-flex items-center gap-2">
                  <PendingSpinner size="xs" />
                  Back
                </span>
              ) : 'Back'}
              {backRipple.Ripple}
            </button>
            <button
              onClick={() => { if (filePath) { setRefreshing(true); loadFile(filePath, true) } }}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px]"
              onPointerDown={(e) => viewerRefreshRipple.onPointerDown(e as any)}
            >
              <span className="inline-flex items-center gap-2">
                <span>Refresh</span>
                {refreshSpinnerDelayed && (<PendingSpinner size="xs" />)}
              </span>
              {viewerRefreshRipple.Ripple}
            </button>
          </div>
        </div>

        {/* Mobile action buttons */}
        <div className="md:hidden flex items-center gap-2 mb-3 overflow-x-auto">
          <button onClick={copyToClipboard} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px] whitespace-nowrap">Copy</button>
          <button onClick={copySelection} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px] whitespace-nowrap">Copy Selection</button>
          <button onClick={downloadFile} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px] whitespace-nowrap">Download</button>
        </div>

        {/* Mobile: Image view tabs (Preview / Code) */}
        {isImageFile(filePath) && (
          <div className="md:hidden mb-3">
            <MediaTabs
              activeTab={imageState.mediaView}
              onTabChange={(tab) => setImageState(prev => ({ ...prev, mediaView: tab }))}
            />
          </div>
        )}

        {/* Desktop action buttons */}
        <div className="hidden md:flex items-center gap-2 mb-3">
          <button onClick={copyToClipboard} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px]">Copy</button>
          <button onClick={copySelection} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px]">Copy Selection</button>
          <button onClick={downloadFile} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px]">Download</button>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:block">
          {isImageFile(filePath) && (
            <div className="mb-3">
              <MediaTabs
                activeTab={imageState.mediaView}
                onTabChange={(tab) => setImageState(prev => ({ ...prev, mediaView: tab }))}
              />
            </div>
          )}
          <CodeToolbar
            wrap={wrap}
            lineNumbers={showLineNumbers}
            indentGuides={indentGuides}
            whitespace={whitespace}
            wrapColumn={wrapColumn ?? 0}
            fontSize={fontSize}
            theme={theme}
            language={languageOverride || undefined}
            languageOptions={languageOptions}
            onToggleWrap={setWrap}
            onToggleLineNumbers={setShowLineNumbers}
            onToggleIndentGuides={setIndentGuides}
            onToggleWhitespace={setWhitespace}
            onWrapColumnChange={setWrapColumn}
            onFontSizeChange={setFontSize}
            onThemeChange={setTheme}
            onLanguageChange={setLanguageOverride}
            onFindOpen={() => setSearchOpen(true)}
            onGotoOpen={() => setGotoOpen(true)}
          />
        </div>

        {/* Desktop status */}
        <div className="hidden md:flex px-4 py-1 text-xs text-muted-foreground border-b border-border items-center justify-between">
          <div className="flex items-center gap-3">
            <span>{fileStats.lines} lines</span>
            {meta.size ? <span>{formatFileSize(meta.size)}</span> : null}
            {meta.truncated ? <span className="text-amber-600">truncated</span> : null}
          </div>
          <div className="flex items-center gap-3">
            {selInfo.chars > 0 ? <span>Selection: {selInfo.chars} chars • {selInfo.lines} lines</span> : <span>Selection: —</span>}
            {wrap && wrapColumn ? <span>Wrap@{wrapColumn}</span> : null}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 neo:rounded-none neo:border-[2px]">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => { setError(null); loadFile(filePath, false) }}
              className="ml-3 rounded-md border border-red-600 bg-white px-2 py-1 text-red-600 hover:bg-red-50 neo:rounded-none neo:border-[2px] neo:shadow-[2px_2px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[2px_2px_0_0_rgba(255,255,255,0.9)]"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <PendingSpinner size="sm" />
            Loading file...
          </div>
        </div>
      )}

      {/* Main display (code or images) */}
      {!loading && !error && (content || (isImageFile(filePath) && imageData)) && (
        <div
          className={cn(
            'flex-1 overflow-y-auto max-h-none sm:max-h-[calc(100vh-16rem)] no-scrollbar',
            // Only enforce a minimum height for images so the preview is visible on mobile
            isImageFile(filePath) ? 'min-h-[50vh] sm:min-h-0' : undefined
          )}
          style={{ paddingBottom: bottomPad ? bottomPad + 8 : 0 }}
          ref={scrollContainerRef}
        >
          {/* Top chunk navigation for large files (sticky on scroll) */}
          {isChunked && (
            <div className="sticky top-0 z-10 px-3 py-2 flex items-center justify-between text-xs text-muted-foreground bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
              <div>Chunk {chunkIndex + 1} / {totalChunks} • Lines {chunkStart}–{chunkEnd}</div>
              <div className="flex items-center gap-2">
                <button
                  disabled={chunkIndex === 0}
                  onClick={() => { setChunkIndex((i) => Math.max(0, i - 1)); setSearchOpen(false) }}
                  className={cn('px-2 py-1 rounded border border-border neo:rounded-none neo:border-[2px]', chunkIndex === 0 ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted')}
                >Prev</button>
                <button
                  disabled={chunkIndex >= totalChunks - 1}
                  onClick={() => { setChunkIndex((i) => Math.min(totalChunks - 1, i + 1)); setSearchOpen(false) }}
                  className={cn('px-2 py-1 rounded border border-border neo:rounded-none neo:border-[2px]', chunkIndex >= totalChunks - 1 ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted')}
                >Next</button>
              </div>
            </div>
          )}
          {/* Image display */}
          {isImageFile(filePath) && imageData && (
            <div className="mt-2">
              {imageState.mediaView === 'preview' ? (
                imageState.blobUrl ? (
                  <ImagePreview
                    src={imageState.blobUrl}
                    alt={filePath.split('/').pop() || ''}
                  />
                ) : (
                  <BinaryCodeNotice fileSize={imageData.size} />
                )
              ) : (
                <div className="p-4">
                  {isSvgFile(filePath) ? (
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">
                        SVG content ({formatFileSize(imageData.size)})
                      </div>
                      <div className={cn('border rounded-md overflow-auto', wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre')}>
                        <pre className="p-4 text-sm font-mono">{content}</pre>
                      </div>
                    </div>
                  ) : (
                    <BinaryCodeNotice fileSize={imageData.size} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Regular file display (non-image) */}
          {!isImageFile(filePath) && (
            <>
              {shouldFallback && (
                <div className="mx-4 mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 neo:rounded-none neo:border-[2px]">
                  Large file detected. Using static rendering for performance. You can still copy/download the file.
                </div>
              )}

              {isMarkdown && (
                <div className="mx-4 mt-3">
                  <button onClick={() => setIsMarkdownRendered(!isMarkdownRendered)} className={cn('px-2 py-1 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', isMarkdownRendered ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>
                    {isMarkdownRendered ? 'Rendered' : 'Raw'}
                  </button>
                </div>
              )}

              <div className={cn('mt-2', wrap ? 'overflow-hidden' : 'overflow-auto')}>
                {isMarkdown && isMarkdownRendered && !shouldFallback && (
                  <MarkdownRenderer content={visibleContent} className="px-3 pb-4 prose prose-sm dark:prose-invert max-w-none" />
                )}

                {!shouldFallback && (!isMarkdown || !isMarkdownRendered) && (
                  <div style={{ maxWidth: wrap && wrapColumn ? `${wrapColumn}ch` : undefined }}>
                    <CodeViewer
                      ref={viewerRef as any}
                      code={visibleContent}
                      filename={filePath}
                      language={languageOverride}
                      wrap={wrap}
                      lineNumbers={showLineNumbers}
                      lineNumberStart={chunkStart}
                      gutterDigits={Math.max(3, String(fileStats.lines || 0).length)}
                      fontSize={isMobile && fontSize === 'base' ? 'lg' : fontSize}
                      theme={theme}
                      whitespace={whitespace}
                      indentGuides={indentGuides}
                      className="border-0 rounded-none"
                      onSelectionChange={(s) => {
                        const now = Date.now()
                        const newSelInfo = { chars: s.to - s.from, lines: s.lines }
                        
                        // Update ref immediately for responsive UI
                        selInfoRef.current = newSelInfo
                        
                        // Mark that we're in an active selection
                        isSelectingRef.current = true
                        lastSelectionUpdateRef.current = now
                        
                        // Clear any existing timeout
                        if (selectionUpdateTimeoutRef.current) {
                          clearTimeout(selectionUpdateTimeoutRef.current)
                        }
                        if (selectionThrottleTimeoutRef.current) {
                          clearTimeout(selectionThrottleTimeoutRef.current)
                        }
                        
                        // For rapid selection changes (mouse drag), use throttling
                        if (now - lastSelectionUpdateRef.current < 16) { // ~60fps
                          selectionThrottleTimeoutRef.current = setTimeout(() => {
                            setSelInfo(newSelInfo)
                          }, 100) // 100ms throttle for rapid changes
                        } else {
                          // For slower changes, use debouncing
                          selectionUpdateTimeoutRef.current = setTimeout(() => {
                            setSelInfo(newSelInfo)
                            isSelectingRef.current = false
                          }, 150) // 150ms debounce for slower changes
                        }
                      }}
                      onOpenSearch={() => { setOptionsOpen(false); setSearchOpen(true) }}
                    />
                  </div>
                )}

                {shouldFallback && (
                  <div className={cn('px-3 py-2', wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-auto')}>
                    <SyntaxHighlighter
                      code={visibleContent}
                      filename={filePath}
                      showLineNumbers={showLineNumbers}
                      lineNumberStart={chunkStart}
                      fontSize={isMobile && fontSize === 'base' ? 'lg' : fontSize}
                      theme={theme === 'one-dark' ? 'default' : theme}
                      className="border-0 rounded-none"
                    />
                  </div>
                )}

                {/* Bottom chunk navigation for large files */}
                {isChunked && (
                  <div className="px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
                    <div>Chunk {chunkIndex + 1} / {totalChunks} • Lines {chunkStart}–{chunkEnd}</div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={chunkIndex === 0}
                        onClick={() => { setChunkIndex((i) => Math.max(0, i - 1)); setSearchOpen(false) }}
                        className={cn('px-2 py-1 rounded border border-border neo:rounded-none neo:border-[2px]', chunkIndex === 0 ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted')}
                      >Prev</button>
                      <button
                        disabled={chunkIndex >= totalChunks - 1}
                        onClick={() => { setChunkIndex((i) => Math.min(totalChunks - 1, i + 1)); setSearchOpen(false) }}
                        className={cn('px-2 py-1 rounded border border-border neo:rounded-none neo:border-[2px]', chunkIndex >= totalChunks - 1 ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted')}
                      >Next</button>
                    </div>
                  </div>
                )}

                {!wrap && (
                  <div className="md:hidden px-3 py-2 text-xs text-muted-foreground flex items-center gap-1 bg-muted/20">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>
                    Scroll horizontally to see more
                  </div>
                )}

                {/* Removed hardcoded spacer; bottom padding of the scroll container adjusts dynamically. */}
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !content && (
        <div className="p-8 text-center text-muted-foreground"><div className="text-sm">File is empty</div></div>
      )}

      {/* Bottom bar */}
      <CodeBottomBar
        ref={bottomBarRef}
        wrap={wrap}
        onToggleWrap={() => { setSearchOpen(false); setOptionsOpen(false); setWrap(!wrap) }}
        onGoto={() => setGotoOpen(true)}
        onCopy={copyToClipboard}
        onMore={() => { setSearchOpen(false); setOptionsOpen(true) }}
        lines={fileStats.lines}
        selection={selInfo}
      />

      {/* Go to line modal */}
      <GoToLineModal
        open={gotoOpen}
        maxLines={fileStats.lines}
        onClose={() => setGotoOpen(false)}
        onSubmit={({ line, column }) => {
          viewerRef.current?.gotoLine(line, column ?? 1)
          setGotoOpen(false)
        }}
      />

      {/* Docked rows */}
      <CodeSearchRow
        open={searchOpen}
        query={searchQuery}
        options={searchOpts}
        onChange={(q) => { setSearchQuery(q); viewerRef.current?.setSearch({ search: q, ...searchOpts }) }}
        onPrev={() => viewerRef.current?.findPrevious()}
        onNext={() => viewerRef.current?.findNext()}
        onClose={() => setSearchOpen(false)}
        onOptionsChange={(next) => { setSearchOpts(next); viewerRef.current?.setSearch({ search: searchQuery, ...next }) }}
      />
      <CodeSelectionRow open={showSelectionRow} selection={selInfo} onCopySelection={copySelection} onClear={() => viewerRef.current?.clearSelection()} />

      {/* Options sheet */}
      <CodeOptionsSheet
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        wrap={wrap}
        lineNumbers={showLineNumbers}
        indentGuides={indentGuides}
        whitespace={whitespace}
        wrapColumn={wrapColumn}
        fontSize={fontSize}
        theme={theme}
        language={languageOverride}
        languageOptions={languageOptions}
        onToggleWrap={setWrap}
        onToggleLineNumbers={setShowLineNumbers}
        onToggleIndentGuides={setIndentGuides}
        onToggleWhitespace={setWhitespace}
        onWrapColumnChange={setWrapColumn}
        onFontSizeChange={setFontSize}
        onThemeChange={setTheme}
        onLanguageChange={setLanguageOverride}
        onCopyAll={copyToClipboard}
        onDownload={downloadFile}
      />
    </div>
  )
}

export default FileViewerPage
