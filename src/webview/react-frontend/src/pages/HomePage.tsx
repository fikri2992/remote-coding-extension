import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../components/WebSocketProvider';
import { Link, useNavigate } from '@tanstack/react-router';
import { Folder, Terminal as TerminalIcon, GitBranch, Settings as SettingsIcon, Plus, RefreshCw } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

type FSOp = 'tree' | 'open' | 'watch' | 'create' | 'delete' | 'rename';

  type Item = { name: string; path: string; modified?: Date; size?: number; bucket: 'prompt' | 'result' };

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, sendJson, addMessageListener } = useWebSocket();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const debounceRef = useRef<any>(null);
  const watchStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const pendingMap = useRef<Record<string, { op: FSOp; resolve: (v: any) => void; reject: (e: any) => void }>>({});

  // Minimal RPC helper over WS fileSystem messages
  const sendFS = (op: FSOp, payload: any = {}) => {
    const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const p = new Promise((resolve, reject) => {
      pendingMap.current[id] = { op, resolve, reject } as any;
      // safety timeout
      setTimeout(() => {
        if (pendingMap.current[id]) {
          pendingMap.current[id]!.reject(new Error(`Timeout waiting for ${op}`));
          delete pendingMap.current[id];
        }
      }, 15000);
    });
    const ok = sendJson({ type: 'fileSystem', id, data: { fileSystemData: { operation: op, ...payload } } });
    if (!ok) {
      // Fail fast if not connected so callers can re-run on connect
      setTimeout(() => {
        if (pendingMap.current[id]) {
          pendingMap.current[id]!.reject(new Error('WebSocket not connected'));
          delete pendingMap.current[id];
        }
      }, 0);
    }
    return p;
  };

  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'fileSystem') return;
      const id = msg.id as string;
      const pending = pendingMap.current[id];
      if (!pending) return;
      const ok = !!msg.data?.ok;
      const op = msg.data?.operation;
      if (ok) pending.resolve(msg.data?.result ?? true);
      else pending.reject(new Error(msg.data?.error || `FS ${op} failed`));
      delete pendingMap.current[id];
    });
    return unsub;
  }, []);

  const ensureStructure = async () => {
    // Create parent and subfolders (createDirectory is idempotent)
    await sendFS('create', { path: '/.remote-coding', options: { type: 'directory' } });
    await sendFS('create', { path: '/.remote-coding/prompt', options: { type: 'directory' } });
    await sendFS('create', { path: '/.remote-coding/result', options: { type: 'directory' } });
  };

  const loadList = async () => {
    try {
      const [resPrompt, resResult] = await Promise.all([
        sendFS('tree', { path: '/.remote-coding/prompt' }).catch(() => null),
        sendFS('tree', { path: '/.remote-coding/result' }).catch(() => null),
      ]);
      const listP: Item[] = ((resPrompt as any)?.children || [])
        .filter((c: any) => c.type === 'file')
        .map((c: any) => ({ name: c.name, path: c.path, modified: c.modified ? new Date(c.modified) : undefined, size: c.size, bucket: 'prompt' as const }));
      const listR: Item[] = ((resResult as any)?.children || [])
        .filter((c: any) => c.type === 'file')
        .map((c: any) => ({ name: c.name, path: c.path, modified: c.modified ? new Date(c.modified) : undefined, size: c.size, bucket: 'result' as const }));
      const list: Item[] = [...listP, ...listR];
      // Newest first by modified or name
      list.sort((a, b) => {
        const am = a.modified?.getTime() || 0;
        const bm = b.modified?.getTime() || 0;
        if (am !== bm) return bm - am;
        return b.name.localeCompare(a.name);
      });
      setItems(list);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load list');
      setItems([]);
    }
  };

  useEffect(() => {
    if (!isConnected) return;
    ensureStructure()
      .then(loadList)
      .then(() => {
        if (!watchStartedRef.current) {
          const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
          sendJson({ type: 'fileSystem', id, data: { fileSystemData: { operation: 'watch', path: '/.remote-coding' } } });
          watchStartedRef.current = true;
        }
      })
      .catch((e) => { console.warn('[Home] ensureStructure failed:', e); loadList(); });

    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'fileSystem') return;
      if (msg.data?.event === 'watch') {
        const p = String(msg.data?.path || '');
        if (!p.includes('/.remote-coding/')) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { loadList(); }, 250);
      }
    });
    return unsub;
  }, [isConnected]);

  const randomId = () => Math.random().toString(36).slice(2, 7);
  const timestamp = () => String(Date.now());

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      // 1) Copy text to clipboard first
      try { await navigator.clipboard.writeText(text) } catch { /* ignore clipboard errors */ }

      await ensureStructure();
      const name = `${timestamp()}_${randomId()}.txt`;
      const filePath = `/.remote-coding/prompt/${name}`;
      await sendFS('create', { path: filePath, content: text });
      setInput('');
      await loadList();

      // 2) Trigger a combined VS Code command to Focus -> Paste -> Enter
      try {
        await new Promise<void>((resolve) => {
          const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
          const onMsg = (msg: any) => {
            if (msg?.type !== 'command' || msg.id !== id) return;
            cleanup();
            if (msg?.data?.ok) console.log('[Home] focusPasteEnter OK'); else console.warn('[Home] focusPasteEnter failed:', msg?.data?.error);
            resolve();
          };
          const cleanup = () => unsub();
          const unsub = addMessageListener(onMsg);
          sendJson({ type: 'command', id, command: 'kiroAgent.focusPasteEnter', args: [] });
          setTimeout(() => { cleanup(); console.warn('[Home] focusPasteEnter timeout'); resolve(); }, 4000);
        });
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Failed to create prompt');
    } finally {
      setSubmitting(false);
    }
  };

  const openItem = (item: Item) => {
    navigate({ to: '/files/view', search: { path: item.path } });
  };

  // Stats available if needed later

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Composer on top (mobile-first) */}
      <div className="bg-card p-3 sm:p-4 rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type prompt and submit..."
            className="flex-1"
          />
          <Button onClick={handleSubmit} disabled={submitting} className="shrink-0">
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">Submit</span>
          </Button>
        </div>
        {error && (
          <div className="mt-2 text-xs text-red-600">{error}</div>
        )}
      </div>

      {/* Cards: .remote-coding list (mobile-first) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold">.remote-coding Files</h3>
          <button
            className="text-xs px-2 py-1 rounded border border-border hover:bg-muted neo:rounded-none neo:border-[2px]"
            onClick={() => loadList()}
          >Refresh</button>
        </div>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No files yet. Submit one above.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((it) => (
              <Card key={it.path} className="cursor-pointer" onClick={() => openItem(it)}>
                <CardHeader>
                  <CardTitle className="truncate font-mono text-sm">{it.name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>{it.modified ? new Date(it.modified).toLocaleString() : ''}</span>
                    {typeof it.size === 'number' && <span>{it.size} B</span>}
                  </div>
                  <div className="mt-1">{it.bucket}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions retained */}
      <div className="bg-card p-4 lg:p-6 rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 neo:gap-4">
          <Link to="/files" className="flex flex-col items-center p-3 lg:p-4 bg-muted hover:bg-muted/70 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px] neo:rounded-none neo:border-4 neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2 text-blue-600 neo:rounded-none neo:border-2 neo:border-border">
              <Folder className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={2.5} />
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Files</span>
          </Link>

          <Link to="/terminal" className="flex flex-col items-center p-3 lg:p-4 bg-muted hover:bg-muted/70 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px] neo:rounded-none neo:border-4 neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-100 rounded-full flex items-center justify-center mb-2 text-green-600 neo:rounded-none neo:border-2 neo:border-border">
              <TerminalIcon className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={2.5} />
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Terminal</span>
          </Link>

          <Link to="/git" className="flex flex-col items-center p-3 lg:p-4 bg-muted hover:bg-muted/70 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px] neo:rounded-none neo:border-4 neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-100 rounded-full flex items-center justify-center mb-2 text-yellow-600 neo:rounded-none neo:border-2 neo:border-border">
              <GitBranch className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={2.5} />
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Git</span>
          </Link>

          <Link to="/settings" className="flex flex-col items-center p-3 lg:p-4 bg-muted hover:bg-muted/70 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px] neo:rounded-none neo:border-4 neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-full flex items-center justify-center mb-2 text-purple-600 neo:rounded-none neo:border-2 neo:border-border">
              <SettingsIcon className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={2.5} />
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
