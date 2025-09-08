import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Import interfaces from server (we'll keep these for compatibility)
import { GitRepositoryState, GitCommit, GitDiff } from '../../server/interfaces';

// Define GitRemoteStatus interface for CLI compatibility
export interface GitRemoteStatus {
    ahead: number;
    behind: number;
    hasRemote: boolean;
    remote: string;
}

export interface CLIGitConfig {
    defaultBranch: string;
    timeoutMs: number;
    maxBufferSize: number;
    enableDebug: boolean;
    workspaceRoot: string;
}

export interface GitServiceConfig {
    defaultBranch: string;
    timeoutMs: number;
    maxBufferSize: number;
    enableDebug: boolean;
    allowedCommands: string[];
    safety: {
        allowDestructive: boolean;
        requireConfirmation: boolean;
        maxCommitMessageLength: number;
    };
}

export class GitConfigManager {
    private config: GitServiceConfig;

    constructor(configPath?: string) {
        this.config = this.loadConfig(configPath);
    }

    private loadConfig(configPath?: string): GitServiceConfig {
        const defaultConfig: GitServiceConfig = {
            defaultBranch: 'main',
            timeoutMs: 30000,
            maxBufferSize: 10 * 1024 * 1024,
            enableDebug: process.env.KIRO_GIT_DEBUG === '1',
            allowedCommands: [
                'status', 'log', 'diff', 'show', 'branch', 'add',
                'commit', 'push', 'pull', 'fetch', 'merge', 'rebase'
            ],
            safety: {
                allowDestructive: false,
                requireConfirmation: true,
                maxCommitMessageLength: 1000
            }
        };

        // Load from config file if provided
        if (configPath) {
            try {
                const configData = fs.readFileSync(configPath, 'utf-8');
                return { ...defaultConfig, ...JSON.parse(configData) };
            } catch {
                return defaultConfig;
            }
        }

        return defaultConfig;
    }

    isCommandAllowed(command: string): boolean {
        return this.config.allowedCommands.includes(command);
    }

    validateCommitMessage(message: string): boolean {
        return message.length > 0 && message.length <= this.config.safety.maxCommitMessageLength;
    }

    getConfig(): GitServiceConfig {
        return this.config;
    }
}

export class CLIGitRepository {
    constructor(
        public rootPath: string,
        private gitService: CLIGitService,
        private configManager: GitConfigManager
    ) { }

    async getStatus(): Promise<GitRepositoryState['status']> {
        const output = await this.runGit(['status', '--porcelain']);
        return this.parseGitStatus(output);
    }

    async getRecentCommits(count: number = 10): Promise<GitCommit[]> {
        const output = await this.runGit([
            'log', `--max-count=${count}`,
            '--pretty=format:%H%x09%an%x09%ad%x09%s',
            '--date=iso-strict'
        ]);
        return this.parseGitLog(output);
    }

    async getCurrentBranch(): Promise<string> {
        try {
            const output = await this.runGit(['branch', '--show-current']);
            return output.trim() || this.gitService.config.defaultBranch;
        } catch {
            return this.gitService.config.defaultBranch;
        }
    }

    async getRemoteStatus(): Promise<GitRemoteStatus> {
        try {
            const [ahead, behind, remote] = await Promise.all([
                this.runGit(['rev-list', '--count', '@{u}..HEAD']).catch(() => '0'),
                this.runGit(['rev-list', '--count', 'HEAD..@{u}']).catch(() => '0'),
                this.runGit(['remote', 'get-url', 'origin']).catch(() => 'origin')
            ]);

            return {
                ahead: parseInt(ahead.trim()),
                behind: parseInt(behind.trim()),
                hasRemote: true,
                remote: remote.trim()
            };
        } catch {
            return {
                ahead: 0,
                behind: 0,
                hasRemote: false,
                remote: 'origin'
            };
        }
    }

    async getDiff(filePath?: string): Promise<GitDiff[]> {
        const args = ['diff', '--no-color'];
        if (filePath) {
            args.push('--', filePath);
        }

        const output = await this.runGit(args);
        return this.parseGitDiff(output);
    }

    async commit(message: string, files?: string[]): Promise<void> {
        if (!this.configManager.validateCommitMessage(message)) {
            throw new Error('Invalid commit message');
        }

        // Stage files if specified
        if (files && files.length > 0) {
            await this.runGit(['add', ...files]);
        }

        // Create commit
        await this.runGit(['commit', '-m', message]);
    }

    async add(files: string[]): Promise<void> {
        await this.runGit(['add', ...files]);
    }

    async push(remote?: string, branch?: string): Promise<void> {
        const args = ['push'];
        if (remote) args.push(remote);
        if (branch) args.push(branch);

        await this.runGit(args);
    }

    async pull(remote?: string, branch?: string): Promise<void> {
        const args = ['pull'];
        if (remote) args.push(remote);
        if (branch) args.push(branch);

        await this.runGit(args);
    }

    async createBranch(name: string, from?: string): Promise<void> {
        const args = ['checkout', '-b', name];
        if (from) args.push(from);

        await this.runGit(args);
    }

    async switchBranch(name: string): Promise<void> {
        await this.runGit(['checkout', name]);
    }

    private async runGit(args: string[]): Promise<string> {
        if (this.gitService.config.enableDebug) {
            console.log(`[Git Debug] Running: git ${args.join(' ')} in ${this.rootPath}`);
        }

        return new Promise((resolve, reject) => {
            execFile('git', args, {
                cwd: this.rootPath,
                timeout: this.gitService.config.timeoutMs,
                maxBuffer: this.gitService.config.maxBufferSize,
                env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
            }, (error, stdout, stderr) => {
                if (error) {
                    if (this.gitService.config.enableDebug) {
                        console.log(`[Git Debug] Error: ${error.message}`);
                        console.log(`[Git Debug] Stderr: ${stderr}`);
                    }
                    reject(new Error(`Git command failed: ${error.message}`));
                } else {
                    if (this.gitService.config.enableDebug) {
                        console.log(`[Git Debug] Output: ${stdout}`);
                    }
                    resolve(stdout.toString());
                }
            });
        });
    }

    private parseGitStatus(output: string): GitRepositoryState['status'] {
        const lines = output.trim().split('\n').filter(line => line.length > 0);

        const staged: string[] = [];
        const unstaged: string[] = [];
        const untracked: string[] = [];
        const conflicted: string[] = [];

        for (const line of lines) {
            const statusCode = line.substring(0, 2);
            const filePath = line.substring(3);

            if (statusCode === '??') {
                untracked.push(filePath);
            } else if (statusCode[0] !== ' ') {
                staged.push(filePath);
            } else if (statusCode[1] !== ' ') {
                unstaged.push(filePath);
            }
            
            // Check for conflicted files (both stages modified)
            if (statusCode === 'DD' || statusCode === 'AA' || statusCode === 'UU' || 
                statusCode === 'DU' || statusCode === 'UD' || statusCode === 'AU' || 
                statusCode === 'UA' || statusCode === 'DA' || statusCode === 'AD') {
                conflicted.push(filePath);
            }
        }

        return { staged, unstaged, untracked, conflicted };
    }

    private parseGitLog(output: string): GitCommit[] {
        const lines = output.trim().split('\n').filter(line => line.length > 0);

        return lines.map(line => {
            const [hash, author, date, ...messageParts] = line.split('\t');
            return {
                hash: hash || '',
                author: author || '',
                date: date ? new Date(date) : new Date(),
                message: messageParts.join('\t'),
                files: [] // TODO: Could be enhanced to get actual file list from git log
            };
        });
    }

    private parseGitDiff(output: string): GitDiff[] {
        if (!output.trim()) return [];

        const diffs: GitDiff[] = [];
        const lines = output.split('\n');
        let currentDiff: Partial<GitDiff> | null = null;
        let additions = 0;
        let deletions = 0;
        let content = '';

        for (const line of lines) {
            if (line.startsWith('diff --git')) {
                if (currentDiff && currentDiff.file) {
                    currentDiff.content = content;
                    currentDiff.additions = additions;
                    currentDiff.deletions = deletions;
                    diffs.push(currentDiff as GitDiff);
                }
                const filePath = line.split(' ')[2]?.substring(2) || '';
                currentDiff = {
                    file: filePath,
                    type: 'modified', // Default, could be enhanced to detect actual type
                    additions: 0,
                    deletions: 0,
                    content: ''
                };
                additions = 0;
                deletions = 0;
                content = '';
            } else if (line.startsWith('+++') || line.startsWith('---')) {
                // Skip file header lines
                continue;
            } else if (line.startsWith('+') && !line.startsWith('+++')) {
                additions++;
                content += line + '\n';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
                content += line + '\n';
            } else if (line.startsWith('@@')) {
                // Hunk header, include in content
                content += line + '\n';
            } else if (line.startsWith(' ') || line.length === 0) {
                // Context lines or empty lines
                content += line + '\n';
            }
        }

        if (currentDiff && currentDiff.file) {
            currentDiff.content = content;
            currentDiff.additions = additions;
            currentDiff.deletions = deletions;
            diffs.push(currentDiff as GitDiff);
        }

        return diffs;
    }
}

export class GitRepositoryDetector {
    async findGitRepositories(rootPath: string): Promise<string[]> {
        const repositories: string[] = [];

        const scanDirectory = async (dir: string): Promise<void> => {
            try {
                const gitDir = path.join(dir, '.git');
                await fsPromises.access(gitDir);
                repositories.push(dir);
            } catch {
                // Not a git repository, scan subdirectories
                try {
                    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory() && !entry.name.startsWith('.')) {
                            await scanDirectory(path.join(dir, entry.name));
                        }
                    }
                } catch {
                    // Skip directories we can't read
                }
            }
        };

        await scanDirectory(rootPath);
        return repositories;
    }

    async findClosestRepository(startPath: string): Promise<string | null> {
        let currentPath = path.resolve(startPath);

        while (currentPath !== path.dirname(currentPath)) {
            const gitDir = path.join(currentPath, '.git');
            try {
                await fsPromises.access(gitDir);
                return currentPath;
            } catch {
                currentPath = path.dirname(currentPath);
            }
        }

        return null;
    }
}

export class SafeGitExecutor {
    constructor(private configManager: GitConfigManager) { }

    async executeSafe(repo: CLIGitRepository, operation: string, options: any = {}): Promise<any> {
        // Validate operation
        if (!this.configManager.isCommandAllowed(operation)) {
            throw new Error(`Git command '${operation}' not allowed`);
        }

        // Validate inputs
        if (operation === 'commit' && options.message) {
            if (!this.configManager.validateCommitMessage(options.message)) {
                throw new Error('Invalid commit message');
            }
        }

        // Check for destructive operations
        const isDestructive = ['reset', 'clean', 'force-push'].includes(operation);
        if (isDestructive && !this.configManager.getConfig().safety.allowDestructive) {
            if (this.configManager.getConfig().safety.requireConfirmation) {
                // Would require user confirmation in interactive mode
                throw new Error(`Destructive operation '${operation}' requires confirmation`);
            }
        }

        // Execute the operation
        switch (operation) {
            case 'status':
                return repo.getStatus();
            case 'log':
                return repo.getRecentCommits(options.count || 10);
            case 'diff':
                return repo.getDiff(options.file);
            case 'commit':
                return repo.commit(options.message, options.files);
            case 'add':
                return repo.add(options.files);
            case 'push':
                return repo.push(options.remote, options.branch);
            case 'pull':
                return repo.pull(options.remote, options.branch);
            case 'create-branch':
                return repo.createBranch(options.name, options.from);
            case 'switch-branch':
                return repo.switchBranch(options.name);
            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }
    }
}

export class CLIGitService {
    public config: CLIGitConfig;
    private repositoryCache: Map<string, CLIGitRepository> = new Map();
    private configManager: GitConfigManager;
    private repositoryDetector: GitRepositoryDetector;
    private safeExecutor: SafeGitExecutor;

    constructor(config?: Partial<CLIGitConfig>) {
        this.config = {
            defaultBranch: 'main',
            timeoutMs: 30000,
            maxBufferSize: 10 * 1024 * 1024,
            enableDebug: process.env.KIRO_GIT_DEBUG === '1',
            workspaceRoot: process.cwd(),
            ...config
        };

        this.configManager = new GitConfigManager();
        this.repositoryDetector = new GitRepositoryDetector();
        this.safeExecutor = new SafeGitExecutor(this.configManager);
    }

    async getRepositoryState(workspacePath?: string): Promise<GitRepositoryState | null> {
        const repo = await this.getRepository(workspacePath);
        if (!repo) return null;

        const [status, commits, remoteStatus] = await Promise.all([
            repo.getStatus(),
            repo.getRecentCommits(10),
            repo.getRemoteStatus()
        ]);

        return {
            currentBranch: await repo.getCurrentBranch(),
            status,
            recentCommits: commits,
            remoteStatus,
            repositoryRoot: repo.rootPath
        };
    }

    async getRepository(workspacePath?: string): Promise<CLIGitRepository | null> {
        const searchPath = workspacePath || this.config.workspaceRoot;

        // Check cache first
        if (this.repositoryCache.has(searchPath)) {
            return this.repositoryCache.get(searchPath)!;
        }

        // Find closest git repository
        const repoRoot = await this.repositoryDetector.findClosestRepository(searchPath);
        if (!repoRoot) return null;

        const repo = new CLIGitRepository(repoRoot, this, this.configManager);
        this.repositoryCache.set(searchPath, repo);
        return repo;
    }

    async executeSafeOperation(operation: string, options: any = {}): Promise<any> {
        const repo = await this.getRepository(options.workspacePath);
        if (!repo) {
            throw new Error('No git repository found');
        }

        return this.safeExecutor.executeSafe(repo, operation, options);
    }

    async findRepositories(rootPath?: string): Promise<string[]> {
        const searchPath = rootPath || this.config.workspaceRoot;
        return this.repositoryDetector.findGitRepositories(searchPath);
    }

    // Convenience methods that wrap the safe executor
    async getStatus(workspacePath?: string): Promise<GitRepositoryState['status'] | null> {
        const state = await this.getRepositoryState(workspacePath);
        return state?.status || null;
    }

    async getRecentCommits(count: number = 10, workspacePath?: string): Promise<GitCommit[]> {
        const repo = await this.getRepository(workspacePath);
        return repo ? repo.getRecentCommits(count) : [];
    }

    async getCurrentDiff(workspacePath?: string): Promise<GitDiff[]> {
        const repo = await this.getRepository(workspacePath);
        return repo ? repo.getDiff() : [];
    }

    async commit(message: string, files?: string[], workspacePath?: string): Promise<void> {
        await this.executeSafeOperation('commit', { message, files, workspacePath });
    }

    async add(files: string[], workspacePath?: string): Promise<void> {
        await this.executeSafeOperation('add', { files, workspacePath });
    }

    async push(remote?: string, branch?: string, workspacePath?: string): Promise<void> {
        await this.executeSafeOperation('push', { remote, branch, workspacePath });
    }

    async pull(remote?: string, branch?: string, workspacePath?: string): Promise<void> {
        await this.executeSafeOperation('pull', { remote, branch, workspacePath });
    }

    getConfig(): GitServiceConfig {
        return this.configManager.getConfig();
    }

    clearCache(): void {
        this.repositoryCache.clear();
    }
}
