import React from 'react';
import { Breadcrumbs, Crumb } from '../components/files/Breadcrumbs';
import { FileTree } from '../components/files/FileTree';
import { FileNodeLike } from '../components/files/FileNodeItem';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from '../components/ui/bottom-sheet';

const mockNodes: FileNodeLike[] = [
  { name: 'src', path: '/src', type: 'directory', depth: 0 },
  { name: 'index.ts', path: '/src/index.ts', type: 'file', depth: 1 },
  { name: 'components', path: '/src/components', type: 'directory', depth: 1 },
  { name: 'App.tsx', path: '/src/components/App.tsx', type: 'file', depth: 2 },
];

const FilesPage: React.FC = () => {
  const [crumbs, setCrumbs] = React.useState<Crumb[]>([{ name: 'root', path: '/' }]);
  const [nodes] = React.useState<FileNodeLike[]>(mockNodes);
  const [activeNode, setActiveNode] = React.useState<FileNodeLike | null>(null);

  const openNode = (node: FileNodeLike) => {
    if (node.type === 'directory') {
      setCrumbs((c) => [...c, { name: node.name, path: node.path }]);
    } else {
      setActiveNode(node);
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-3">
        <Breadcrumbs items={crumbs} onNavigate={(_p) => setCrumbs([{ name: 'root', path: '/' }])} />
        <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">+ New</button>
      </div>
      <FileTree nodes={nodes} onOpen={openNode} onLongPress={setActiveNode} />

      <BottomSheet open={!!activeNode} onClose={() => setActiveNode(null)} ariaLabel="File actions">
        <BottomSheetHeader>
          <BottomSheetTitle>{activeNode?.name}</BottomSheetTitle>
        </BottomSheetHeader>
        <div className="flex flex-col gap-2">
          <button className="w-full text-left px-3 py-2 rounded hover:bg-muted">Open</button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-muted">Rename</button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-muted">Delete</button>
          <button className="w-full text-left px-3 py-2 rounded hover:bg-muted">Share</button>
        </div>
        <BottomSheetFooter>
          <button className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => setActiveNode(null)}>Close</button>
        </BottomSheetFooter>
      </BottomSheet>
    </div>
  );
};

export default FilesPage;
