import * as React from 'react'
import { DiffLine } from './SyntaxHighlighter'
// @ts-ignore - fast-diff has no bundled types in some versions
import * as FastDiff from 'fast-diff'

// Basic HTML escaper to ensure diff text isn't interpreted as HTML
const escapeHtml = (s: string): string =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

type RowType = 'meta' | 'hunk' | 'add' | 'del' | 'ctx'
interface DiffRow {
  type: RowType
  text: string
  oldNo?: number | null
  newNo?: number | null
}

const hunkRe = /^@@\s*-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s*@@/

function parseUnified(content: string): DiffRow[] {
  const rows: DiffRow[] = []
  const lines = (content || '').split('\n')
  let oldNo: number | null = null
  let newNo: number | null = null

  for (const line of lines) {
    if (line.startsWith('diff ') || line.startsWith('index ')
      || line.startsWith('--- ') || line.startsWith('+++ ')) {
      rows.push({ type: 'meta', text: line, oldNo: null, newNo: null })
      continue
    }
    if (line.startsWith('@@')) {
      const m = line.match(hunkRe)
      if (m) {
        oldNo = parseInt(m[1], 10)
        newNo = parseInt(m[2], 10)
      }
      rows.push({ type: 'hunk', text: line, oldNo: null, newNo: null })
      continue
    }
    if (line.startsWith('+')) {
      rows.push({ type: 'add', text: line, oldNo: null, newNo: newNo ?? undefined })
      if (newNo !== null) newNo += 1
      continue
    }
    if (line.startsWith('-')) {
      rows.push({ type: 'del', text: line, oldNo: oldNo ?? undefined, newNo: null })
      if (oldNo !== null) oldNo += 1
      continue
    }
    rows.push({ type: 'ctx', text: line, oldNo: oldNo ?? undefined, newNo: newNo ?? undefined })
    if (oldNo !== null) oldNo += 1
    if (newNo !== null) newNo += 1
  }
  return rows
}

export interface CodeDiffViewerProps {
  file: string
  content: string
  mode?: 'inline' | 'side-by-side'
  wrap?: boolean
  fontSize?: 'sm' | 'base' | 'lg'
  ignoreWhitespace?: boolean
  wordLevel?: boolean
  className?: string
}

export interface CodeDiffViewerHandle { expandAll: () => void; collapseAll: () => void }

export const CodeDiffViewer = React.forwardRef<CodeDiffViewerHandle, CodeDiffViewerProps>(function CodeDiffViewer({
  file,
  content,
  mode: _mode = 'inline',
  wrap = false,
  fontSize = 'base',
  ignoreWhitespace: _ignoreWhitespace = false,
  wordLevel = true,
  className
}, ref) {
  const rows = React.useMemo(() => parseUnified(content || ''), [content])

  type Segment = { kind: 'meta'; header: DiffRow } | { kind: 'hunk'; header: DiffRow; lines: DiffRow[] }
  const segments = React.useMemo<Segment[]>(() => {
    const segs: Segment[] = []
    let current: { header: DiffRow; lines: DiffRow[] } | null = null
    for (const r of rows) {
      if (r.type === 'meta') { segs.push({ kind: 'meta', header: r }); continue }
      if (r.type === 'hunk') { current = { header: r, lines: [] }; segs.push({ kind: 'hunk', header: r, lines: current.lines }); continue }
      if (!current) { current = { header: { type: 'hunk', text: '@@ 0,0 0,0 @@', oldNo: null, newNo: null }, lines: [] }; segs.push({ kind: 'hunk', header: current.header, lines: current.lines }) }
      current.lines.push(r)
    }
    return segs
  }, [rows])

  const [collapsed, setCollapsed] = React.useState<Record<number, boolean>>({})
  const toggle = (idx: number) => setCollapsed(s => ({ ...s, [idx]: !s[idx] }))

  React.useImperativeHandle(ref, () => ({
    expandAll: () => setCollapsed({}),
    collapseAll: () => {
      const map: Record<number, boolean> = {}
      segments.forEach((seg, i) => { if (seg.kind === 'hunk') map[i] = true })
      setCollapsed(map)
    }
  }), [segments])

  const computeWordDiffHtml = React.useCallback((oldText: string, newText: string, ignoreWS: boolean) => {
    const diffFn: any = (FastDiff as any).default || (FastDiff as any)
    let tuples: Array<[number, string]> = []
    try {
      tuples = diffFn(oldText, newText)
    } catch {
      return { left: oldText, right: newText }
    }
    const wrapSeg = (txt: string, cls: string) => `<span class="${cls}">${escapeHtml(txt)}</span>`
    const leftParts: string[] = []
    const rightParts: string[] = []
    for (const [op, text] of tuples) {
      const isSpaceOnly = /^\s+$/.test(text)
      if (ignoreWS && isSpaceOnly) {
        leftParts.push(escapeHtml(text))
        rightParts.push(escapeHtml(text))
        continue
      }
      if (op === 0) { // equal
        leftParts.push(escapeHtml(text))
        rightParts.push(escapeHtml(text))
      } else if (op === -1) { // deletion
        leftParts.push(wrapSeg(text, 'wdiff-del bg-rose-500/20'))
      } else if (op === 1) { // insertion
        rightParts.push(wrapSeg(text, 'wdiff-add bg-emerald-500/20'))
      }
    }
    return { left: leftParts.join(''), right: rightParts.join('') }
  }, [])

  const renderInline = React.useCallback((subset: DiffRow[]) => {
    const result: Array<React.ReactNode> = []
    let pendingDel: DiffRow[] = []
    let pendingAdd: DiffRow[] = []
    const flush = () => {
      const pairs = Math.max(pendingDel.length, pendingAdd.length)
      for (let i = 0; i < pairs; i++) {
        const d = pendingDel[i]
        const a = pendingAdd[i]
        if (d) {
          let htmlOverride: string | undefined
          if (a && wordLevel) {
            const html = computeWordDiffHtml(d.text.slice(1), a.text.slice(1), _ignoreWhitespace)
            htmlOverride = html.left
          }
          result.push(
            <DiffLine key={`del-${i}-${d.oldNo}-${d.newNo}`} line={d.text} type={'del'} oldNo={d.oldNo} newNo={d.newNo} filename={file} fontSize={fontSize} theme="default" htmlOverride={htmlOverride} wrap={wrap} />
          )
        }
        if (a) {
          let htmlOverride: string | undefined
          if (d && wordLevel) {
            const html = computeWordDiffHtml(d.text.slice(1), a.text.slice(1), _ignoreWhitespace)
            htmlOverride = html.right
          }
          result.push(
            <DiffLine key={`add-${i}-${a.oldNo}-${a.newNo}`} line={a.text} type={'add'} oldNo={a.oldNo} newNo={a.newNo} filename={file} fontSize={fontSize} theme="default" htmlOverride={htmlOverride} wrap={wrap} />
          )
        }
      }
      pendingDel = []
      pendingAdd = []
    }
    subset.forEach((r, idx) => {
      if (r.type === 'del') { pendingDel.push(r); return }
      if (r.type === 'add') { pendingAdd.push(r); return }
      // boundary: flush then push ctx/meta/hunk
      if (pendingDel.length || pendingAdd.length) flush()
      result.push(
        <DiffLine key={`row-${idx}`} line={r.text} type={r.type as any} oldNo={r.oldNo} newNo={r.newNo} filename={file} fontSize={fontSize} theme="default" wrap={wrap} />
      )
    })
    if (pendingDel.length || pendingAdd.length) flush()
    return <div className="w-full" style={{ minWidth: 'max-content' }}>{result}</div>
  }, [fontSize, file, _ignoreWhitespace, computeWordDiffHtml])

  const renderSxS = React.useCallback((subset: DiffRow[]) => {
    interface SideRow { left?: DiffRow; right?: DiffRow; leftHtml?: string; rightHtml?: string }
    const items: SideRow[] = []
    let pendingDel: DiffRow[] = []
    let pendingAdd: DiffRow[] = []
    const flush = () => {
      const pairs = Math.max(pendingDel.length, pendingAdd.length)
      for (let i = 0; i < pairs; i++) {
        const d = pendingDel[i]
        const a = pendingAdd[i]
        if (!d && !a) continue
        let leftHtml: string | undefined
        let rightHtml: string | undefined
        if (d && a) {
          const html = computeWordDiffHtml(d.text.slice(1), a.text.slice(1), _ignoreWhitespace)
          leftHtml = html.left
          rightHtml = html.right
        }
        items.push({ left: d, right: a, leftHtml, rightHtml })
      }
      pendingDel = []
      pendingAdd = []
    }
    subset.forEach(r => {
      if (r.type === 'del') { pendingDel.push(r); return }
      if (r.type === 'add') { pendingAdd.push(r); return }
      if (pendingDel.length || pendingAdd.length) flush()
      if (r.type === 'ctx') items.push({ left: r, right: r })
      else items.push({ left: r, right: r }) // meta/hunk mirrored
    })
    if (pendingDel.length || pendingAdd.length) flush()
    return (
      <div className="min-w-full">
        {items.map((it, idx) => {
          const leftCls = it.left?.type === 'del' ? 'bg-rose-50 dark:bg-rose-950/30' : it.left?.type === 'ctx' ? '' : 'bg-muted/20'
          const rightCls = it.right?.type === 'add' ? 'bg-emerald-50 dark:bg-emerald-950/30' : it.right?.type === 'ctx' ? '' : 'bg-muted/20'
          return (
            <div key={idx} className="grid grid-cols-[4rem_1fr_4rem_1fr] items-start gap-x-2 px-2 py-1">
              <div className="text-right pr-1 text-muted-foreground select-none font-mono text-xs">{it.left?.oldNo ?? ''}</div>
              <div className={"font-mono text-xs px-2 py-0.5 rounded-sm border border-transparent whitespace-pre " + leftCls} style={{ minWidth: 'max-content' }}>
                {it.left ? (
                  <span style={{ whiteSpace: 'pre' }} dangerouslySetInnerHTML={{ __html: (it.left.type === 'del' && it.leftHtml) ? it.leftHtml : (escapeHtml(it.left.text.slice(1)) || '&nbsp;') }} />
                ) : <span>&nbsp;</span>}
              </div>
              <div className="text-right pr-1 text-muted-foreground select-none font-mono text-xs">{it.right?.newNo ?? ''}</div>
              <div className={"font-mono text-xs px-2 py-0.5 rounded-sm border border-transparent whitespace-pre " + rightCls} style={{ minWidth: 'max-content' }}>
                {it.right ? (
                  <span style={{ whiteSpace: 'pre' }} dangerouslySetInnerHTML={{ __html: (it.right.type === 'add' && it.rightHtml) ? it.rightHtml : (escapeHtml(it.right.text.slice(1)) || '&nbsp;') }} />
                ) : <span>&nbsp;</span>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }, [ _ignoreWhitespace, computeWordDiffHtml])

  const renderSegment = (seg: Segment, idx: number) => {
    if (seg.kind === 'meta') {
      return (
        <div key={`m-${idx}`} className="px-3 py-1 text-xs text-muted-foreground bg-muted/20 border-y border-border neo:border-y-[2px] font-mono">
          {seg.header.text}
        </div>
      )
    }
    const isCollapsed = !!collapsed[idx]
    return (
      <div key={`h-${idx}`} className="">
        <div className="sticky top-0 z-10 px-3 py-1 text-xs bg-muted/50 border-y border-border neo:border-y-[2px] backdrop-blur flex items-center justify-between font-mono">
          <span className="truncate">{seg.header.text}</span>
          <button onClick={() => toggle(idx)} className="px-2 py-0.5 rounded border border-border bg-background hover:bg-muted text-[10px] neo:rounded-none neo:border-[2px]">
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
        {!isCollapsed && (
          _mode === 'side-by-side'
            ? (
              <div className="py-1">{renderSxS(seg.lines)}</div>
            )
            : (
              <div className="py-1">{renderInline(seg.lines)}</div>
            )
        )}
      </div>
    )
  }

  const body = (
    <div className={wrap ? 'overflow-hidden' : 'overflow-auto'}>
      <div className="w-full" style={{ minWidth: 'max-content' }}>
        {/* Global header for SxS */}
        {_mode === 'side-by-side' && (
          <div className="sticky top-0 z-10 grid grid-cols-[4rem_1fr_4rem_1fr] gap-x-2 px-2 py-1 text-xs text-muted-foreground bg-muted/40 border-b border-border">
            <div className="text-right pr-1">Old</div>
            <div>Before</div>
            <div className="text-right pr-1">New</div>
            <div>After</div>
          </div>
        )}
        <div className="space-y-2">
          {segments.map((seg, i) => renderSegment(seg, i))}
        </div>
      </div>
    </div>
  )

  // For now, side-by-side falls back to inline (TODO: implement SxS)
  return (
    <div className={className}>
      {body}
      {rows.length > 0 && (
        <div className="px-3 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground flex items-center justify-between neo:border-t-[2px]">
          <span>{rows.length} lines</span>
          <span className="font-mono">{file}</span>
        </div>
      )}
    </div>
  )
})

export default CodeDiffViewer
