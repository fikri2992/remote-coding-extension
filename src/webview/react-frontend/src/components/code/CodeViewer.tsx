import * as React from 'react'
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from '@codemirror/view'
import { EditorState, Compartment, Extension } from '@codemirror/state'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { /*searchKeymap,*/ /*openSearchPanel, closeSearchPanel,*/ highlightSelectionMatches, findNext, findPrevious, setSearchQuery } from '@codemirror/search'
import { defaultKeymap } from '@codemirror/commands'

export type FontSize = 'sm' | 'base' | 'lg'
export type CodeTheme = 'default' | 'neo' | 'one-dark'

export interface CodeViewerHandle {
  focus: () => void
  setSearch: (q: { search: string; caseSensitive?: boolean; regexp?: boolean; wholeWord?: boolean }) => void
  findNext: () => void
  findPrevious: () => void
  gotoLine: (line: number, col?: number) => void
  getSelectionInfo: () => { from: number; to: number; text: string; lines: number }
  clearSelection: () => void
}

export interface CodeViewerProps {
  code: string
  language?: string
  filename?: string
  wrap?: boolean
  lineNumbers?: boolean
  lineNumberStart?: number
  fontSize?: FontSize
  theme?: CodeTheme
  whitespace?: boolean
  indentGuides?: boolean
  wrapColumn?: number
  className?: string
  onStats?: (stats: { lines: number; length: number }) => void
  onSelectionChange?: (sel: { from: number; to: number; text: string; lines: number }) => void
  onOpenSearch?: () => void
  // Reserve gutter width to avoid flicker when line digit count changes
  gutterDigits?: number
}

const detectLangId = (lang?: string, filename?: string): string | undefined => {
  const f = (filename || '').toLowerCase()
  const ext = (lang || (f.includes('.') ? f.split('.').pop() : '') || '').toLowerCase()
  if (['js','jsx','ts','tsx','javascript','typescript'].includes(ext)) return ext
  if (['json'].includes(ext)) return 'json'
  if (['html','htm'].includes(ext)) return 'html'
  if (['css'].includes(ext)) return 'css'
  if (['md','markdown'].includes(ext)) return 'markdown'
  if (['xml'].includes(ext)) return 'xml'
  return undefined
}

const loadLanguageExt = async (id?: string): Promise<Extension | []> => {
  try {
    switch (id) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'javascript':
      case 'typescript': {
        const m = await import('@codemirror/lang-javascript')
        return m.javascript({ jsx: true, typescript: id?.startsWith('ts') })
      }
      case 'json': {
        const m = await import('@codemirror/lang-json')
        return m.json()
      }
      case 'html':
      case 'htm': {
        const m = await import('@codemirror/lang-html')
        return m.html()
      }
      case 'css': {
        const m = await import('@codemirror/lang-css')
        return m.css()
      }
      case 'md':
      case 'markdown': {
        const m = await import('@codemirror/lang-markdown')
        return m.markdown()
      }
      case 'xml': {
        const m = await import('@codemirror/lang-xml')
        return m.xml()
      }
      default:
        return []
    }
  } catch {
    return []
  }
}

const fontSizeTheme = (size: FontSize) => EditorView.theme({
  '&': {
    fontSize: size === 'sm' ? '12px' : size === 'lg' ? '16px' : '14px'
  },
  '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
  '.cm-gutters': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
})

const neoTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--background)',
  },
  '.cm-content': {
    caretColor: 'var(--foreground)'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--background)',
    color: 'var(--muted-foreground)',
    borderRight: '1px solid hsl(var(--border))'
  },
  '.cm-activeLine': {
    backgroundColor: 'hsl(var(--muted) / 0.35)'
  },
})

export const CodeViewer = React.forwardRef<CodeViewerHandle, CodeViewerProps>(function CodeViewer(
  { code, language, filename, wrap = false, lineNumbers: ln = true, lineNumberStart = 1, fontSize = 'base', theme = 'default', whitespace = false, indentGuides = false, wrapColumn: _wrapColumn, className, onStats, onSelectionChange, onOpenSearch, gutterDigits },
  ref
) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const viewRef = React.useRef<EditorView | null>(null)

  const langComp = React.useRef(new Compartment())
  const wrapComp = React.useRef(new Compartment())
  const lnComp = React.useRef(new Compartment())
  const themeComp = React.useRef(new Compartment())
  const fontComp = React.useRef(new Compartment())
  const wsComp = React.useRef(new Compartment())
  const indentComp = React.useRef(new Compartment())
  const keysComp = React.useRef(new Compartment())
  const gutterComp = React.useRef(new Compartment())
  // Track last search string to avoid opening CM search panel implicitly
  const lastSearchRef = React.useRef<string>('')

  // build base extensions
  const baseExtensions = React.useMemo<Extension[]>(() => [
    keymap.of([...defaultKeymap]),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    highlightSelectionMatches(),
    EditorView.updateListener.of((u) => {
      if ((u.docChanged || u.selectionSet) && onSelectionChange) {
        const sel = u.state.selection.main
        const text = u.state.sliceDoc(sel.from, sel.to)
        const lines = text ? text.split('\n').length : 0
        onSelectionChange({ from: sel.from, to: sel.to, text, lines })
      }
      if (u.docChanged && onStats) {
        onStats({ lines: u.state.doc.lines, length: u.state.doc.length })
      }
    })
  ], [])

  React.useEffect(() => {
    if (!containerRef.current) return
    if (viewRef.current) return

    const initialExtensions: Extension[] = [
      ...baseExtensions,
      langComp.current.of([]),
      keysComp.current.of([]),
      wrapComp.current.of(wrap ? EditorView.lineWrapping : []),
      lnComp.current.of(ln ? lineNumbers({
        formatNumber: (n) => String(n + Math.max(1, Math.floor(lineNumberStart)) - 1)
      }) : []),
      // Reserve a fixed gutter width based on expected digit count.
      // Using !important to override CodeMirror's dynamic inline width to prevent flicker.
      gutterComp.current.of(EditorView.theme({
        '.cm-gutter': { width: `${Math.max(1, (gutterDigits || 3)) + 1}ch !important`, minWidth: `${Math.max(1, (gutterDigits || 3)) + 1}ch !important`, flex: 'none' },
        '.cm-gutters': { flex: 'none' }
      })),
      themeComp.current.of([]),
      fontComp.current.of(fontSizeTheme(fontSize)),
      wsComp.current.of(whitespace ? EditorView.theme({ '.cm-content': { backgroundImage: 'none' } }) : []),
      indentComp.current.of((wrap && indentGuides) ? EditorView.theme({ '.cm-line': { textIndent: '-2ch', paddingLeft: '2ch' } }) : []),
    ]

    const state = EditorState.create({
      doc: code,
      extensions: initialExtensions
    })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    onStats?.({ lines: state.doc.lines, length: state.doc.length })
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // update code changes
  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cur = view.state.doc.toString()
    if (cur === code) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } })
    onStats?.({ lines: view.state.doc.lines, length: view.state.doc.length })
  }, [code, onStats])

  // update reconfigurable compartments
  const loadSeq = React.useRef(0)
  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const id = detectLangId(language, filename)
    const seq = ++loadSeq.current
    loadLanguageExt(id).then((ext) => {
      if (!viewRef.current) return
      if (seq !== loadSeq.current) return
      viewRef.current.dispatch({ effects: langComp.current.reconfigure(ext) })
    })
  }, [language, filename])

  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: wrapComp.current.reconfigure(wrap ? EditorView.lineWrapping : []) })
  }, [wrap])

  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const start = Math.max(1, Math.floor(lineNumberStart))
    view.dispatch({ effects: lnComp.current.reconfigure(ln ? lineNumbers({
      formatNumber: (n) => String(n + start - 1)
    }) : []) })
  }, [ln, lineNumberStart])

  // Update gutter fixed width when digit count changes
  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const digits = Math.max(1, (gutterDigits || 3))
    view.dispatch({
      effects: gutterComp.current.reconfigure(EditorView.theme({
        '.cm-gutter': { width: `${digits + 1}ch !important`, minWidth: `${digits + 1}ch !important`, flex: 'none' },
        '.cm-gutters': { flex: 'none' }
      }))
    })
  }, [gutterDigits])

  const loadThemeExt = React.useCallback(async (t: CodeTheme): Promise<Extension> => {
    if (t === 'neo') return neoTheme
    if (t === 'one-dark') {
      try {
        const m = await import('@codemirror/theme-one-dark')
        return m.oneDark
      } catch {
        return []
      }
    }
    return []
  }, [])

  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    let cancelled = false
    loadThemeExt(theme).then((ext) => {
      if (cancelled || !viewRef.current) return
      viewRef.current.dispatch({ effects: themeComp.current.reconfigure(ext) })
    })
    return () => { cancelled = true }
  }, [theme, loadThemeExt])

  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: fontComp.current.reconfigure(fontSizeTheme(fontSize)) })
  }, [fontSize])

  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    // Using highlightSelectionMatches already; use whitespace flag to show trailing whitespace
    const ext: Extension = whitespace ? EditorView.theme({
      '.cm-trailingSpace': { backgroundColor: 'hsla(0, 70%, 50%, 0.25)' }
    }) : []
    view.dispatch({ effects: wsComp.current.reconfigure(ext) })
  }, [whitespace])

  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const ext: Extension = (wrap && indentGuides) ? EditorView.theme({ '.cm-line': { textIndent: '-2ch', paddingLeft: '2ch' } }) : []
    view.dispatch({ effects: indentComp.current.reconfigure(ext) })
  }, [wrap, indentGuides])

  React.useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const runOpen = () => { return !!(onOpenSearch && (onOpenSearch(), true)) }
    const ext: Extension = keymap.of([
      { key: 'Mod-f', run: runOpen },
      { key: 'Ctrl-f', run: runOpen }
    ])
    view.dispatch({ effects: keysComp.current.reconfigure(ext) })
  }, [onOpenSearch])

  React.useImperativeHandle(ref, (): CodeViewerHandle => ({
    focus: () => { viewRef.current?.focus() },
    setSearch: (q) => {
      const v = viewRef.current; if (!v) return;
      const anySet = setSearchQuery as any
      try {
        if (typeof anySet === 'function') {
          anySet(v, q)
          lastSearchRef.current = (q?.search || '')
          return
        }
      } catch { /* fallthrough */ }
      try {
        if (anySet && typeof anySet.of === 'function') {
          v.dispatch({ effects: anySet.of(q) })
          lastSearchRef.current = (q?.search || '')
        }
      } catch {/* ignore */}
    },
    findNext: () => {
      const v = viewRef.current; if (!v) return;
      if (!lastSearchRef.current || !lastSearchRef.current.trim()) return; // avoid opening default panel
      findNext(v)
    },
    findPrevious: () => {
      const v = viewRef.current; if (!v) return;
      if (!lastSearchRef.current || !lastSearchRef.current.trim()) return; // avoid opening default panel
      findPrevious(v)
    },
    gotoLine: (line, col = 1) => {
      const v = viewRef.current; if (!v) return
      const l = Math.max(1, Math.min(v.state.doc.lines, Math.floor(line)))
      const pos = v.state.doc.line(l).from + Math.max(0, col - 1)
      v.dispatch({ selection: { anchor: pos }, scrollIntoView: true })
      v.focus()
    },
    getSelectionInfo: () => {
      const v = viewRef.current; if (!v) return { from: 0, to: 0, text: '', lines: 0 }
      const { from, to } = v.state.selection.main
      const text = v.state.sliceDoc(from, to)
      const lines = text ? text.split('\n').length : 0
      return { from, to, text, lines }
    },
    clearSelection: () => { const v = viewRef.current; if (!v) return; v.dispatch({ selection: { anchor: 0 } }); v.focus() }
  }), [])

  return (
    <div className={className}>
      <div ref={containerRef} className="cm-container min-h-[200px]" aria-label="Code viewer" />
    </div>
  )
})

export default CodeViewer
