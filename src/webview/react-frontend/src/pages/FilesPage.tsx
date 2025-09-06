import React, { useEffect, useRef } from 'react';
import { Breadcrumbs, Crumb } from '../components/files/Breadcrumbs';
import { FileTree } from '../components/files/FileTree';
import { FileNodeLike } from '../components/files/FileNodeItem';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from '../components/ui/bottom-sheet';
import { useWebSocket } from '../components/WebSocketProvider';
import { useNavigate } from '@tanstack/react-router';

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
  const { sendJson, addMessageListener } = useWebSocket();
  const [crumbs, setCrumbs] = React.useState<Crumb[]>([{ name: 'root', path: '/' }]);
  const [nodes, setNodes] = React.useState<FileNodeLike[]>([]);
  const [activeNode, setActiveNode] = React.useState<FileNodeLike | null>(null);
  const [_currentPath, setCurrentPath] = React.useState<string>('/');
  const pendingIdRef = useRef<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const openNode = (node: FileNodeLike) => {
    if (node.type === 'directory') {
      setCrumbs((c) => [...c, { name: node.name, path: node.path }]);
      requestTree(node.path);
    } else {
      // Navigate to file viewer route with search param
      navigate({ to: '/files/view', search: { path: node.path } });
    }
  };

  const requestTree = (path: string) => {
    const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    pendingIdRef.current = id;
    setCurrentPath(path);
    sendJson({ type: 'fileSystem', id, data: { fileSystemData: { operation: 'tree', path } } });
  };

  useEffect(() => {
    // initial load
    requestTree('/');
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
      }
      // watch events can be handled here later
    });
    return unsub;
  }, []);

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
      <div className="flex items-center justify-between mb-3">
        <Breadcrumbs items={crumbs} onNavigate={(_p) => { setCrumbs([{ name: 'root', path: '/' }]); requestTree('/'); }} />
        <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted neo:rounded-none neo:border-[3px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">+ New</button>
      </div>
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>
      )}
      <FileTree nodes={nodes} onOpen={openNode} onLongPress={setActiveNode} />

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
