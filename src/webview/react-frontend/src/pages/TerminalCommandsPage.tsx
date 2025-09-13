import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWebSocket } from '../components/WebSocketProvider'
import { cn } from '../lib/utils'
import { Play, Square, RefreshCw, Trash2, Timer, Download, ListPlus, ChevronDown, ChevronRight, X } from 'lucide-react'

// Minimal process item shape persisted in localStorage
interface ProcItem {
  id: string
  terminalId?: string
  command: string
  args: string[]
  cwd?: string
  status: 'idle' | 'starting' | 'running' | 'exited' | 'killed' | 'released' | 'error'
  exitCode?: number
  signal?: string
  createdAt: number
  updatedAt: number
  output: string
  truncated?: boolean
  outputByteLimit?: number
  open?: boolean
}

const LS_KEY = 'terminal_commands_v1'

const DEFAULT_OUTPUT_LIMIT = 2 * 1024 * 1024 // 2MB cap

const presets: Array<{ label: string; command: string; args: string[] }>= [
  { label: 'npm run dev', command: 'npm', args: ['run','dev'] },
  { label: 'npm run build', command: 'npm', args: ['run','build'] },
  { label: 'docker compose up -d', command: 'docker', args: ['compose','up','-d'] },
  { label: 'docker build -t myimage .', command: 'docker', args: ['build','-t','myimage','.'] },
  { label: 'node ace serve --watch', command: 'node', args: ['ace','serve','--watch'] },
]

function now() { return Date.now() }

function trimOutput(text: string, maxBytes = DEFAULT_OUTPUT_LIMIT): { text: string, truncated: boolean } {
  try {
    const enc = new TextEncoder()
    const dec = new TextDecoder()
    const bytes = enc.encode(text)
    if (bytes.byteLength <= maxBytes) return { text, truncated: false }
    // Trim from head
    const start = bytes.byteLength - maxBytes
    const slice = bytes.slice(start)
    return { text: dec.decode(slice), truncated: true }
  } catch {
    // Fallback naive trim by char length
    if (text.length > maxBytes) return { text: text.slice(-maxBytes), truncated: true }
    return { text, truncated: false }
  }
}

const TerminalCommandsPage: React.FC = () => {
  const { sendAcp, addMessageListener, isConnected } = useWebSocket()
  const [items, setItems] = useState<ProcItem[]>([])
  const [command, setCommand] = useState('')
  const [argsInput, setArgsInput] = useState('')
  const [cwd, setCwd] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'all'|'running'|'finished'>('all')
  const autoRef = useRef<any>(null)

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const list = JSON.parse(raw) as ProcItem[]
        if (Array.isArray(list)) {
          // Mark previously running items as unknown state to recover
          const recovered = list.map(it => (
            it.status === 'running' || it.status === 'starting'
              ? { ...it, status: 'running' as const }
              : it
          ))
          setItems(recovered)
        }
      }
    } catch {}
  }, [])

  // Persist
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)) } catch {}
  }, [items])

  // Deduplicate helper by terminalId (or id if missing)
  const dedupeByTid = useCallback((list: ProcItem[]): ProcItem[] => {
    const map = new Map<string, ProcItem>()
    for (const it of list) {
      const key = String(it.terminalId || it.id)
      const prev = map.get(key)
      if (!prev) map.set(key, it)
      else {
        // Prefer the most recently updated or the one with more output
        const prevScore = (prev.updatedAt || 0) + (prev.output?.length || 0)
        const curScore = (it.updatedAt || 0) + (it.output?.length || 0)
        if (curScore >= prevScore) map.set(key, it)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
  }, [])

  // One-time dedupe after localStorage hydration
  useEffect(() => {
    setItems(prev => dedupeByTid(prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Merge server records into local state, preserving UI-only fields
  const mergeServerRecords = useCallback((records: Array<any>) => {
    if (!Array.isArray(records) || records.length === 0) return
    setItems(prev => {
      const byTid = new Map<string, ProcItem>()
      for (const it of prev) {
        if (it.terminalId) byTid.set(it.terminalId, it)
      }
      const next = [...prev]
      for (const r of records) {
        const tid: string | undefined = r?.terminalId || r?.id
        if (!tid) continue
        const existing = byTid.get(tid)
        if (existing) {
          // Update runtime fields, preserve UI-only state like output/open
          existing.status = r.status || existing.status
          existing.exitCode = typeof r.exitCode === 'number' ? r.exitCode : existing.exitCode
          existing.signal = r.signal || existing.signal
          existing.command = r.command || existing.command
          existing.args = Array.isArray(r.args) ? r.args : existing.args
          existing.cwd = typeof r.cwd === 'string' ? r.cwd : existing.cwd
          existing.updatedAt = typeof r.updatedAt === 'number' ? r.updatedAt : now()
        } else {
          next.push({
            id: `remote_${tid}`,
            terminalId: tid,
            command: r.command || '',
            args: Array.isArray(r.args) ? r.args : [],
            cwd: r.cwd,
            status: r.status || 'running',
            exitCode: r.exitCode,
            signal: r.signal,
            createdAt: typeof r.createdAt === 'number' ? r.createdAt : now(),
            updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now(),
            output: '',
            truncated: false,
            outputByteLimit: DEFAULT_OUTPUT_LIMIT,
            open: false,
          })
        }
      }
      return dedupeByTid(next)
    })
  }, [dedupeByTid])

  // Hydrate from server on connect
  useEffect(() => {
    if (!isConnected) return
    sendAcp('terminal.commands.list')
      .then((res: any) => {
        const items = Array.isArray(res?.items) ? res.items : []
        mergeServerRecords(items)
      })
      .catch(() => {/* ignore */})
  }, [isConnected, sendAcp, mergeServerRecords])

  const addItem = useCallback((p: ProcItem) => {
    setItems(prev => dedupeByTid([p, ...prev]).slice(0, 200))
  }, [dedupeByTid])

  const updateItem = useCallback((id: string, patch: Partial<ProcItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch, updatedAt: now() } : it))
  }, [])

  // WS live events from ACP bridge
  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      try {
        if (msg?.type === 'terminal_output') {
          const tid = msg.terminalId as string
          const chunk = typeof msg.chunk === 'string' ? msg.chunk : ''
          if (!tid || !chunk) return
          setItems(prev => prev.map(it => it.terminalId === tid ? { ...it, status: 'running', output: trimOutput((it.output||'') + chunk, it.outputByteLimit || DEFAULT_OUTPUT_LIMIT).text, updatedAt: now() } : it))
        }
        if (msg?.type === 'terminal_exit') {
          const tid = msg.terminalId as string
          const exit = msg.exitStatus || {}
          setItems(prev => prev.map(it => it.terminalId === tid ? { ...it, status: 'exited', exitCode: exit?.exitCode, signal: exit?.signal, updatedAt: now() } : it))
        }
        // Cross-device command record updates
        if (msg?.type === 'terminal_command_update') {
          const r = msg.record
          if (msg.cleared) {
            setItems([])
            return
          }
          if (r && r.removed && (r.terminalId || r.id)) {
            const tid = String(r.terminalId || r.id)
            setItems(prev => prev.filter(it => it.terminalId !== tid))
            return
          }
          if (r) {
            mergeServerRecords([r])
          }
        }
      } catch {}
    })
    return unsub
  }, [addMessageListener])

  // Auto-refresh polling for running tasks (fallback when no live chunks arrive)
  useEffect(() => {
    if (!autoRefresh) return
    autoRef.current = setInterval(() => {
      const running = items.filter(it => it.terminalId && (it.status === 'running' || it.status === 'starting'))
      if (running.length === 0) return
      running.forEach(it => {
        sendAcp('terminal.output', { terminalId: it.terminalId })
          .then((res: any) => {
            const out = String(res?.output || '')
            const exit = res?.exitStatus
            // Replace full buffer (server returns whole buffer)
            const trimmed = trimOutput(out, it.outputByteLimit || DEFAULT_OUTPUT_LIMIT)
            updateItem(it.id, { output: trimmed.text, truncated: trimmed.truncated, ...(exit ? { status: 'exited', exitCode: exit?.exitCode, signal: exit?.signal } : {}) })
          })
          .catch(() => {/* ignore */})
      })
    }, 2000)
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [autoRefresh, items, sendAcp, updateItem])

  const parseArgs = (s: string): string[] => {
    if (!s.trim()) return []
    return s.match(/(")([^"]*)(")|(')([^']*)(')|[^\s]+/g)?.map(t => t.replace(/^"|"$/g, '').replace(/^'|'$/g, '')) || []
  }

  const runCommand = async (cmd: string, args: string[], options?: { cwd?: string }) => {
    if (creating) return
    setCreating(true)
    try {
      const cwdVal = options?.cwd?.trim() || undefined
      const resp = await sendAcp('terminal.create', { command: cmd, args, cwd: cwdVal, outputByteLimit: DEFAULT_OUTPUT_LIMIT })
      const tid = resp?.terminalId || resp?.terminalID || resp?.id
      if (!tid) throw new Error('terminalId missing')
      const item: ProcItem = {
        id: String(tid),
        terminalId: String(tid),
        command: cmd,
        args,
        cwd: cwdVal,
        status: 'running',
        createdAt: now(),
        updatedAt: now(),
        output: '',
        outputByteLimit: DEFAULT_OUTPUT_LIMIT,
        open: true,
      }
      addItem(item)
      // Immediately pull first output snapshot
      try {
        const out = await sendAcp('terminal.output', { terminalId: tid })
        const text = String(out?.output || '')
        const trimmed = trimOutput(text, DEFAULT_OUTPUT_LIMIT)
        updateItem(item.id, { output: trimmed.text, truncated: trimmed.truncated })
      } catch {}
    } catch (e: any) {
      // Optionally surface error UI: for now, no-op
    } finally {
      setCreating(false)
    }
  }

  const onRun = async () => {
    const cmd = command.trim()
    if (!cmd) return
    const args = parseArgs(argsInput)
    await runCommand(cmd, args, { cwd })
    setCommand('')
    setArgsInput('')
  }

  const onRefresh = async (item: ProcItem) => {
    if (!item.terminalId) return
    try {
      const out = await sendAcp('terminal.output', { terminalId: item.terminalId })
      const text = String(out?.output || '')
      const exit = out?.exitStatus
      const trimmed = trimOutput(text, item.outputByteLimit || DEFAULT_OUTPUT_LIMIT)
      updateItem(item.id, { output: trimmed.text, truncated: trimmed.truncated, ...(exit ? { status: 'exited', exitCode: exit?.exitCode, signal: exit?.signal } : {}) })
    } catch {}
  }

  const onKill = async (item: ProcItem) => {
    if (!item.terminalId) return
    try { await sendAcp('terminal.kill', { terminalId: item.terminalId }); updateItem(item.id, { status: 'killed' }) } catch {}
  }

  const onRelease = async (item: ProcItem) => {
    if (!item.terminalId) return
    try { await sendAcp('terminal.release', { terminalId: item.terminalId }); updateItem(item.id, { status: 'released' }) } catch {}
  }

  const onRemove = async (item: ProcItem) => {
    if (!item.terminalId) return
    try {
      await sendAcp('terminal.commands.remove', { terminalId: item.terminalId })
      // Optimistic update; server will also broadcast
      setItems(prev => prev.filter(it => it.terminalId !== item.terminalId))
    } catch {}
  }

  const onClearAll = async () => {
    try {
      await sendAcp('terminal.commands.clear', {})
      setItems([])
    } catch {}
  }

  const filtered = useMemo(() => {
    switch (filter) {
      case 'running': return items.filter(i => i.status === 'running' || i.status === 'starting')
      case 'finished': return items.filter(i => ['exited','killed','released','error'].includes(i.status))
      default: return items
    }
  }, [filter, items])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Terminal Commands</h2>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> Auto-refresh</label>
          <span className={cn('px-2 py-1 rounded border text-xs', isConnected ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300')}>{isConnected ? 'Online' : 'Offline'}</span>
          <button className="rounded-md border border-border px-2 py-1" onClick={onClearAll} title="Clear all server-side records"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p, idx) => (
          <button key={idx} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted" onClick={() => { setCommand(p.command); setArgsInput(p.args.join(' ')); }}>
            <ListPlus className="w-3 h-3 inline-block mr-1" />{p.label}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_200px_auto] gap-2">
        <input className="rounded-md border border-border px-3 py-2 text-sm" placeholder="Command (e.g., npm, docker, node)" value={command} onChange={e => setCommand(e.target.value)} />
        <input className="rounded-md border border-border px-3 py-2 text-sm" placeholder="Args (space-separated)" value={argsInput} onChange={e => setArgsInput(e.target.value)} />
        <input className="rounded-md border border-border px-3 py-2 text-sm" placeholder="CWD (optional)" value={cwd} onChange={e => setCwd(e.target.value)} />
        <button className="rounded-md border border-border px-3 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center disabled:opacity-60" onClick={onRun} disabled={!command.trim() || creating}>
          <Play className="w-4 h-4 mr-1" /> Run
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 text-xs">
        <label>Filter:</label>
        <select className="rounded-md border border-border px-2 py-1" value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="all">All</option>
          <option value="running">Running</option>
          <option value="finished">Finished</option>
        </select>
      </div>

      {/* Process List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-4">No commands yet. Use presets or enter a command above.</div>
        )}
        {filtered.map((it) => (
          <div key={it.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-mono whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>
                  <button
                    className="inline-flex items-center mr-2 text-muted-foreground hover:text-foreground"
                    onClick={() => updateItem(it.id, { open: !(it.open) })}
                    title={it.open ? 'Collapse' : 'Expand'}
                  >
                    {it.open !== false ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <span className="text-green-600">$</span> {it.command} {it.args.join(' ')} {it.cwd ? `\n(cwd: ${it.cwd})` : ''}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <span className={cn('px-2 py-0.5 rounded border',
                    it.status === 'running' || it.status === 'starting' ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : it.status === 'exited' ? 'bg-green-100 text-green-800 border-green-300'
                    : it.status === 'killed' ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                    : it.status === 'released' ? 'bg-gray-100 text-gray-800 border-gray-300'
                    : it.status === 'error' ? 'bg-red-100 text-red-800 border-red-300'
                    : 'bg-muted border-border')}>{it.status}</span>
                  <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{new Date(it.createdAt).toLocaleTimeString()}</span>
                  {typeof it.exitCode === 'number' && <span>exit={it.exitCode}</span>}
                  {it.signal && <span>signal={it.signal}</span>}
                  {it.truncated && <span className="text-orange-600">(output truncated)</span>}
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <button className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => onRefresh(it)} title="Refresh output"><RefreshCw className="w-4 h-4" /></button>
                <button className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => onKill(it)} title="Stop (kill)"><Square className="w-4 h-4" /></button>
                <button className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => onRelease(it)} title="Release (detach)"><X className="w-4 h-4" /></button>
                <button className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => onRemove(it)} title="Force delete (remove record)"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {/* Output */}
            {it.output && (it.open !== false) && (
              <div className="mt-3 text-xs whitespace-pre-wrap bg-muted/40 rounded-md border border-border p-2" style={{ maxHeight: 260, overflow: 'auto' }}>
                {it.output}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Export button (optional) */}
      {items.length > 0 && (
        <div className="pt-2">
          <button
            className="rounded-md border border-border px-3 py-2 text-xs flex items-center gap-2"
            onClick={() => {
              try {
                const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'terminal-commands-history.json'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              } catch {}
            }}
          >
            <Download className="w-4 h-4" /> Export History
          </button>
        </div>
      )}
    </div>
  )
}

export default TerminalCommandsPage
