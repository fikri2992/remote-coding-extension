import React, { useEffect, useRef, useState } from 'react';
import { GitStatusList, GitStatusItem } from '../components/git/GitStatusList';
import { CommitComposer } from '../components/git/CommitComposer';
import { useWebSocket } from '../components/WebSocketProvider';

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
  const [diff, setDiff] = useState<string>('');
  const [commits, setCommits] = useState<Array<{ hash: string; message: string; author: string; date: string | Date }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const pendingMap = useRef<Record<string, string>>({}); // id -> op

  const request = (operation: string, options: any = {}) => {
    const id = `git_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    pendingMap.current[id] = operation;
    setLoading(true);
    sendJson({ type: 'git', id, data: { gitData: { operation, options } } });
  };

  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'git') return;
      const op = pendingMap.current[msg.id];
      if (!op) return; // not ours
      delete pendingMap.current[msg.id];
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
            const content = (result as any[]).map((d) => `# ${d.file}\n${d.content || ''}`).join('\n\n');
            setDiff(content);
          } else {
            setDiff('');
          }
          break;
        case 'log':
          if (Array.isArray(result)) setCommits(result as any);
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
    return unsub;
  }, []);

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
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-foreground">Git Operations</h3>
        <div className="flex items-center gap-2 flex-wrap overflow-x-auto">
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" onClick={() => request('status')} disabled={loading}>Refresh</button>
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" onClick={() => request('pull')} disabled={loading}>Pull</button>
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" onClick={() => request('push')} disabled={loading}>Push</button>
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" onClick={() => request('diff')} disabled={loading}>Show Diff</button>
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" onClick={() => request('log', { count: 20 })} disabled={loading}>Show Log</button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>
      )}

      {/* Repo summary cards */}
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

      {/* Status lists */}
      <GitStatusList items={statusItems} className="mb-4" />

      {/* Commit composer */}
      <CommitComposer onCommit={onCommit} disabled={loading} />

      {/* Recent commits */}
      {commits && commits.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Recent Commits</div>
          <div className="rounded-md border border-border bg-background divide-y divide-border">
            {commits.map((c, i) => (
              <div key={(c as any).hash || i} className="px-3 py-2 text-sm">
                <div className="font-medium text-foreground truncate">{c.message}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>{(c.author || '').trim() || 'Unknown'}</span>
                  <span>•</span>
                  <span>{new Date(c.date).toLocaleString()}</span>
                  <span>•</span>
                  <span className="font-mono">{(c as any).hash?.slice(0, 7)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diff view */}
      {diff && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Current Diff</div>
          <pre className="rounded-md border border-border bg-background p-3 text-xs overflow-auto whitespace-pre-wrap max-h-[50vh]">{diff}</pre>
        </div>
      )}
    </div>
  );
};

export default GitPage;
