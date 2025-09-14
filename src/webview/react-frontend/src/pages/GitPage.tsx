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
  const { sendJson, addMessageListener, isConnected } = useWebSocket();
  const [repo, setRepo] = useState<GitRepositoryState | null>(null);
  const [diffFiles, setDiffFiles] = useState<Array<{ file: string; type: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number; content: string }>>([]);
  const [commits, setCommits] = useState<Array<{ hash: string; message: string; author: string; date: string | Date }>>([]);
  const [selectedCommit, setSelectedCommit] = useState<{ hash: string; message: string; author: string; date: string | Date } | null>(null);
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<Array<{ file: string; type: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number; content: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [commitDiffLoading, setCommitDiffLoading] = useState<boolean>(false);
  const pendingMap = useRef<Record<string, string | { operation: string; timeoutId: NodeJS.Timeout }>>({});
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
  const [logCount, setLogCount] = useState<number>(20);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerAnchorRef = useRef<HTMLDivElement | null>(null);

  const request = (operation: string, options: any = {}, retryCount = 0) => {
    const id = `git_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Set appropriate loading states
    if (operation === 'log') {
      setHistoryLoading(true);
    } else if (operation === 'show') {
      setCommitDiffLoading(true);
    } else {
      setLoading(true);
    }

    // Check if WebSocket is connected
    if (!isConnected) {
      // Clear loading states immediately
      if (operation === 'log') {
        setHistoryLoading(false);
      } else if (operation === 'show') {
        setCommitDiffLoading(false);
      } else {
        setLoading(false);
      }

      // If this is not a retry, queue the request for when connection is ready
      if (retryCount === 0) {
        setError('Waiting for connection...');
        // Retry when connection is established
        setTimeout(() => {
          if (isConnected) {
            request(operation, options, retryCount + 1);
          }
        }, 1000);
        return;
      } else {
        setError('Connection lost. Please refresh the page.');
        return;
      }
    }

    // Check if send was successful
    const sent = sendJson({ type: 'git', id, data: { gitData: { operation, options } } });

    if (sent) {
      // Add timeout mechanism
      const timeoutId = setTimeout(() => {
        if (pendingMap.current[id]) {
          delete pendingMap.current[id];

          // Clear appropriate loading states
          if (operation === 'log') {
            setHistoryLoading(false);
          } else if (operation === 'show') {
            setCommitDiffLoading(false);
          } else {
            setLoading(false);
          }

          // Retry once on timeout if this is the first attempt
          if (retryCount === 0) {
            console.log(`GitPage: Request timeout for ${operation}, retrying...`);
            setTimeout(() => request(operation, options, retryCount + 1), 1000);
          } else {
            setError(`Request timeout: ${operation}. Please try again.`);
          }
        }
      }, 10000); // 10 second timeout

      // Store timeout ID and request metadata for cleanup and response handling
      pendingMap.current[id] = { 
        operation, 
        timeoutId,
        ...(operation === 'log' ? { requestedCount: options?.count ?? logCount } : {})
      } as any;
    } else {
      // Clear loading states if send failed
      if (operation === 'log') {
        setHistoryLoading(false);
      } else if (operation === 'show') {
        setCommitDiffLoading(false);
      } else {
        setLoading(false);
      }
      setError('Failed to send request. Please try again.');
    }
  };

  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'git') return;
      const pendingData = pendingMap.current[msg.id];
      if (!pendingData) return; // not ours

      // Extract operation from pending data
      const op = typeof pendingData === 'object' ? (pendingData as any).operation : pendingData;

      // Clear timeout if exists
      if (pendingData && typeof pendingData === 'object' && pendingData.timeoutId) {
        clearTimeout(pendingData.timeoutId);
      }

      delete pendingMap.current[msg.id];

      // Clear appropriate loading states
      if (op === 'log') {
        setHistoryLoading(false);
      } else if (op === 'show') {
        setCommitDiffLoading(false);
      } else {
        setLoading(false);
      }

      // Clear any error state on successful response
      setError(null);

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
        case 'add':
        case 'add-all':
        case 'add-untracked':
        case 'unstage':
          // After staging/unstaging, refresh status and diff
          request('status');
          request('diff');
          break;
        case 'log':
          if (Array.isArray(result)) {
            setCommits(result as any);
            // Determine if more commits are available based on requested count
            const requestedCount = typeof pendingData === 'object' ? (pendingData as any).requestedCount : undefined;
            if (typeof requestedCount === 'number') {
              setCanLoadMore((result as any[]).length >= requestedCount);
            } else {
              // Fallback heuristic
              setCanLoadMore((result as any[]).length >= logCount);
            }
          }
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

    return unsub;
  }, []);

  // Separate effect for initial load that depends on connection state
  useEffect(() => {
    if (isConnected) {
      console.log('GitPage: Connection established, loading initial data...');
      request('status');
      request('diff');
      request('log', { count: logCount });
    }
  }, [isConnected]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clear all loading states on unmount
      setLoading(false);
      setHistoryLoading(false);
      setCommitDiffLoading(false);

      // Clear all pending requests and timeouts
      Object.keys(pendingMap.current).forEach(id => {
        const pendingData = pendingMap.current[id];
        if (pendingData && typeof pendingData === 'object' && pendingData.timeoutId) {
          clearTimeout(pendingData.timeoutId);
        }
        delete pendingMap.current[id];
      });
    };
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
      setCanLoadMore(true);
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

  // Staging actions
  const stageFile = (path: string) => request('add', { files: [path] });
  const unstageFile = (path: string) => request('unstage', { files: [path] });
  const stageAll = () => request('add-all');
  const stageUntracked = () => request('add-untracked');
  const unstageAll = () => request('unstage');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Git</h3>

        {/* Enhanced Status Indicator */}
        <div className="flex items-center gap-3">
          {(loading || historyLoading || commitDiffLoading) && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800 neo:rounded-none neo:border-[2px] neo:shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[3px_3px_0_0_rgba(255,255,255,0.9)]">
              {/* Animated spinner */}
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                {loading && 'Working'}
                {historyLoading && 'Loading history'}
                {commitDiffLoading && 'Loading diff'}
              </span>
            </div>
          )}


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
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => {
                setError(null);
                if (isConnected) {
                  request('status');
                  request('diff');
                  if (activeTab === 'history') {
                    request('log', { count: logCount });
                  }
                }
              }}
              className="ml-3 rounded-md border border-red-600 bg-white px-2 py-1 text-red-600 hover:bg-red-50 neo:rounded-none neo:border-[2px] neo:shadow-[2px_2px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[2px_2px_0_0_rgba(255,255,255,0.9)]"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div ref={scrollRef} className="pb-20 max-h-[70vh] overflow-auto space-y-6 px-2 sm:px-3">
        {/* Repo summary */}
        {repo ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
              <div className="text-xs text-muted-foreground mb-1">Branch</div>
              <div className="text-sm font-medium flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {repo.currentBranch}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
              <div className="text-xs text-muted-foreground mb-1">Remote</div>
              <div className="text-sm font-medium">{repo.remoteStatus?.remote || 'origin'}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
              <div className="text-xs text-muted-foreground mb-1">Ahead/Behind</div>
              <div className="text-sm font-medium flex items-center gap-2">
                {repo.remoteStatus?.ahead > 0 && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs dark:bg-green-900 dark:text-green-300 neo:rounded-none">
                    ↑{repo.remoteStatus.ahead}
                  </span>
                )}
                {repo.remoteStatus?.behind > 0 && (
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs dark:bg-orange-900 dark:text-orange-300 neo:rounded-none">
                    ↓{repo.remoteStatus.behind}
                  </span>
                )}
                {(!repo.remoteStatus?.ahead && !repo.remoteStatus?.behind) && (
                  <span className="text-muted-foreground">Up to date</span>
                )}
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-muted animate-pulse neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
                <div className="h-3 bg-muted-foreground/20 rounded mb-2 neo:rounded-none"></div>
                <div className="h-4 bg-muted-foreground/30 rounded w-3/4 neo:rounded-none"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center neo:rounded-none neo:border-[3px]">
            <div className="text-muted-foreground">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-sm font-medium mb-1">No Git repository detected</div>
              <div className="text-xs">Initialize a repository or open a folder with an existing Git repo</div>
            </div>
          </div>
        )}

        {activeTab === 'status' ? (
          <>
            {/* Status lists */}
            {statusItems.length > 0 && (
              <div className="bg-card rounded-lg border border-border neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]">
                {/* Bulk actions */}
                <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border/60 neo:border-b-2">
                  <button
                    className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50 neo:rounded-none neo:border-2"
                    onClick={stageAll}
                    disabled={loading || historyLoading || commitDiffLoading}
                    title="Stage all changes"
                  >Stage all</button>
                  <button
                    className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50 neo:rounded-none neo:border-2"
                    onClick={stageUntracked}
                    disabled={loading || historyLoading || commitDiffLoading}
                    title="Stage all untracked files"
                  >Stage untracked</button>
                  <button
                    className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50 neo:rounded-none neo:border-2"
                    onClick={unstageAll}
                    disabled={loading || historyLoading || commitDiffLoading}
                    title="Unstage all staged changes"
                  >Unstage all</button>
                </div>
                <GitStatusList
                  items={statusItems}
                  disabled={loading || historyLoading || commitDiffLoading}
                  onStageFile={stageFile}
                  onUnstageFile={unstageFile}
                />
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
          <>
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
                canLoadMore={canLoadMore}
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
          </>
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
