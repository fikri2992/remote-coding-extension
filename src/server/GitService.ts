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
        this.testGitAvailability();
    }

    /**
     * Test if git is available in the system
     */
    private async testGitAvailability(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const testPath = (workspaceFolders[0] as vscode.WorkspaceFolder).uri.fsPath;

                console.log(`GitService: Testing git availability in ${testPath}`);

                // Test 1: Git version
                await this.runGit(testPath, ['--version']);
                console.log('GitService: Git CLI is available');

                // Test 2: Check if it's a git repo
                await this.runGit(testPath, ['rev-parse', '--git-dir']);
                console.log('GitService: Directory is a git repository');

                // Test 3: Simple status check
                await this.runGit(testPath, ['status', '--porcelain']);
                console.log('GitService: Git status command works');

            }
        } catch (error) {
            console.warn('GitService: Git CLI test failed:', error);
        }
    }

    /**
     * Debug method to test specific git commands
     */
    async debugGitCommand(operation: string, options: any = {}): Promise<any> {
        console.log(`GitService: DEBUG - Testing ${operation}`);

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace available for git debug');
        }

        const testPath = (workspaceFolders[0] as vscode.WorkspaceFolder).uri.fsPath;

        switch (operation) {
            case 'simple-log':
                return await this.runGit(testPath, ['log', '--oneline', '-n', '5']);
            case 'log-with-format':
                return await this.runGit(testPath, ['log', '--max-count=5', '--pretty=format:%H|%an|%ad|%s', '--date=iso-strict']);
            case 'status':
                return await this.runGit(testPath, ['status', '--porcelain']);
            case 'branch':
                return await this.runGit(testPath, ['branch', '--show-current']);
            default:
                throw new Error(`Unknown debug operation: ${operation}`);
        }
    }

    /**
     * Initialize VS Code Git extension integration
     */
    private async initializeGitExtension(): Promise<void> {
        try {
            console.log('GitService: Initializing Git extension integration...');

            // Check if workspace is available
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                console.log('GitService: No workspace folders found, will work with CLI only');
                return;
            }

            this._gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!this._gitExtension) {
                console.log('GitService: VS Code Git extension not found, using CLI only');
                return;
            }

            if (!this._gitExtension.isActive) {
                console.log('GitService: Activating VS Code Git extension...');
                try {
                    await Promise.race([
                        this._gitExtension.activate(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Git extension activation timeout')), 10000))
                    ]);
                    console.log('GitService: VS Code Git extension activated');
                } catch (error) {
                    console.warn('GitService: Failed to activate Git extension:', error);
                    return;
                }
            }

            if (this._gitExtension?.exports) {
                try {
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
                        if (gitApi.repositories && Array.isArray(gitApi.repositories)) {
                            gitApi.repositories.forEach((repo: any) => {
                                if (repo && repo.rootUri && repo.rootUri.fsPath) {
                                    this._repositories.set(repo.rootUri.fsPath, repo);
                                    console.log(`GitService: Existing repository registered: ${repo.rootUri.fsPath}`);
                                }
                            });
                        }

                        console.log(`GitService: Initialized with ${this._repositories.size} repositories`);
                    } else {
                        console.log('GitService: Git API not available from extension');
                    }
                } catch (error) {
                    console.warn('GitService: Error setting up Git API:', error);
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

            // Handle empty repository case
            const currentBranch = repo.state?.HEAD?.name || await this.getCurrentBranch(repo) || 'master';

            return {
                currentBranch,
                status,
                recentCommits: commits, // Will be empty array for repos with no commits
                remoteStatus,
                repositoryRoot: repo.rootUri.fsPath
            };
        } catch (error) {
            console.error('Failed to get repository state:', error);
            return null;
        }
    }

    /**
     * Get current branch name, handling empty repositories
     */
    private async getCurrentBranch(repo: any): Promise<string> {
        try {
            const root = repo?.rootUri?.fsPath;
            if (!root) return 'master';
            
            const result = await this.runGit(root, ['branch', '--show-current']);
            return result.trim() || 'master';
        } catch (error) {
            // If we can't get current branch, try to get default branch
            try {
                const root = repo?.rootUri?.fsPath;
                if (!root) return 'master';
                
                const result = await this.runGit(root, ['symbolic-ref', '--short', 'HEAD']);
                return result.trim() || 'master';
            } catch {
                return 'master'; // Default fallback
            }
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
        console.log(`GitService: Getting recent commits (count: ${count})`);

        // Try Git API first
        try {
            if (repo && typeof repo.log === 'function') {
                console.log('GitService: Trying VS Code Git API...');
                const commits = await Promise.race([
                    repo.log({ maxEntries: count }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Git API timeout')), 10000))
                ]);

                if (commits && Array.isArray(commits) && commits.length > 0) {
                    const list: GitCommit[] = commits.map((commit: any) => ({
                        hash: commit.hash || '',
                        message: commit.message || '',
                        author: commit.authorName || 'Unknown',
                        date: new Date(commit.authorDate || Date.now()),
                        files: commit.files || []
                    }));
                    console.log(`GitService: Got ${list.length} commits from Git API`);
                    return list;
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            
            // Handle empty repository case
            if (errorMsg.includes('does not have any commits yet') || 
                errorMsg.includes('bad default revision')) {
                console.log('GitService: Git API - Repository has no commits yet');
                return [];
            }
            
            console.warn('GitService: Git API log failed, falling back to CLI:', error);
        }

        // CLI fallback
        try {
            const root = repo?.rootUri?.fsPath;
            if (!root) {
                console.warn('GitService: No repository root path available');
                return [];
            }

            console.log(`GitService: Using CLI fallback for ${root}`);

            // First check if this is a git repository
            try {
                await this.runGit(root, ['rev-parse', '--git-dir']);
                console.log('GitService: Git repository check passed');
            } catch (error) {
                console.warn('GitService: Not a git repository:', root);
                return [];
            }

            // Check git status to ensure repository is in good state
            try {
                await this.runGit(root, ['status', '--porcelain']);
                console.log('GitService: Git status check passed');
            } catch (error) {
                console.warn('GitService: Git status failed, but continuing:', error);
            }

            // Use a formatted log including author and ISO date; tab delimiter to reduce ambiguity
            console.log(`GitService: Using formatted log for author/date...`);
            const fmt = '--pretty=format:%H%x09%an%x09%ad%x09%s'; // hash<TAB>author<TAB>date<TAB>subject
            const out = await this.runGit(root, ['log', `--max-count=${count}`, '--date=iso-strict', fmt]);
            console.log(`GitService: Formatted log worked, parsing ${out.length} chars...`);

            const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
            const result: GitCommit[] = [];

            for (const line of lines) {
                const parts = line.split('\t');
                const [hash, author, dateStr, subject] = [parts[0] || '', parts[1] || 'Unknown', parts[2] || '', parts.slice(3).join('\t') || ''];
                const dt = dateStr ? new Date(dateStr) : new Date();
                result.push({
                    hash: hash.trim(),
                    message: subject.trim(),
                    author: author.trim() || 'Unknown',
                    date: dt,
                    files: []
                });
            }

            console.log(`GitService: Got ${result.length} commits from CLI`);
            return result;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            
            // Handle empty repository (no commits yet)
            if (errorMsg.includes('does not have any commits yet') || 
                errorMsg.includes('bad default revision') ||
                errorMsg.includes('ambiguous argument \'HEAD\'')) {
                console.log('GitService: Repository has no commits yet, returning empty array');
                return [];
            }
            
            console.error('GitService: Failed to get recent commits via CLI:', error);
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

            // Strategy (robust across platforms and merges):
            // 1) Try `git show --format=` (single-commit patch)
            // 2) If empty, try `git show -m --first-parent --format=` for merges
            // 3) If still empty, fall back to `git diff <parent> <commit>`
            let unified = '';
            const root = repo.rootUri.fsPath;

            try {
                unified = await this.runGit(root, ['show', '--format=', '--unified=3', '--no-color', commitHash]);
            } catch { /* ignore */ }
            
            if (!unified || unified.trim().length === 0) {
                try {
                    unified = await this.runGit(root, ['show', '-m', '--first-parent', '--format=', '--unified=3', '--no-color', commitHash]);
                } catch { /* ignore */ }
            }

            if (!unified || unified.trim().length === 0) {
                try {
                    unified = await this.runGit(root, ['diff', '--unified=3', '--no-color', `${commitHash}^`, commitHash]);
                } catch { /* ignore */ }
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
        const commandStr = `git ${args.join(' ')}`;
        console.log(`GitService: Starting command: ${commandStr} in ${cwd}`);

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let child: any;

            const timeout = setTimeout(() => {
                const elapsed = Date.now() - startTime;
                console.error(`GitService: Command TIMEOUT after ${elapsed}ms: ${commandStr}`);

                if (child && !child.killed) {
                    console.log(`GitService: Killing process PID ${child.pid}`);
                    child.kill('SIGTERM');

                    // Force kill after 5 seconds if SIGTERM doesn't work
                    setTimeout(() => {
                        if (child && !child.killed) {
                            console.log(`GitService: Force killing process PID ${child.pid}`);
                            child.kill('SIGKILL');
                        }
                    }, 5000);
                }
                reject(new Error(`Git command timed out after 30 seconds: ${commandStr}`));
            }, 30000); // 30 second timeout

            child = execFile('git', args, {
                cwd,
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024,
                timeout: 30000,
                env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
            }, (err, stdout, stderr) => {
                clearTimeout(timeout);
                const elapsed = Date.now() - startTime;

                if (err) {
                    console.error(`GitService: Command FAILED after ${elapsed}ms: ${commandStr}`);
                    console.error(`GitService: Error:`, err);
                    console.error(`GitService: Stderr:`, stderr);
                    return reject(err);
                }

                console.log(`GitService: Command SUCCESS after ${elapsed}ms: ${commandStr} (${stdout.length} chars output)`);
                resolve(stdout.toString());
            });

            child.on('error', (error: Error) => {
                clearTimeout(timeout);
                const elapsed = Date.now() - startTime;
                console.error(`GitService: Process ERROR after ${elapsed}ms: ${commandStr}`, error);
                reject(error);
            });

            child.on('spawn', () => {
                console.log(`GitService: Process spawned PID ${child.pid}: ${commandStr}`);
            });

            child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
                const elapsed = Date.now() - startTime;
                console.log(`GitService: Process exited after ${elapsed}ms with code ${code}, signal ${signal}: ${commandStr}`);
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
        console.log(`GitService: Executing operation: ${operation}`, options);

        try {
            const repo = await this.getRepository(options.workspacePath);
            if (!repo) {
                throw new Error('No git repository found in workspace');
            }

            console.log(`GitService: Repository found for operation ${operation}`);

            switch (operation) {
                case 'status':
                    return await this.getRepositoryState(options.workspacePath);

                case 'log':
                    const count = Math.min(options.count || 20, 100); // Limit to prevent hanging
                    return await this.getRecentCommits(repo, count);

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
                    if (!options.message) throw new Error('Missing commit message');
                    return await this.commit(repo, options.message, options.files);

                case 'push':
                    return await this.push(repo);

                case 'pull':
                    return await this.pull(repo);

                case 'debug':
                    return await this.debugGitCommand(options.debugOperation || 'simple-log', options);

                default:
                    throw new Error(`Unsupported git operation: ${operation}`);
            }
        } catch (error) {
            console.error(`GitService: Operation ${operation} failed:`, error);
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
        console.log(`GitService: Getting repository for path: ${workspacePath || 'current workspace'}`);

        // Try to get workspace root first
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let targetPath = workspacePath;

        if (!targetPath && workspaceFolders && workspaceFolders.length > 0) {
            targetPath = workspaceFolders[0]!.uri.fsPath;
        }

        if (!targetPath) {
            console.log('GitService: No workspace path available');
            return null;
        }

        // Check if we have a cached repository
        const cachedRepo = this._repositories.get(targetPath);
        if (cachedRepo) {
            console.log(`GitService: Using cached repository for ${targetPath}`);
            return cachedRepo;
        }

        // Try Git extension API
        if (this._gitExtension?.exports) {
            try {
                const gitApi = this._gitExtension.exports.getAPI(1);
                if (gitApi && gitApi.repositories) {
                    // Look for repository that matches our path
                    for (const repo of gitApi.repositories) {
                        if (repo.rootUri && repo.rootUri.fsPath === targetPath) {
                            console.log(`GitService: Found matching repository via Git API: ${targetPath}`);
                            this._repositories.set(targetPath, repo);
                            return repo;
                        }
                    }

                    // If no exact match, try the first repository
                    if (gitApi.repositories.length > 0) {
                        const repo = gitApi.repositories[0];
                        console.log(`GitService: Using first available repository: ${repo.rootUri?.fsPath}`);
                        return repo;
                    }
                }
            } catch (error) {
                console.warn('GitService: Error accessing Git API:', error);
            }
        }

        // Create a minimal repository object for CLI operations
        console.log(`GitService: Creating minimal repository object for ${targetPath}`);
        const minimalRepo = {
            rootUri: { fsPath: targetPath },
            state: { HEAD: null, indexChanges: [], workingTreeChanges: [], untrackedChanges: [], mergeChanges: [] }
        };

        // Cache it
        this._repositories.set(targetPath, minimalRepo);
        return minimalRepo;
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
