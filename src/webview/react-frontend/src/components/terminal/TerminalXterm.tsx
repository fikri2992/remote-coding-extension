import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import 'xterm/css/xterm.css'
import { useTheme } from '../theme/ThemeProvider'

export interface TerminalXtermHandle {
  write: (data: string) => void
  clear: () => void
  focus: () => void
  fit: () => void
  getSize: () => { cols: number; rows: number }
}

export const TerminalXterm = React.forwardRef<TerminalXtermHandle, {
  onInput: (data: string) => void
  onResize?: (cols: number, rows: number) => void
  className?: string
  autoFocus?: boolean
}>(({ onInput, onResize, className, autoFocus = false }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [focused, setFocused] = useState(false)
  const { theme } = useTheme()

  const buildTheme = (isDark: boolean) =>
    isDark
      ? {
          background: '#0b0b0b',
          foreground: '#e5e7eb',
          cursor: '#e5e7eb',
          cursorAccent: '#0b0b0b',
          selectionBackground: 'rgba(59,130,246,0.35)'
        }
      : {
          background: '#ffffff',
          foreground: '#111827',
          cursor: '#111827',
          cursorAccent: '#ffffff',
          selectionBackground: 'rgba(59,130,246,0.25)'
        }

  useEffect(() => {
    let disposed = false
    async function setup() {
      // Lazy import to reduce initial bundle
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('xterm'),
        import('xterm-addon-fit')
      ])

      if (disposed) return

      const isDark = theme === 'dark'
      const term = new Terminal({
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 13,
        convertEol: true,
        cursorBlink: true,
        scrollback: 2000,
        theme: buildTheme(isDark)
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      termRef.current = term
      fitAddonRef.current = fit

      term.onData((d: string) => onInput(d))
      if (term.textarea) {
        term.textarea.addEventListener('focus', () => setFocused(true))
        term.textarea.addEventListener('blur', () => setFocused(false))
      }

      if (containerRef.current) {
        term.open(containerRef.current)
        requestAnimationFrame(() => {
          try { fit.fit() } catch {}
          const size = { cols: term.cols, rows: term.rows }
          onResize && onResize(size.cols, size.rows)
          setReady(true)
          if (autoFocus) {
            try { term.focus() } catch {}
          }
        })
      }

      const ro = new ResizeObserver(() => {
        try { fit.fit() } catch {}
        const size = { cols: term.cols, rows: term.rows }
        onResize && onResize(size.cols, size.rows)
      })
      if (containerRef.current) ro.observe(containerRef.current)

      return () => {
        try { ro.disconnect() } catch {}
        try { term.dispose() } catch {}
        termRef.current = null
        fitAddonRef.current = null
      }
    }
    const cleanup = setup()
    return () => { disposed = true; cleanup.then(f => f && (f as any)()) }
  }, [])

  // React to theme changes from ThemeProvider (light/dark)
  useEffect(() => {
    if (!termRef.current) return
    const isDark = theme === 'dark'
    try {
      termRef.current.setOption('theme', buildTheme(isDark))
      // Force a small refresh to ensure canvas picks up background
      try { termRef.current.refresh(0, termRef.current.rows - 1) } catch {}
    } catch {}
  }, [theme])

  useImperativeHandle(ref, () => ({
    write: (data: string) => { try { termRef.current?.write?.(data) } catch {} },
    clear: () => { try { termRef.current?.clear?.() } catch {} },
    focus: () => { try { termRef.current?.focus?.() } catch {} },
    fit: () => { try { fitAddonRef.current?.fit?.() } catch {} },
    getSize: () => ({ cols: termRef.current?.cols || 80, rows: termRef.current?.rows || 24 })
  }), [])

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="rounded-md border border-border overflow-hidden"
        style={{ minHeight: 240 }}
        aria-label={ready ? 'Terminal' : 'Loading terminal'}
        tabIndex={0}
        onClick={() => { try { termRef.current?.focus?.() } catch {} }}
        onTouchStart={() => { try { termRef.current?.focus?.() } catch {} }}
      />
      {!focused && ready && (
        <div className="mt-1 text-xs text-muted-foreground">Tap the terminal to focus and open the keyboard.</div>
      )}
    </div>
  )
})
