import React, { useEffect, useRef, useState } from 'react';
import { GitStatusList, GitStatusItem } from '../components/git/GitStatusList';
import { CommitComposer } from '../components/git/CommitComposer';
import { useWebSocket } from '../components/WebSocketProvider';
import { GitHistoryViewer } from '../components/git/GitHistoryViewer';
import { DiffFile } from '../components/git/DiffFile';
import { CommitDiff } from '../components/git/CommitDiff';
import { usePullToRefresh } from '../lib/hooks/usePullToRefresh';

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
  const [diffFiles, setDiffFiles] = useState<Array<{ file: string; type: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number; content: string }>>([]);
  const [commits, setCommits] = useState<Array<{ hash: string; message: string; author: string; date: string | Date }>>([]);
  const [selectedCommit, setSelectedCommit] = useState<{ hash: string; message: string; author: string; date: string | Date } | null>(null);
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<Array<{ file: string; type: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number; content: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [commitDiffLoading, setCommitDiffLoading] = useState<boolean>(false);
  const pendingMap = useRef<Record<string, string>>({}); 
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
  const [logCount, setLogCount] = useState<number>(20);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerAnchorRef = useRef<HTMLDivElement | null>(null);

  const request = (operation: string, options: any = {}) => {
    const id = `git_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    pendingMap.current[id] = operation;
    
    // Set appropriate loading states
    if (operation === 'log') {
      setHistoryLoading(true);
    } else if (operation === 'show') {
      setCommitDiffLoading(true);
    } else {
      setLoading(true);
    }
    
    sendJson({ type: 'git', id, data: { gitData: { operation, options } } });
  };

  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'git') return;
      const op = pendingMap.current[msg.id];
      if (!op) return; // not ours
      delete pendingMap.current[msg.id];
      
      // Clear appropriate loading states
      if (op === 'log') {
        setHistoryLoading(false);
      } else if (op === 'show') {
        setCommitDiffLoading(false);
      } else {
        setLoading(false);
      }
      
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
          } else {
            setDiffFiles([]);
          }
          break;
        case 'log':
          if (Array.isArray(result)) setCommits(result as any);
          break;
        case 'show': {
          if (Array.isArray(result)) {
            if (result.length > 0 && typeof result[0]?.content !== 'undefined') {
              // Full diffs array with content
              setSelectedCommitFiles(result as any);
            } else if (result.length > 0 && typeof result[0]?.file === 'string' && typeof result[0]?.type === 'string') {
              // File list (no patches yet) - immediately fetch all file contents
              const files = (result as any[]).map((f) => ({ 
                file: f.file, 
                type: f.type, 
                additions: f.additions || 0, 
                deletions: f.deletions || 0, 
                content: '' 
              }));
              setSelectedCommitFiles(files as any);
              
              // Prefetch all file contents for better UX
              if (selectedCommit) {
                files.forEach((f) => {
                  request('show', { commitHash: selectedCommit.hash, file: f.file });
                });
              }
            } else {
              setSelectedCommitFiles([]);
            }
          } else if (result && typeof result === 'object') {
            // Single file patch - update the specific file
            if ((result as any).content !== undefined) {
              setSelectedCommitFiles((prev) => {
                const arr = Array.isArray(prev) ? [...prev] : [];
                const idx = arr.findIndex((x) => x.file === (result as any).file);
                if (idx >= 0) {
                  arr[idx] = { ...arr[idx], ...(result as any) };
                } else {
                  arr.push(result as any);
                }
                return arr;
              });
            }
          }
          break;
        }
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

  // When switching to History and we have no commits, fetch them
  useEffect(() => {
    if (activeTab === 'history' && commits.length === 0 && !historyLoading) {
      request('log', { count: logCount });
    }
  }, [activeTab, commits.length, historyLoading, logCount]);

  // Pull-to-refresh (top of scroll)
  usePullToRefresh(scrollRef, () => {
    if (activeTab === 'status') {
      request('status');
      request('diff');
    } else {
      setCommits([]); // Clear existing commits to force fresh load
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Git</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const id = `debug_${Date.now()}`;
              const unsub = addMessageListener((msg) => {
                if (msg?.type === 'git' && msg.id === id) {
                  console.log('Debug result:', msg);
                  unsub();
                }
              });
              sendJson({ type: 'git', id, data: { gitData: { operation: 'debug', options: { debugOperation: 'simple-log' } } } });
            }}
            className="px-2 py-1 text-xs bg-red-500 text-white rounded"
          >
            Debug
          </button>
          <div className="text-xs text-muted-foreground">
            {loading && 'Working…'}
            {historyLoading && 'Loading history…'}
            {commitDiffLoading && 'Loading diff…'}
          </div>
        </div>
      </div>

      {/* Segmented control */}
      <div className="inline-flex rounded-lg border border-border p-1 w-full sm:w-auto neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
        <button
          className={`flex-1 sm:flex-none rounded-md px-4 py-2 text-sm neo:rounded-none ${activeTab === 'status' ? 'bg-primary text-primary-foreground shadow-sm neo:bg-primary neo:text-primary-foreground' : 'hover:bg-muted active:bg-muted neo:hover:bg-accent neo:hover:text-accent-foreground'}`}
          onClick={() => setActiveTab('status')}
        >Status</button>
        <button
          className={`flex-1 sm:flex-none rounded-md px-4 py-2 text-sm neo:rounded-none ${activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-sm neo:bg-primary neo:text-primary-foreground' : 'hover:bg-muted active:bg-muted neo:hover:bg-accent neo:hover:text-accent-foreground'}`}
          onClick={() => setActiveTab('history')}
        >History</button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">{error}</div>
      )}

      {/* Content area */}
      <div ref={scrollRef} className="pb-20 max-h-[70vh] overflow-auto space-y-6 px-2 sm:px-3">
        {/* Repo summary */}
        {repo ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
              <div className="text-xs text-muted-foreground mb-1">Branch</div>
              <div className="text-sm font-medium">{repo.currentBranch}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
              <div className="text-xs text-muted-foreground mb-1">Remote</div>
              <div className="text-sm font-medium">{repo.remoteStatus?.remote || 'origin'}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
              <div className="text-xs text-muted-foreground mb-1">Ahead/Behind</div>
              <div className="text-sm font-medium">{repo.remoteStatus?.ahead || 0} / {repo.remoteStatus?.behind || 0}</div>
            </div>
          </div>
        ) : (
          (commits.length === 0 && !historyLoading) ? (
            <div className="text-sm text-muted-foreground">No repository detected or not loaded yet.</div>
          ) : null
        )}

        {activeTab === 'status' ? (
          <>
            {/* Status lists */}
            {statusItems.length > 0 && (
              <div className="bg-card rounded-lg border border-border neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
                <GitStatusList items={statusItems} />
              </div>
            )}

            {/* Commit composer */}
            <div ref={composerAnchorRef} id="commit-composer" className="bg-card rounded-lg border border-border p-4 neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
              <CommitComposer onCommit={onCommit} disabled={loading} />
            </div>

            {/* Diff (working tree) */}
            {diffFiles && diffFiles.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-4 neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
                <div className="text-sm font-medium mb-4">Changes</div>
                <div className="space-y-3">
                  {diffFiles.map((d, i) => (
                    <DiffFile key={`${d.file}:${i}`} chunk={d} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-card rounded-lg border border-border neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
            {selectedCommit ? (
              <CommitDiff
                commit={selectedCommit}
                files={selectedCommitFiles}
                loading={commitDiffLoading}
                onBack={() => {
                  setSelectedCommit(null)
                  setSelectedCommitFiles([])
                }}
                onExpandFile={(file) => {
                  if (!selectedCommit) return;
                  const existing = selectedCommitFiles.find((f) => f.file === file);
                  if (existing && existing.content && existing.content.trim()) return; // already loaded
                  request('show', { commitHash: selectedCommit.hash, file })
                }}
              />
            ) : (
              <GitHistoryViewer
                commits={commits}
                loading={historyLoading}
                canLoadMore={logCount < 1000}
                onLoadMore={() => {
                  const next = Math.min(logCount + 20, 1000)
                  if (next === logCount) return
                  setLogCount(next)
                  request('log', { count: next })
                }}
                onSelect={(c) => {
                  setSelectedCommit(c)
                  setSelectedCommitFiles([])
                  // Fetch the full commit diff immediately
                  request('show', { commitHash: c.hash })
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom sticky actions - only show on status tab */}
      {activeTab === 'status' && (
        <div className="sticky bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 neo:border-t-[3px]">
          <div className="p-4 grid grid-cols-3 gap-3">
            <button className="h-12 rounded-lg border border-border text-sm active:bg-muted hover:bg-muted neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]" onClick={() => request('pull')} disabled={loading || historyLoading || commitDiffLoading}>Pull</button>
            <button
              className="h-12 rounded-lg bg-primary text-primary-foreground text-sm active:opacity-90 disabled:opacity-50 neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]"
              onClick={() => {
                if (activeTab !== 'status') setActiveTab('status')
                requestAnimationFrame(() => {
                  composerAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                })
              }}
              disabled={loading || historyLoading || commitDiffLoading}
            >Commit</button>
            <button className="h-12 rounded-lg border border-border text-sm active:bg-muted hover:bg-muted neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]" onClick={() => request('push')} disabled={loading || historyLoading || commitDiffLoading}>Push</button>
          </div>
        </div>
      )}

      {/* Commit details are rendered in /git/commit/$hash route */}
    </div>
  );
};

export default GitPage;





