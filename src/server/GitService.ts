/**
 * GitService - Handles git operations and repository monitoring
 */

import * as vscode from 'vscode';
import * as path from 'path';
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
            this._gitExtension = vscode.extensions.getExtension('vscode.git');
            if (this._gitExtension && !this._gitExtension.isActive) {
                await this._gitExtension.activate();
            }

            if (this._gitExtension?.exports) {
                const gitApi = this._gitExtension.exports.getAPI(1);
                if (gitApi) {
                    // Monitor repository changes
                    this._disposables.push(
                        gitApi.onDidOpenRepository((repo: any) => {
                            this._repositories.set(repo.rootUri.fsPath, repo);
                            console.log(`Git repository opened: ${repo.rootUri.fsPath}`);
                        })
                    );

                    this._disposables.push(
                        gitApi.onDidCloseRepository((repo: any) => {
                            this._repositories.delete(repo.rootUri.fsPath);
                            console.log(`Git repository closed: ${repo.rootUri.fsPath}`);
                        })
                    );

                    // Initialize existing repositories
                    gitApi.repositories.forEach((repo: any) => {
                        this._repositories.set(repo.rootUri.fsPath, repo);
                    });
                }
            }
        } catch (error) {
            console.warn('Failed to initialize Git extension:', error);
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
            return commits.map((commit: any) => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.authorName || 'Unknown',
                date: new Date(commit.authorDate || Date.now()),
                files: commit.files || []
            }));
        } catch (error) {
            console.warn('Failed to get recent commits:', error);
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
            return null;
        }

        const gitApi = this._gitExtension.exports.getAPI(1);
        if (!gitApi) {
            return null;
        }

        if (workspacePath) {
            return this._repositories.get(workspacePath) || null;
        }

        // Get repository for current workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            return this._repositories.get(workspaceRoot) || gitApi.repositories[0] || null;
        }

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