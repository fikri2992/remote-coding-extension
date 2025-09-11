import React from 'react';
import { useEffect, useState } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import { Bug, Terminal as TerminalIcon, Trash2, Pause, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DebugOverlayProps = {
  initialOpen?: boolean;
};

// A floating debug overlay that subscribes to all WS messages and shows
// - Agent connect payload
// - STDERR lines
// - Recent events (throttled)
// Toggleable with a floating FAB in the bottom-right.

const storageKey = 'kiro_debug_overlay_open_v1';

const DebugOverlay: React.FC<DebugOverlayProps> = ({ initialOpen }) => {
  const { addMessageListener } = useWebSocket();
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return !!initialOpen;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch {}
    return !!initialOpen;
  });
  const [paused, setPaused] = useState(false);
  const [stderr, setStderr] = useState<string[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [connectInfo, setConnectInfo] = useState<{ exe?: string; args?: string[]; cwd?: string; envKeys?: string[] } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, isOpen ? '1' : '0');
    } catch {}
  }, [isOpen]);

  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (paused || !msg) return;
      try {
        if (msg.type === 'agent_connect') {
          setConnectInfo({ exe: msg.exe, args: msg.args, cwd: msg.cwd, envKeys: msg.envKeys });
        } else if (msg.type === 'agent_stderr') {
          setStderr((prev) => {
            const next = [...prev, String(msg.line ?? '')];
            return next.slice(-500);
          });
        }
        setEvents((prev) => {
          const next = [...prev, msg];
          return next.slice(-200);
        });
      } catch {}
    });
    return unsub;
  }, [addMessageListener, paused]);

  const toggle = () => setIsOpen((v) => !v);
  const clear = () => { setStderr([]); setEvents([]); setConnectInfo(null); };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={toggle}
        className={cn(
          'fixed bottom-4 right-4 z-50 rounded-full shadow-lg flex items-center justify-center',
          'h-12 w-12 bg-black text-white dark:bg-white dark:text-black',
          'neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)]'
        )}
        title={isOpen ? 'Hide Debug Overlay' : 'Show Debug Overlay'}
      >
        <Bug className="h-6 w-6" />
      </button>

      {/* Overlay Panel */}
      {isOpen && (
        <div className="fixed inset-x-2 inset-y-8 md:inset-y-10 md:right-10 md:left-auto md:w-[min(720px,90vw)] z-50">
          <div className="bg-card border border-border rounded-lg h-full flex flex-col neo:rounded-none neo:border-[3px]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2 text-sm">
                <Bug className="h-4 w-4" />
                <span className="font-semibold">Debug Overlay</span>
                <span className="text-xs text-muted-foreground">(live WS)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="px-2 py-1 rounded border border-input text-xs hover:bg-muted"
                  title={paused ? 'Resume' : 'Pause'}
                >
                  {paused ? <><Play className="h-3 w-3 inline mr-1" />Resume</> : <><Pause className="h-3 w-3 inline mr-1" />Pause</>}
                </button>
                <button onClick={clear} className="px-2 py-1 rounded border border-input text-xs hover:bg-muted" title="Clear">
                  <Trash2 className="h-3 w-3 inline mr-1" />
                  Clear
                </button>
                <button onClick={toggle} className="p-1 rounded hover:bg-muted" title="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-2 space-y-3">
              {/* Connect Info */}
              <div className="border border-border rounded p-2 text-xs">
                <div className="font-semibold mb-1">Agent Connect</div>
                {connectInfo ? (
                  <div className="space-y-1">
                    <div><span className="opacity-70">exe:</span> {connectInfo.exe}</div>
                    <div><span className="opacity-70">args:</span> {JSON.stringify(connectInfo.args || [])}</div>
                    <div><span className="opacity-70">cwd:</span> {connectInfo.cwd}</div>
                    <div><span className="opacity-70">envKeys:</span> {(connectInfo.envKeys || []).join(', ')}</div>
                  </div>
                ) : (
                  <div className="opacity-70">No connection yet.</div>
                )}
              </div>

              {/* STDERR */}
              <div className="border border-border rounded p-2 text-xs">
                <div className="font-semibold mb-1 flex items-center gap-2"><TerminalIcon className="h-3 w-3" />STDERR</div>
                <pre className="bg-background border border-border rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">{stderr.join('\n')}</pre>
              </div>

              {/* Events */}
              <div className="border border-border rounded p-2 text-xs">
                <div className="font-semibold mb-1">Recent Events ({events.length})</div>
                <div className="space-y-1 max-h-56 overflow-auto">
                  {events.slice(-100).reverse().map((e, i) => (
                    <pre key={i} className="bg-background border border-border rounded p-2 whitespace-pre-wrap overflow-auto">{JSON.stringify(e)}</pre>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DebugOverlay;
