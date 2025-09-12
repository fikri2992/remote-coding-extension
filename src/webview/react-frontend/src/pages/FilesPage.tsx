import React, { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { Breadcrumbs, Crumb } from '../components/files/Breadcrumbs';
import { FileTree } from '../components/files/FileTree';
import { FileNodeLike } from '../components/files/FileNodeItem';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from '../components/ui/bottom-sheet';
import { useWebSocket } from '../components/WebSocketProvider';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { TopProgressBar } from '../components/feedback/TopProgressBar';
import { usePendingNav } from '../contexts/PendingNavContext';
import { useDelayedFlag } from '../lib/hooks/useDelayedFlag';
import { useLiveRegion } from '../contexts/LiveRegionContext';
import { useToast } from '../components/ui/toast';
import { useRipple } from '../lib/hooks/useRipple';
import { usePersistentState } from '../lib/hooks/usePersistentState';

function mapServerNodes(children: any[], depth = 0): FileNodeLike[] {
  return (children || []).map((n: any) => ({
    name: n.name,
    path: n.path,
    type: n.type,
    depth,
  }));
}

const FilesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sendJson, addMessageListener, isConnected } = useWebSocket();
  const pendingNav = usePendingNav();
  const live = useLiveRegion();
  const { show } = useToast();
  const crumbs = React.useMemo<Crumb[]>(() => {
    const p = ((location.search as any)?.path as string) || '/';
    const clean = (p || '/').replace(/\\/g, '/').replace(/^\/+/, '');
    if (clean === '') return [];
    const parts = clean.split('/');
    return parts.map((seg, i) => ({ name: seg, path: '/' + parts.slice(0, i + 1).join('/') }));
  }, [location.search]);
  const [nodes, setNodes] = React.useState<FileNodeLike[]>([]);
  const [activeNode, setActiveNode] = React.useState<FileNodeLike | null>(null);
  const [_currentPath, setCurrentPath] = React.useState<string>('/');
  const pendingIdRef = useRef<string | null>(null);
  const pendingPathRef = useRef<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'compact' | 'detailed'>('detailed');
  const [loading, setLoading] = React.useState<boolean>(false);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const refreshSpinnerDelayed = useDelayedFlag(refreshing, 150);
  const backRipple = useRipple();
  const refreshRipple = useRipple();

  // Filters
  const [showHidden, setShowHidden] = usePersistentState<boolean>('filesShowHidden', false);
  const [showIgnored, setShowIgnored] = usePersistentState<boolean>('filesShowIgnored', false);

  // buildCrumbs removed; crumbs derived inline above

  const openNode = (node: FileNodeLike) => {
    if (node.type === 'directory') {
      // Update route so browser back works and effect loads directory
      pendingNav.start({ type: 'directory', path: node.path, label: node.name });
      live.announce(`Opening ${node.name}`);
      navigate({ to: '/files', search: { path: node.path } as any });
    } else {
      // Navigate to file viewer route with search param
      // Include the current directory as `from` so the FileViewer can reliably go back
      const currentDir = crumbs.length > 0 ? crumbs[crumbs.length - 1].path : '/';
      pendingNav.start({ type: 'file', path: node.path, label: node.name });
      live.announce(`Opening ${node.name}`);
      navigate({ to: '/files/view', search: { path: node.path, from: currentDir } as any });
    }
  };


  const requestTree = async (
    path: string,
    retryCount: number = 0,
    background: boolean = false,
    override?: { allowHiddenFiles?: boolean; useGitIgnore?: boolean }
  ) => {
    // Check if WebSocket is connected
    if (!isConnected) {
      if (retryCount === 0) {
        setError('Waiting for connection...');
        // Retry when connection is established
        setTimeout(() => {
          if (isConnected) {
            requestTree(path, retryCount + 1);
          }
        }, 1000);
        return;
      } else {
        setError('Connection lost. Please refresh the page.');
        return;
      }
    }

    const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    pendingIdRef.current = id;
    pendingPathRef.current = path;
    setCurrentPath(path);
    if (!background) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null); // Clear any previous errors
    
    const options = {
      allowHiddenFiles: override?.allowHiddenFiles ?? showHidden,
      useGitIgnore: override?.useGitIgnore ?? !showIgnored,
      depth: 1, // UI only needs one level; avoid deep recursion/timeouts
    } as const;
    const sent = sendJson({ type: 'fileSystem', id, data: { fileSystemData: { operation: 'tree', path, options } } });
    
    if (!sent) {
      if (!background) setLoading(false);
      setError('Failed to send request. Please try again.');
      pendingNav.fail('send failed');
      show({ title: 'Failed', description: 'Could not send request', variant: 'destructive' });
      return;
    }
    
    // Add timeout mechanism
    setTimeout(() => {
      if (pendingIdRef.current === id) {
        pendingIdRef.current = null;
        setLoading(false);
        
        // Retry once on timeout if this is the first attempt
        if (retryCount === 0) {
          console.log(`FilesPage: Request timeout for path ${path}, retrying...`);
          setTimeout(() => requestTree(path, retryCount + 1), 1000);
        } else {
          setError(`Request timeout loading directory. Please try again.`);
          setRefreshing(false);
          pendingNav.fail('timeout');
          show({ title: 'Timeout', description: 'Loading directory timed out', variant: 'destructive' });
        }
      }
    }, 10000); // 10 second timeout
  };

  const loadDirectory = (path: string) => {
    // Always fetch fresh data; do not use view-state or cache
    setRefreshing(false);
    requestTree(path, 0, false);
  };

  useEffect(() => {
    if (!isConnected) return;
    // Register listener first to avoid racing the first response
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'fileSystem') return;
        if (msg.data?.operation === 'tree') {
        if (!pendingIdRef.current || msg.id !== pendingIdRef.current) return;
        
        if (msg.data?.ok && msg.data?.result?.children) {
          const activePath = pendingPathRef.current || _currentPath;
          const list = mapServerNodes(msg.data.result.children, 0);
          setNodes(list);
          // No view-state persistence
          setError(null); // Clear any previous errors
          pendingNav.finish(activePath);
          live.announce('Loaded');
        } else if (msg.data?.ok === false) {
          const errText = msg.data?.error || 'Failed to load directory';
          setError(errText);
          pendingNav.fail(errText);
          live.announce('Failed to load directory');
          show({ title: 'Failed to load', description: errText, variant: 'destructive' });
        }
        
        pendingIdRef.current = null;
        pendingPathRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
      // watch events can be handled here later
    });
    // initial load respects ?path= in URL
    const initialPath = ((location.search as any)?.path as string) || '/';
    // Always fetch fresh data; do not use view-state or cache
    loadDirectory(initialPath);
    return unsub;
  }, [location.search, isConnected, showHidden, showIgnored]);

  const showTopBar = useDelayedFlag(pendingNav.isActive, 200);

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)] overflow-hidden">
      {/* Enhanced header with view controls */}
      <div className="p-4 border-b border-border bg-muted/20 neo:border-b-[2px]" aria-busy={loading || refreshing || undefined}>
        <TopProgressBar active={showTopBar} />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Mobile back button (hidden at root) */}
            {crumbs.length > 0 && (
              <button
                className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-md border border-border neo:rounded-none neo:border-[2px]"
                aria-label="Back"
                onClick={() => {
                  // Go back one level
                  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].path : '/';
                  pendingNav.start({ type: 'directory', path: parent, label: 'Back' });
                  live.announce('Opening parent');
                  navigate({ to: '/files', search: { path: parent } as any });
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M11.78 15.22a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L7.56 9H16a.75.75 0 010 1.5H7.56l4.22 4.22a.75.75 0 010 1.06z"/></svg>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <Breadcrumbs
                items={crumbs}
                onNavigate={(path) => {
                  const currentPath = crumbs.length > 0 ? crumbs[crumbs.length - 1].path : '/';
                  if (path === currentPath) {
                    // No-op navigation: stop any pending bar
                    pendingNav.finish(path);
                    return;
                  }
                  pendingNav.start({ type: 'directory', path, label: path.split('/').pop() || '/' });
                  live.announce(`Opening ${path.split('/').pop() || '/'}`);
                  navigate({ to: '/files', search: { path } as any });
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop-visible Back button (hidden at root) */}
            {crumbs.length > 0 && (
            <button
              className="hidden md:inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[3px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]"
              onClick={() => {
                const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].path : '/';
                pendingNav.start({ type: 'directory', path: parent, label: 'Back' });
                live.announce('Opening parent');
                navigate({ to: '/files', search: { path: parent } as any });
              }}
              onPointerDown={(e) => backRipple.onPointerDown(e as any)}
              aria-label="Back to parent"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M11.78 15.22a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L7.56 9H16a.75.75 0 010 1.5H7.56l4.22 4.22a.75.75 0 010 1.06z"/></svg>
              Back
              {backRipple.Ripple}
            </button>
            )}
            <button
              className="shrink-0 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors neo:rounded-none neo:border-[3px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]"
              onClick={() => {
                const currentPath = _currentPath || (crumbs.length > 0 ? crumbs[crumbs.length - 1].path : '/');
                // Manual refresh: keep UI, revalidate in background
                setRefreshing(true);
                requestTree(currentPath, 0, true);
              }}
              onPointerDown={(e) => refreshRipple.onPointerDown(e as any)}
            >
              <span className="inline-flex items-center gap-2">
                <span>Refresh</span>
                {refreshSpinnerDelayed && (
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </span>
              {refreshRipple.Ripple}
            </button>
          </div>
        </div>

        {/* View mode controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-muted-foreground">View:</span>
            <div className="inline-flex rounded-md border border-border neo:rounded-none neo:border-[2px]">
              <button
                onClick={() => setViewMode('detailed')}
                className={cn(
                  'px-3 py-1 text-xs font-medium transition-colors',
                  'neo:rounded-none',
                  viewMode === 'detailed'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                Detailed
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={cn(
                  'px-3 py-1 text-xs font-medium transition-colors border-l border-border',
                  'neo:rounded-none neo:border-l-[2px]',
                  viewMode === 'compact'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                Compact
              </button>
            </div>

            {/* Filters */}
            <span className="text-xs text-muted-foreground">Filters:</span>
            <div className="inline-flex rounded-md border border-border neo:rounded-none neo:border-[2px]">
              <button
                onClick={() => { const next = !showHidden; setShowHidden(next); const p = _currentPath || (crumbs.length ? crumbs[crumbs.length - 1].path : '/'); setRefreshing(true); requestTree(p, 0, true, { allowHiddenFiles: next, useGitIgnore: !showIgnored }); }}
                className={cn(
                  'px-3 py-1 text-xs font-medium transition-colors',
                  'neo:rounded-none',
                  showHidden ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
                title="Show hidden files (dotfiles)"
              >
                Show hidden
              </button>
              <button
                onClick={() => { const next = !showIgnored; setShowIgnored(next); const p = _currentPath || (crumbs.length ? crumbs[crumbs.length - 1].path : '/'); setRefreshing(true); requestTree(p, 0, true, { allowHiddenFiles: showHidden, useGitIgnore: !next }); }}
                className={cn(
                  'px-3 py-1 text-xs font-medium transition-colors border-l border-border',
                  'neo:rounded-none neo:border-l-[2px]',
                  showIgnored ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
                title="Show files ignored by .gitignore"
              >
                Show ignored
              </button>
            </div>
          </div>
          
          {/* File count, cache status, and loading indicator */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {loading ? (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span>Loading...</span>
              </div>
            ) : (
              <span>{nodes.length} {nodes.length === 1 ? 'item' : 'items'}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Error state */}
      {error && (
        <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 neo:rounded-none neo:border-[2px]">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => {
                setError(null);
                if (isConnected) {
                  const currentPath = crumbs.length > 0 ? crumbs[crumbs.length - 1].path : '/';
                  requestTree(currentPath);
                }
              }}
              className="ml-3 rounded-md border border-red-600 bg-white px-2 py-1 text-red-600 hover:bg-red-50 neo:rounded-none neo:border-[2px] neo:shadow-[2px_2px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[2px_2px_0_0_rgba(255,255,255,0.9)]"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* File tree with improved container */}
      <div className={cn("p-2", viewMode === 'compact' ? 'py-1' : 'py-2')}>
        {loading && nodes.length === 0 ? (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 sm:h-10 rounded-md bg-muted/40 animate-pulse neo:rounded-none neo:border-[2px] neo:border-border/40" />
            ))}
          </div>
        ) : nodes.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 mb-4 text-muted-foreground/30">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-muted-foreground mb-1">Empty directory</div>
            <div className="text-xs text-muted-foreground/70">No files or folders found</div>
          </div>
        ) : (
          <FileTree nodes={nodes} pendingPath={pendingNav.target?.path} onOpen={(node) => {
            openNode(node);
          }} onLongPress={setActiveNode} viewMode={viewMode} />
        )}
      </div>

      <BottomSheet open={!!activeNode} onClose={() => setActiveNode(null)} ariaLabel="File actions">
        <BottomSheetHeader>
          <BottomSheetTitle>{activeNode?.name}</BottomSheetTitle>
        </BottomSheetHeader>
        <div className="flex flex-col gap-2">
          <button className="w-full text-left px-3 py-2 rounded hover:bg-muted neo:rounded-none neo:border-[4px] neo:border-border neo:hover:bg-accent/10" onClick={() => { if (activeNode) { const p = activeNode.path; const currentDir = crumbs.length > 0 ? crumbs[crumbs.length - 1].path : '/'; setActiveNode(null); navigate({ to: '/files/view', search: { path: p, from: currentDir } as any }); } }}>Open</button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-muted neo:rounded-none neo:border-[4px] neo:border-border neo:hover:bg-accent/10">Rename</button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-muted neo:rounded-none neo:border-[4px] neo:border-border neo:hover:bg-accent/10">Delete</button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-muted neo:rounded-none neo:border-[4px] neo:border-border neo:hover:bg-accent/10">Share</button>
        </div>
        <BottomSheetFooter>
          <button className="rounded-md border border-border px-3 py-2 text-sm neo:rounded-none neo:border-[4px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]" onClick={() => setActiveNode(null)}>Close</button>
        </BottomSheetFooter>
      </BottomSheet>
    </div>
  );
};

export default FilesPage;
