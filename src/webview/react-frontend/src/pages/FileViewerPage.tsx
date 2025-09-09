
import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useWebSocket } from '../components/WebSocketProvider'
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
import { cn } from '../lib/utils'

const FileViewerPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { sendJson, addMessageListener } = useWebSocket()

  const [content, setContent] = useState<string>('')
  const [meta, setMeta] = useState<{ path?: string; truncated?: boolean; size?: number }>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

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
  const [stats, setStats] = useState<{ lines: number; length: number }>({ lines: 0, length: 0 })
  const [selInfo, setSelInfo] = useState<{ chars: number; lines: number }>({ chars: 0, lines: 0 })
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = usePersistentState<string>('searchQuery', '')
  const [searchOpts, setSearchOpts] = usePersistentState<{ caseSensitive: boolean; regexp: boolean; wholeWord: boolean }>('searchOpts', { caseSensitive: false, regexp: false, wholeWord: false })
  const isMobile = useMediaQuery('(max-width: 767px)')
  const pendingIdRef = useRef<string | null>(null)

  const filePath = (location.search as any)?.path || ''
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

  useEffect(() => {
    if (!filePath) return
    const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    pendingIdRef.current = id
    setLoading(true)
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
      setLoading(false)
    })
    return unsub
  }, [filePath])

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
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
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

  const shouldFallback = stats.length > 1_000_000 || stats.lines > 20000 || meta.truncated
  const languageOptions = ['javascript', 'typescript', 'json', 'html', 'css', 'markdown', 'xml']
  const isMarkdown = (filePath || '').toLowerCase().endsWith('.md')
  const selectionActive = selInfo.chars > 0
  const showSelectionRow = selectionActive && !searchOpen && !optionsOpen

  // Chunked viewing for very large files
  const CHUNK_LINE_THRESHOLD = 4000
  const CHUNK_SIZE = 2000
  const [chunkIndex, setChunkIndex] = useState(0)
  const isChunked = stats.lines >= CHUNK_LINE_THRESHOLD
  const totalChunks = isChunked ? Math.ceil((stats.lines || 0) / CHUNK_SIZE) : 1
  const chunkStart = isChunked ? chunkIndex * CHUNK_SIZE + 1 : 1
  const chunkEnd = isChunked ? Math.min((chunkIndex + 1) * CHUNK_SIZE, stats.lines || 0) : stats.lines || 0
  const visibleContent = React.useMemo(() => {
    if (!isChunked) return content
    const lines = content.split('\n')
    return lines.slice(chunkStart - 1, chunkEnd).join('\n')
  }, [content, isChunked, chunkStart, chunkEnd])

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)] overflow-hidden">
      {/* Header - Mobile Responsive */}
      <div className="p-3 sm:p-4 border-b border-border bg-muted/20 neo:border-b-[2px]">
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
              <span>{content.split('\n').length} lines</span>
              <span className="font-mono">{filePath.split('.').pop()?.toUpperCase()}</span>
              {meta.truncated && <span className="text-amber-600 font-medium">(truncated)</span>}
            </div>
            
            {/* Desktop file info */}
            <div className="hidden md:flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {meta.size && <span>{formatFileSize(meta.size)}</span>}
              {meta.truncated && <span className="text-amber-600 font-medium">(truncated)</span>}
              <span>{content.split('\n').length} lines</span>
              <span className="font-mono">{filePath.split('.').pop()?.toUpperCase()}</span>
            </div>
          </div>
          
          {/* Back button - always visible */}
          <button 
            onClick={() => navigate({ to: '/files' })} 
            className="ml-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px] shrink-0"
          >
            Back
          </button>
        </div>

        {/* Mobile action buttons */}
        <div className="md:hidden flex items-center gap-2 mb-3 overflow-x-auto">
          <button onClick={copyToClipboard} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px] whitespace-nowrap">Copy</button>
          <button onClick={copySelection} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px] whitespace-nowrap">Copy Selection</button>
          <button onClick={downloadFile} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px] whitespace-nowrap">Download</button>
        </div>

        {/* Desktop action buttons */}
        <div className="hidden md:flex items-center gap-2 mb-3">
          <button onClick={copyToClipboard} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px]">Copy</button>
          <button onClick={copySelection} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px]">Copy Selection</button>
          <button onClick={downloadFile} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[2px]">Download</button>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:block">
          <CodeToolbar
            wrap={wrap}
            lineNumbers={showLineNumbers}
            indentGuides={indentGuides}
            whitespace={whitespace}
            wrapColumn={wrapColumn ?? 0}
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
            onFindOpen={() => setSearchOpen(true)}
            onGotoOpen={() => {
              const val = window.prompt('Go to line (or line:column):', '')
              if (!val) return
              const [l, c] = val.split(':').map(v => parseInt(v, 10))
              if (!isNaN(l)) viewerRef.current?.gotoLine(l, isNaN(c) ? 1 : c)
            }}
          />
        </div>

        {/* Desktop status */}
        <div className="hidden md:flex px-4 py-1 text-xs text-muted-foreground border-b border-border items-center justify-between">
          <div className="flex items-center gap-3">
            <span>{stats.lines} lines</span>
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
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            Loading file...
          </div>
        </div>
      )}

      {/* Code display */}
      {!loading && !error && content && (
        <div className="max-h-[calc(100vh-16rem)]" ref={scrollContainerRef}>
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
                  fontSize={isMobile && fontSize === 'base' ? 'lg' : fontSize}
                  theme={theme}
                  whitespace={whitespace}
                  indentGuides={indentGuides}
                  className="border-0 rounded-none"
                  onStats={setStats}
                  onSelectionChange={(s) => setSelInfo({ chars: s.to - s.from, lines: s.lines })}
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
                  fontSize={isMobile && fontSize === 'base' ? 'lg' : fontSize}
                  theme={theme === 'one-dark' ? 'default' : theme}
                  className="border-0 rounded-none"
                />
              </div>
            )}

            {/* Chunk navigation for large files */}
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

            {(searchOpen || showSelectionRow) && (
              <div style={{ height: '128px' }} />
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !content && (
        <div className="p-8 text-center text-muted-foreground"><div className="text-sm">File is empty</div></div>
      )}

      {/* Bottom bar */}
      <CodeBottomBar
        wrap={wrap}
        onToggleWrap={() => { setSearchOpen(false); setOptionsOpen(false); setWrap(!wrap) }}
        onFind={() => { setOptionsOpen(false); setSearchOpen(!searchOpen) }}
        onGoto={() => {
          const val = window.prompt('Go to line (or line:column):', '')
          if (!val) return
          const [l, c] = val.split(':').map(v => parseInt(v, 10))
          if (!isNaN(l)) viewerRef.current?.gotoLine(l, isNaN(c) ? 1 : c)
        }}
        onCopy={copyToClipboard}
        onMore={() => { setSearchOpen(false); setOptionsOpen(true) }}
        lines={stats.lines}
        selection={selInfo}
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
