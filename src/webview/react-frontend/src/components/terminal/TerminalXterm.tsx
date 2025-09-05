import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import 'xterm/css/xterm.css'

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
}>(({ onInput, onResize, className }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let disposed = false
    async function setup() {
      // Lazy import to reduce initial bundle
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('xterm'),
        import('xterm-addon-fit')
      ])

      if (disposed) return

      const isDark = document.documentElement.classList.contains('dark')
      
      // Get responsive font size from CSS custom properties
      const rootStyles = getComputedStyle(document.documentElement);
      const responsiveFontSize = rootStyles.getPropertyValue('--terminal-font-size');
      const fontSize = responsiveFontSize ? parseFloat(responsiveFontSize) : 13;
      
      const term = new Terminal({
        fontFamily: 'var(--terminal-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
        fontSize,
        convertEol: true,
        cursorBlink: true,
        scrollback: 2000,
        theme: {
          background: isDark ? '#0b0b0b' : '#ffffff'
        }
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      termRef.current = term
      fitAddonRef.current = fit

      term.onData((d: string) => onInput(d))

      if (containerRef.current) {
        term.open(containerRef.current)
        requestAnimationFrame(() => {
          try { fit.fit() } catch {}
          const size = { cols: term.cols, rows: term.rows }
          onResize && onResize(size.cols, size.rows)
          setReady(true)
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
      />
    </div>
  )
})
