import React, { useEffect, useRef, useState } from 'react';
import { GitStatusList, GitStatusItem } from '../components/git/GitStatusList';
import { CommitComposer } from '../components/git/CommitComposer';
import { useWebSocket } from '../components/WebSocketProvider';
import { GitHistoryViewer } from '../components/git/GitHistoryViewer';
import { DiffFile } from '../components/git/DiffFile';
import { usePullToRefresh } from '../lib/hooks/usePullToRefresh';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle } from '../components/ui/bottom-sheet';

interface GitRepositoryState {
  currentBranch: string;
  status: { staged: string[]; unstaged: string[]; untracked: string[]; conflicted: string[] };
  recentCommits: { hash: string; message: string; author: string; date: string | Date }[];
  remoteStatus: { ahead: number; behind: number; remote: string };
  repositoryRoot: string;
}

const GitPage: React.FC = () => {
  const { sendJson, addMessageListener } = useWebSocket();
  const [repo, setRepo] = useState<GitRepositoryState | null>(null);
  const [_diffText, setDiffText] = useState<string>('');
  const [diffFiles, setDiffFiles] = useState<Array<{ file: string; type: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number; content: string }>>([]);
  const [commits, setCommits] = useState<Array<{ hash: string; message: string; author: string; date: string | Date }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const pendingMap = useRef<Record<string, string>>({}); // id -> op
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
  const [logCount, setLogCount] = useState<number>(20);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerAnchorRef = useRef<HTMLDivElement | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<{ hash: string; message: string; author: string; date: string | Date; files?: string[] } | null>(null);
  const [selectedFileList, setSelectedFileList] = useState<Array<{ file: string; type: 'added' | 'modified' | 'deleted' | 'renamed' }>>([]);
  const [selectedDiffs, setSelectedDiffs] = useState<Array<{ file: string; type: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number; content: string }>>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});

  const pendingMeta = useRef<Record<string, any>>({});
  const request = (operation: string, options: any = {}, meta?: any) => {
    const id = `git_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    pendingMap.current[id] = operation;
    if (meta) pendingMeta.current[id] = meta;
    setLoading(true);
    sendJson({ type: 'git', id, data: { gitData: { operation, options } } });
  };

  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'git') return;
      const op = pendingMap.current[msg.id];
      if (!op) return; // not ours
      delete pendingMap.current[msg.id];
      const meta = pendingMeta.current[msg.id];
      delete pendingMeta.current[msg.id];
      setLoading(Object.keys(pendingMap.current).length > 0);
      if (msg.data?.ok === false) {
        setError(msg.data?.error || `Git ${op} failed`);
        return;
      }
      const result = msg.data?.gitData?.result;
      switch (op) {
        case 'status':
          if (result) {
            const r = result as GitRepositoryState;
            setRepo(r);
            if (Array.isArray(r.recentCommits)) setCommits(r.recentCommits);
          }
          break;
        case 'diff':
          if (Array.isArray(result)) {
            const list = (result as any[]) as typeof diffFiles;
            setDiffFiles(list);
            const content = list.map((d) => `# ${d.file}\n${d.content || ''}`).join('\n\n');
            setDiffText(content);
          } else {
            setDiffFiles([]);
            setDiffText('');
          }
          break;
        case 'log':
          if (Array.isArray(result)) setCommits(result as any);
          break;
        case 'show':
          // lazy modes:
          if (meta && meta.mode === 'list') {
            if (Array.isArray(result)) setSelectedFileList(result as any);
            setSelectedLoading(false);
            break;
          }
          if (meta && meta.file) {
            const file = meta.file as string;
            setLoadingFiles((m) => ({ ...m, [file]: false }));
            if (result && typeof result === 'object' && result.file) {
              setSelectedDiffs((prev) => {
                const others = prev.filter(d => d.file !== file);
                return [...others, result as any];
              });
            }
            break;
          }
          // fallback: full commit patch
          if (Array.isArray(result)) setSelectedDiffs(result as any);
          setSelectedLoading(false);
          break;
        case 'commit':
        case 'push':
        case 'pull':
          // refresh status after actions
          request('status');
          break;
      }
    });
    // initial load
    request('status');
    // initial diff and log
    request('diff');
    request('log', { count: logCount });
    return unsub;
  }, []);

  // Pull-to-refresh (top of scroll)
  usePullToRefresh(scrollRef, () => {
    if (activeTab === 'status') {
      request('status');
      request('diff');
    } else {
      request('log', { count: logCount });
    }
  }, 60);

  const toItems = (paths: string[], state: GitStatusItem['state']): GitStatusItem[] =>
    (paths || []).map((p) => ({ path: p, state }));

  const statusItems: GitStatusItem[] = [
    ...toItems(repo?.status?.staged || [], 'staged'),
    ...toItems(repo?.status?.unstaged || [], 'unstaged'),
    ...toItems(repo?.status?.untracked || [], 'untracked'),
    ...toItems(repo?.status?.conflicted || [], 'conflicted'),
  ];

  const onCommit = (msg: string) => request('commit', { message: msg });

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border">
      {/* Header & segmented control */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-foreground">Git</h3>
          <div className="text-xs text-muted-foreground">{loading ? 'Working…' : ''}</div>
        </div>
        <div className="inline-flex rounded-lg border border-border p-1 w-full sm:w-auto">
          <button
            className={`flex-1 sm:flex-none rounded-md px-4 py-2 text-sm ${activeTab === 'status' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted active:bg-muted'}`}
            onClick={() => setActiveTab('status')}
          >Status</button>
          <button
            className={`flex-1 sm:flex-none rounded-md px-4 py-2 text-sm ${activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted active:bg-muted'}`}
            onClick={() => setActiveTab('history')}
          >History</button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>
      )}

      {/* Scrollable content */}
      <div ref={scrollRef} className="px-4 pb-20 max-h-[70vh] overflow-auto">
        {/* Repo summary */}
        {repo ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground">Branch</div>
              <div className="text-sm font-medium">{repo.currentBranch}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground">Remote</div>
              <div className="text-sm font-medium">{repo.remoteStatus?.remote || 'origin'}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground">Ahead/Behind</div>
              <div className="text-sm font-medium">{repo.remoteStatus?.ahead || 0} / {repo.remoteStatus?.behind || 0}</div>
            </div>
          </div>
        ) : (
          <div className="mb-4 text-sm text-muted-foreground">No repository detected or not loaded yet.</div>
        )}

        {activeTab === 'status' ? (
          <>
            {/* Status lists */}
            <GitStatusList items={statusItems} className="mb-4" />

            {/* Commit composer */}
            <div ref={composerAnchorRef} id="commit-composer">
              <CommitComposer onCommit={onCommit} disabled={loading} />
            </div>

            {/* Diff (working tree) */}
            {diffFiles && diffFiles.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Changes</div>
                <div className="space-y-2">
                  {diffFiles.map((d, i) => (
                    <DiffFile key={`${d.file}:${i}`} chunk={d} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-2">
            <GitHistoryViewer
              commits={commits}
              loading={loading}
              canLoadMore={logCount < 1000}
              onLoadMore={() => {
                const next = Math.min(logCount + 20, 1000)
                if (next === logCount) return
                setLogCount(next)
                request('log', { count: next })
              }}
              onSelect={(c) => {
                setSelectedCommit(c)
                setSelectedLoading(true)
                setSelectedFileList([])
                setSelectedDiffs([])
                request('show', { commitHash: c.hash, list: true }, { mode: 'list' })
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom sticky actions */}
      <div className="sticky bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="px-4 py-2 grid grid-cols-3 gap-2">
          <button className="h-11 rounded-lg border border-border text-sm active:bg-muted hover:bg-muted" onClick={() => request('pull')} disabled={loading}>Pull</button>
          <button
            className="h-11 rounded-lg bg-primary text-primary-foreground text-sm active:opacity-90 disabled:opacity-50"
            onClick={() => {
              if (activeTab !== 'status') setActiveTab('status')
              requestAnimationFrame(() => {
                composerAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              })
            }}
            disabled={loading}
          >Commit</button>
          <button className="h-11 rounded-lg border border-border text-sm active:bg-muted hover:bg-muted" onClick={() => request('push')} disabled={loading}>Push</button>
        </div>
      </div>

      {/* Commit details sheet */}
      <BottomSheet open={!!selectedCommit} onClose={() => { setSelectedCommit(null); setSelectedFileList([]); setSelectedDiffs([]); setSelectedLoading(false); setLoadingFiles({}); }} ariaLabel="Commit details">
        {selectedCommit && (
          <>
            <BottomSheetHeader>
              <BottomSheetTitle>Commit Details</BottomSheetTitle>
              <button className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => setSelectedCommit(null)}>Close</button>
            </BottomSheetHeader>
            <div className="space-y-2">
              <div className="text-sm font-medium leading-snug">{selectedCommit.message || '(no message)'}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{(selectedCommit.author || '').trim() || 'Unknown'}</span>
                <span>•</span>
                <span>{new Date(selectedCommit.date).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="font-mono bg-muted rounded px-1.5 py-0.5">{selectedCommit.hash.slice(0, 12)}</span>
                <button className="rounded border border-border px-2 py-1" onClick={() => navigator.clipboard?.writeText(selectedCommit.hash)}>Copy</button>
              </div>
              {/* Commit files & lazy diffs */}
              <div className="mt-3 space-y-2">
                {selectedLoading && (
                  <div className="text-xs text-muted-foreground">Loading files…</div>
                )}
                {!selectedLoading && selectedFileList.length === 0 && (
                  <div className="text-xs text-muted-foreground">No changes in this commit.</div>
                )}
                {selectedFileList.length > 0 && (
                  <div className="space-y-2">
                    {selectedFileList.map((f, i) => {
                      const loaded = selectedDiffs.find(d => d.file === f.file)
                      const additions = loaded?.additions || 0;
                      const deletions = loaded?.deletions || 0;
                      const content = loaded?.content || '';
                      const chunk = loaded || { file: f.file, type: f.type, additions, deletions, content }
                      const isLoading = !!loadingFiles[f.file]
                      return (
                        <DiffFile
                          key={`${f.file}:${i}`}
                          chunk={chunk as any}
                          loading={isLoading}
                          onExpand={() => {
                            const alreadyLoaded = !!selectedDiffs.find(d => d.file === f.file)
                            if (alreadyLoaded || isLoading) return
                            setLoadingFiles((m) => ({ ...m, [f.file]: true }))
                            request('show', { commitHash: selectedCommit.hash, file: f.file }, { file: f.file })
                          }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
};

export default GitPage;
