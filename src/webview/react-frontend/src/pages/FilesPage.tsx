import React, { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { Breadcrumbs, Crumb } from '../components/files/Breadcrumbs';
import { FileTree } from '../components/files/FileTree';
import { FileNodeLike } from '../components/files/FileNodeItem';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from '../components/ui/bottom-sheet';
import { useWebSocket } from '../components/WebSocketProvider';
import { useNavigate, useLocation } from '@tanstack/react-router';

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
  const [crumbs, setCrumbs] = React.useState<Crumb[]>([]);
  const [nodes, setNodes] = React.useState<FileNodeLike[]>([]);
  const [activeNode, setActiveNode] = React.useState<FileNodeLike | null>(null);
  const [_currentPath, setCurrentPath] = React.useState<string>('/');
  const pendingIdRef = useRef<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'compact' | 'detailed'>('detailed');
  const [loading, setLoading] = React.useState<boolean>(false);

  const buildCrumbs = (path: string): Crumb[] => {
    const clean = (path || '/').replace(/\\/g, '/').replace(/^\/+/, '');
    if (clean === '') return [];
    const parts = clean.split('/');
    const arr: Crumb[] = [];
    parts.forEach((p, i) => {
      const full = '/' + parts.slice(0, i + 1).join('/');
      arr.push({ name: p, path: full });
    });
    return arr;
  };

  const openNode = (node: FileNodeLike) => {
    if (node.type === 'directory') {
      setCrumbs(buildCrumbs(node.path));
      requestTree(node.path);
    } else {
      // Navigate to file viewer route with search param
      navigate({ to: '/files/view', search: { path: node.path } });
    }
  };

  const requestTree = (path: string) => {
    if (!isConnected) return;
    const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    pendingIdRef.current = id;
    setCurrentPath(path);
    setLoading(true);
    sendJson({ type: 'fileSystem', id, data: { fileSystemData: { operation: 'tree', path } } });
  };

  useEffect(() => {
    if (!isConnected) return;
    // initial load respects ?path= in URL
    const initialPath = ((location.search as any)?.path as string) || '/';
    setCrumbs(buildCrumbs(initialPath));
    requestTree(initialPath);
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'fileSystem') return;
      if (msg.data?.operation === 'tree') {
        if (!pendingIdRef.current || msg.id !== pendingIdRef.current) return;
        if (msg.data?.ok && msg.data?.result?.children) {
          setNodes(mapServerNodes(msg.data.result.children, 0));
          setError(null);
        } else if (msg.data?.ok === false) {
          setError(msg.data?.error || 'Failed to load directory');
        }
        pendingIdRef.current = null;
        setLoading(false);
      }
      // watch events can be handled here later
    });
    return unsub;
  }, [location.search, isConnected]);

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)] overflow-hidden">
      {/* Enhanced header with view controls */}
      <div className="p-4 border-b border-border bg-muted/20 neo:border-b-[2px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Mobile back button */}
            <button
              className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-md border border-border neo:rounded-none neo:border-[2px]"
              aria-label="Back"
              onClick={() => {
                const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].path : '/'
                setCrumbs(buildCrumbs(parent));
                requestTree(parent);
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M11.78 15.22a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L7.56 9H16a.75.75 0 010 1.5H7.56l4.22 4.22a.75.75 0 010 1.06z"/></svg>
            </button>
            <div className="min-w-0 flex-1">
              <Breadcrumbs
                items={crumbs}
                onNavigate={(path) => { setCrumbs(buildCrumbs(path)); requestTree(path); }}
              />
            </div>
          </div>
          <button className="shrink-0 ml-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors neo:rounded-none neo:border-[3px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">
            + New
          </button>
        </div>
        
        {/* View mode controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
          </div>
          
          {/* File count and loading indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
          {error}
        </div>
      )}
      
      {/* File tree with improved container */}
      <div className={cn("p-2", viewMode === 'compact' ? 'py-1' : 'py-2')}>
        {nodes.length === 0 && !loading ? (
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
          <FileTree nodes={nodes} onOpen={openNode} onLongPress={setActiveNode} viewMode={viewMode} />
        )}
      </div>

      <BottomSheet open={!!activeNode} onClose={() => setActiveNode(null)} ariaLabel="File actions">
        <BottomSheetHeader>
          <BottomSheetTitle>{activeNode?.name}</BottomSheetTitle>
        </BottomSheetHeader>
        <div className="flex flex-col gap-2">
          <button className="w-full text-left px-3 py-2 rounded hover:bg-muted neo:rounded-none neo:border-[4px] neo:border-border neo:hover:bg-accent/10" onClick={() => { if (activeNode) { const p = activeNode.path; setActiveNode(null); navigate({ to: '/files/view', search: { path: p } }); } }}>Open</button>
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
