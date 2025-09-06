/**
 * GitService - Handles git operations and repository monitoring
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { GitRepositoryState, GitCommit, GitDiff } from './interfaces';

export class GitService {
    private _gitExtension: vscode.Extension<any> | undefined;
    private _repositories: Map<string, any> = new Map();
    private _disposables: vscode.Disposable[] = [];

    constructor() {
        this.initializeGitExtension();
    }

    /**
     * Initialize VS Code Git extension integration
     */
    private async initializeGitExtension(): Promise<void> {
        try {
            // Check if workspace is available
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                console.log('GitService: No workspace folders found, skipping Git integration');
                return;
            }

            this._gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!this._gitExtension) {
                console.log('GitService: VS Code Git extension not found');
                return;
            }

            if (!this._gitExtension.isActive) {
                console.log('GitService: Activating VS Code Git extension...');
                await this._gitExtension.activate();
                console.log('GitService: VS Code Git extension activated');
            }

            if (this._gitExtension?.exports) {
                const gitApi = this._gitExtension.exports.getAPI(1);
                if (gitApi) {
                    console.log('GitService: Git API available, setting up repository monitoring');

                    // Monitor repository changes
                    this._disposables.push(
                        gitApi.onDidOpenRepository((repo: any) => {
                            this._repositories.set(repo.rootUri.fsPath, repo);
                            console.log(`GitService: Git repository opened: ${repo.rootUri.fsPath}`);
                        })
                    );

                    this._disposables.push(
                        gitApi.onDidCloseRepository((repo: any) => {
                            this._repositories.delete(repo.rootUri.fsPath);
                            console.log(`GitService: Git repository closed: ${repo.rootUri.fsPath}`);
                        })
                    );

                    // Initialize existing repositories
                    gitApi.repositories.forEach((repo: any) => {
                        this._repositories.set(repo.rootUri.fsPath, repo);
                        console.log(`GitService: Existing repository registered: ${repo.rootUri.fsPath}`);
                    });

                    console.log(`GitService: Initialized with ${this._repositories.size} repositories`);
                } else {
                    console.log('GitService: Git API not available from extension');
                }
            } else {
                console.log('GitService: Git extension exports not available');
            }
        } catch (error) {
            console.warn('GitService: Failed to initialize Git extension:', error);
        }
    }

    /**
     * Get current git repository state
     */
    async getRepositoryState(workspacePath?: string): Promise<GitRepositoryState | null> {
        try {
            const repo = await this.getRepository(workspacePath);
            if (!repo) {
                return null;
            }

            const [status, commits, remoteStatus] = await Promise.all([
                this.getRepositoryStatus(repo),
                this.getRecentCommits(repo, 10),
                this.getRemoteStatus(repo)
            ]);

            return {
                currentBranch: repo.state.HEAD?.name || 'unknown',
                status,
                recentCommits: commits,
                remoteStatus,
                repositoryRoot: repo.rootUri.fsPath
            };
        } catch (error) {
            console.error('Failed to get repository state:', error);
            return null;
        }
    }

    /**
     * Get repository status (staged, unstaged, untracked files)
     */
    private async getRepositoryStatus(repo: any): Promise<GitRepositoryState['status']> {
        const status = {
            staged: [] as string[],
            unstaged: [] as string[],
            untracked: [] as string[],
            conflicted: [] as string[]
        };

        if (repo.state.indexChanges) {
            status.staged = repo.state.indexChanges.map((change: any) => change.uri.fsPath);
        }

        if (repo.state.workingTreeChanges) {
            status.unstaged = repo.state.workingTreeChanges.map((change: any) => change.uri.fsPath);
        }

        if (repo.state.untrackedChanges) {
            status.untracked = repo.state.untrackedChanges.map((change: any) => change.uri.fsPath);
        }

        if (repo.state.mergeChanges) {
            status.conflicted = repo.state.mergeChanges.map((change: any) => change.uri.fsPath);
        }

        return status;
    }

    /**
     * Get recent commits
     */
    private async getRecentCommits(repo: any, count: number = 10): Promise<GitCommit[]> {
        try {
            const commits = await repo.log({ maxEntries: count });
            let list: GitCommit[] = commits.map((commit: any) => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.authorName || 'Unknown',
                date: new Date(commit.authorDate || Date.now()),
                files: commit.files || []
            }));
            if (Array.isArray(list) && list.length > 0) return list;
        } catch (error) {
            console.warn('Git API log failed, falling back to CLI:', error);
        }
        // CLI fallback
        try {
            const root = repo.rootUri?.fsPath;
            if (!root) return [];
            const fmt = '%H%x1f%an%x1f%ad%x1f%s';
            const out = await this.runGit(root, ['log', `-n`, String(count), `--date=iso-strict`, `--pretty=${fmt}`]);
            const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
            const result: GitCommit[] = [];
            for (const l of lines) {
                const [hash, author, date, subject] = l.split('\x1f');
                if (!hash) continue;
                result.push({
                    hash: hash.trim(),
                    message: (subject || '').trim(),
                    author: (author || 'Unknown').trim(),
                    date: new Date((date || '').trim() || Date.now()),
                    files: []
                });
            }
            return result;
        } catch (error) {
            console.warn('Failed to get recent commits via CLI:', error);
            return [];
        }
    }

    /**
     * Get remote status (ahead/behind)
     */
    private async getRemoteStatus(repo: any): Promise<GitRepositoryState['remoteStatus']> {
        try {
            const head = repo.state.HEAD;
            if (!head || !head.upstream) {
                return { ahead: 0, behind: 0, remote: 'none' };
            }

            return {
                ahead: head.ahead || 0,
                behind: head.behind || 0,
                remote: head.upstream.remote || 'origin'
            };
        } catch (error) {
            console.warn('Failed to get remote status:', error);
            return { ahead: 0, behind: 0, remote: 'unknown' };
        }
    }

    /**
     * Get current diff
     */
    async getCurrentDiff(workspacePath?: string): Promise<GitDiff[]> {
        try {
            const repo = await this.getRepository(workspacePath);
            if (!repo) {
                return [];
            }

            const diffs: GitDiff[] = [];

            // Get staged changes diff
            if (repo.state.indexChanges) {
                for (const change of repo.state.indexChanges) {
                    try {
                        const diff = await repo.diffIndexWithHEAD(change.uri.fsPath);
                        diffs.push({
                            file: change.uri.fsPath,
                            type: this.mapChangeType(change.status),
                            additions: this.countLines(diff, '+'),
                            deletions: this.countLines(diff, '-'),
                            content: diff || ''
                        });
                    } catch (error) {
                        console.warn(`Failed to get diff for ${change.uri.fsPath}:`, error);
                    }
                }
            }

            // Get working tree changes diff
            if (repo.state.workingTreeChanges) {
                for (const change of repo.state.workingTreeChanges) {
                    try {
                        const diff = await repo.diffWithHEAD(change.uri.fsPath);
                        diffs.push({
                            file: change.uri.fsPath,
                            type: this.mapChangeType(change.status),
                            additions: this.countLines(diff, '+'),
                            deletions: this.countLines(diff, '-'),
                            content: diff || ''
                        });
                    } catch (error) {
                        console.warn(`Failed to get diff for ${change.uri.fsPath}:`, error);
                    }
                }
            }

            return diffs;
        } catch (error) {
            console.error('Failed to get current diff:', error);
            return [];
        }
    }

    /**
     * Get per-file diff for a specific commit (like `git show`)
     */
    async getCommitDiff(workspacePath: string | undefined, commitHash: string): Promise<GitDiff[]> {
        try {
            const repo = await this.getRepository(workspacePath);
            if (!repo) return [];

            // Try using Git API diffBetween vs first parent
            let unified = '';
            try {
                const base = `${commitHash}^`;
                unified = await repo.diffBetween(base, commitHash);
            } catch (e) {
                // ignore and fallback below
            }
            if (!unified) {
                // Fallback to CLI. Use diff against first parent to avoid combined diffs
                const root = repo.rootUri.fsPath;
                try {
                    unified = await this.runGit(root, ['diff', '--unified=3', `${commitHash}^`, commitHash]);
                } catch {
                    // As a final fallback, try show with -m to split parents
                    unified = await this.runGit(root, ['show', '-m', '--first-parent', '--format=', '--unified=3', commitHash]);
                }
            }

            return this.parseUnifiedDiff(unified || '');
        } catch (error) {
            console.error('Failed to get commit diff:', error);
            return [];
        }
    }

    /**
     * List files changed in a commit (status only, no patches)
     */
    async getCommitFileList(workspacePath: string | undefined, commitHash: string): Promise<Array<{ file: string; type: GitDiff['type'] }>> {
        try {
            const repo = await this.getRepository(workspacePath);
            if (!repo) return [];
            const root = repo.rootUri.fsPath;
            // Use diff-tree to get name-status pairs
            const out = await this.runGit(root, ['diff-tree', '--no-commit-id', '--name-status', '-r', commitHash]);
            const files: Array<{ file: string; type: GitDiff['type'] }> = [];
            const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
            for (const l of lines) {
                const parts = l.split('\t');
                if (parts.length >= 2) {
                    const status = parts[0];
                    if (status && status.startsWith('R')) {
                        // rename: R100	old	new
                        const to = parts[2] || parts[1];
                        if (to) {
                            files.push({ file: to, type: 'renamed' });
                        }
                    } else {
                        const p = parts[1];
                        if (p) {
                            let type: GitDiff['type'] = 'modified';
                            if (status === 'A') type = 'added';
                            else if (status === 'D') type = 'deleted';
                            else if (status === 'M') type = 'modified';
                            files.push({ file: p, type });
                        }
                    }
                }
            }
            return files;
        } catch (error) {
            console.error('Failed to list commit files:', error);
            return [];
        }
    }

    /**
     * Get patch for a single file in a commit
     */
    async getCommitFileDiff(workspacePath: string | undefined, commitHash: string, filePath: string): Promise<GitDiff | null> {
        try {
            const repo = await this.getRepository(workspacePath);
            if (!repo) return null;
            let unified = '';
            try {
                // Some Git API versions may not expose a single-file show; use CLI
                const root = repo.rootUri.fsPath;
                unified = await this.runGit(root, ['show', '--format=', '--unified=3', commitHash, '--', filePath]);
            } catch (e) {
                const root = repo.rootUri.fsPath;
                unified = await this.runGit(root, ['show', '--format=', '--unified=3', commitHash, '--', filePath]);
            }
            const diffs = this.parseUnifiedDiff(unified);
            const match = diffs.find(d => d.file.endsWith(filePath) || d.file === filePath) || null;
            return match;
        } catch (error) {
            console.error('Failed to get commit file diff:', error);
            return null;
        }
    }

    /**
     * Get commit metadata (hash, author, date, message)
     */
    async getCommitMeta(workspacePath: string | undefined, commitHash: string): Promise<{ hash: string; author: string; date: string; message: string } | null> {
        try {
            const repo = await this.getRepository(workspacePath);
            if (!repo) return null;
            const root = repo.rootUri.fsPath;
            // %H hash, %an author name, %ad author date (human), %B body
            const out = await this.runGit(root, ['show', '-s', '--format=%H%n%an%n%ad%n%B', commitHash]);
            const [hash, author, date, ...rest] = out.split('\n');
            const message = (rest || []).join('\n').trim();
            return { hash: (hash || '').trim(), author: (author || '').trim(), date: (date || '').trim(), message };
        } catch (error) {
            console.error('Failed to get commit meta:', error);
            return null;
        }
    }

    private runGit(cwd: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = execFile('git', args, { cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) return reject(err);
                resolve(stdout.toString());
            });
        });
    }

    private parseUnifiedDiff(unified: string): GitDiff[] {
        if (!unified) return [];
        const diffs: GitDiff[] = [];
        const lines = unified.split('\n');
        let current: { file: string; content: string[]; type: GitDiff['type']; additions: number; deletions: number } | null = null;
        const startFile = (filePath: string) => {
            if (current) {
                const curr = current as any;
                diffs.push({ file: curr.file, type: curr.type, additions: curr.additions, deletions: curr.deletions, content: curr.content.join('\n') });
            }
            current = { file: filePath, content: [], type: 'modified', additions: 0, deletions: 0 };
        };

        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            if (!l) continue; // Skip empty lines
            
            // Support both regular and combined diff headers
            let m = /^diff --git a\/(.*?) b\/(.*)$/.exec(l);
            if (!m) {
                const mcc = /^diff --cc (.*)$/.exec(l);
                if (mcc && mcc[1]) {
                    startFile(mcc[1]);
                    continue;
                }
            } else {
                if (m[1] && m[2]) {
                    startFile(m[2] || m[1]);
                    continue;
                }
            }
            
            if (!current) continue;
            
            // Type assertion to help TypeScript understand current is not null
            const curr = current as { file: string; content: string[]; type: GitDiff['type']; additions: number; deletions: number };
            
            if (/^new file mode /.test(l)) {
                curr.type = 'added';
            } else if (/^deleted file mode /.test(l)) {
                curr.type = 'deleted';
            } else if (/^rename from /.test(l) || /^rename to /.test(l)) {
                curr.type = 'renamed';
            }

            if (/^\+\+\+ /.test(l) || /^--- /.test(l) || /^index /.test(l)) {
                curr.content.push(l);
                continue;
            }
            
            if (l.startsWith('+++ /dev/null')) {
                curr.type = 'deleted';
            } else if (l.startsWith('--- /dev/null')) {
                curr.type = 'added';
            }

            if (l.startsWith('+') && !l.startsWith('+++')) {
                curr.additions++;
            } else if (l.startsWith('-') && !l.startsWith('---')) {
                curr.deletions++;
            }
            
            curr.content.push(l);
        }
        if (current) {
            const curr = current as { file: string; content: string[]; type: GitDiff['type']; additions: number; deletions: number };
            diffs.push({ 
                file: curr.file, 
                type: curr.type, 
                additions: curr.additions, 
                deletions: curr.deletions, 
                content: curr.content.join('\n') 
            });
        }
        return diffs;
    }

    /**
     * Execute git command
     */
    async executeGitCommand(operation: string, options: any = {}): Promise<any> {
        try {
            const repo = await this.getRepository(options.workspacePath);
            if (!repo) {
                throw new Error('No git repository found');
            }

            switch (operation) {
                case 'status':
                    return await this.getRepositoryState(options.workspacePath);

                case 'log':
                    return await this.getRecentCommits(repo, options.count || 10);

                case 'diff':
                    return await this.getCurrentDiff(options.workspacePath);

                case 'show':
                    if (!options.commitHash) throw new Error('Missing commitHash');
                    if (options.list) {
                        return await this.getCommitFileList(options.workspacePath, options.commitHash);
                    }
                    if (options.file) {
                        return await this.getCommitFileDiff(options.workspacePath, options.commitHash, options.file);
                    }
                    if (options.meta) {
                        return await this.getCommitMeta(options.workspacePath, options.commitHash);
                    }
                    return await this.getCommitDiff(options.workspacePath, options.commitHash);

                case 'branch':
                    return await this.getBranches(repo);

                case 'commit':
                    return await this.commit(repo, options.message, options.files);

                case 'push':
                    return await this.push(repo);

                case 'pull':
                    return await this.pull(repo);

                default:
                    throw new Error(`Unsupported git operation: ${operation}`);
            }
        } catch (error) {
            console.error(`Git operation ${operation} failed:`, error);
            throw error;
        }
    }

    /**
     * Get all branches
     */
    private async getBranches(repo: any): Promise<string[]> {
        try {
            const refs = await repo.getRefs();
            return refs
                .filter((ref: any) => ref.type === 'head')
                .map((ref: any) => ref.name);
        } catch (error) {
            console.warn('Failed to get branches:', error);
            return [];
        }
    }

    /**
     * Commit changes
     */
    private async commit(repo: any, message: string, files?: string[]): Promise<boolean> {
        try {
            if (files && files.length > 0) {
                // Stage specific files
                for (const file of files) {
                    await repo.add([file]);
                }
            }

            await repo.commit(message);
            return true;
        } catch (error) {
            console.error('Failed to commit:', error);
            throw error;
        }
    }

    /**
     * Push changes
     */
    private async push(repo: any): Promise<boolean> {
        try {
            await repo.push();
            return true;
        } catch (error) {
            console.error('Failed to push:', error);
            throw error;
        }
    }

    /**
     * Pull changes
     */
    private async pull(repo: any): Promise<boolean> {
        try {
            await repo.pull();
            return true;
        } catch (error) {
            console.error('Failed to pull:', error);
            throw error;
        }
    }

    /**
     * Get repository for workspace path
     */
    private async getRepository(workspacePath?: string): Promise<any> {
        if (!this._gitExtension?.exports) {
            console.log('GitService: Git extension not available');
            return null;
        }

        const gitApi = this._gitExtension.exports.getAPI(1);
        if (!gitApi) {
            console.log('GitService: Git API not available');
            return null;
        }

        if (workspacePath) {
            const repo = this._repositories.get(workspacePath);
            if (repo) {
                return repo;
            }
            console.log(`GitService: No repository found for workspace path: ${workspacePath}`);
            return null;
        }

        // Get repository for current workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const repo = this._repositories.get(workspaceRoot) || gitApi.repositories[0] || null;

            if (!repo) {
                console.log(`GitService: No Git repository found in workspace: ${workspaceRoot}`);
            }

            return repo;
        }

        console.log('GitService: No workspace folders available');
        return gitApi.repositories[0] || null;
    }

    /**
     * Map VS Code git change status to our type
     */
    private mapChangeType(status: number): 'added' | 'modified' | 'deleted' | 'renamed' {
        // VS Code git status constants
        switch (status) {
            case 1: // INDEX_ADDED
            case 7: // UNTRACKED
                return 'added';
            case 2: // INDEX_MODIFIED
            case 5: // MODIFIED
                return 'modified';
            case 3: // INDEX_DELETED
            case 6: // DELETED
                return 'deleted';
            case 4: // INDEX_RENAMED
                return 'renamed';
            default:
                return 'modified';
        }
    }

    /**
     * Count lines in diff starting with specific character
     */
    private countLines(diff: string, prefix: string): number {
        if (!diff) return 0;
        return diff.split('\n').filter(line => line.startsWith(prefix)).length;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._repositories.clear();
    }
}
