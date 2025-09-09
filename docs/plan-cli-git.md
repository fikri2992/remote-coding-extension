# CLI Git Service Migration Plan

## Goal
Migrate `GitService.ts` from VS Code extension to standalone CLI, removing all VS Code API dependencies while maintaining full git functionality.

## Current State Analysis

### What We Have
- ✅ Complete GitService implementation with VS Code Git extension integration
- ✅ CLI fallback using `child_process.execFile` for git operations
- ✅ Comprehensive git operations (status, log, diff, commit, push, pull, etc.)
- ✅ Repository monitoring and change tracking
- ✅ Debug and testing capabilities
- ✅ Error handling and timeout management

### What Needs to Change
- ❌ VS Code Git extension dependency (`require('vscode')`)
- ❌ VS Code workspace folder access
- ❌ VS Code Git API integration
- ❌ VS Code notification system
- ❌ VS Code configuration access

## CLI Git Service Plan

### Phase 1: Remove VS Code Dependencies (1-2 days)

#### 1.1 Create CLI Git Service Structure
```bash
src/
├── cli/
│   └── services/
│       ├── GitService.ts          # Main CLI Git service
│       ├── GitRepository.ts      # Repository wrapper (no VS Code)
│       ├── GitConfigManager.ts   # Configuration management
│       └── GitTypes.ts           # Type definitions
└── server/
    └── GitService.ts             # Original (keep for reference)
```

#### 1.2 CLI Git Service Implementation
Create `src/cli/services/GitService.ts`:
```typescript
import { execFile } from 'child_process';
import * as path from 'path';
import { GitRepositoryState, GitCommit, GitDiff } from '../server/interfaces';

export interface CLIGitConfig {
  defaultBranch: string;
  timeoutMs: number;
  maxBufferSize: number;
  enableDebug: boolean;
  workspaceRoot: string;
}

export class CLIGitService {
  private config: CLIGitConfig;
  private repositoryCache: Map<string, CLIGitRepository> = new Map();

  constructor(config?: Partial<CLIGitConfig>) {
    this.config = {
      defaultBranch: 'main',
      timeoutMs: 30000,
      maxBufferSize: 10 * 1024 * 1024,
      enableDebug: process.env.KIRO_GIT_DEBUG === '1',
      workspaceRoot: process.cwd(),
      ...config
    };
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

  // ... other methods with CLI-only implementations
}
```

#### 1.3 CLI Repository Wrapper
Create `src/cli/services/GitRepository.ts`:
```typescript
export class CLIGitRepository {
  constructor(public rootPath: string, private gitService: CLIGitService) {}

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
      return output.trim() || 'main';
    } catch {
      return this.config.defaultBranch;
    }
  }

  private async runGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, {
        cwd: this.rootPath,
        timeout: this.gitService.config.timeoutMs,
        maxBuffer: this.gitService.config.maxBufferSize,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      }, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout.toString());
      });
    });
  }

  // ... parsing methods and other git operations
}
```

### Phase 2: Configuration Management (1 day)

#### 2.1 CLI Git Configuration Manager
Create `src/cli/services/GitConfigManager.ts`:
```typescript
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
      enableDebug: false,
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
}
```

### Phase 3: Enhanced CLI Features (2 days)

#### 3.1 Git Command Safety Wrapper
```typescript
export class SafeGitExecutor {
  constructor(private config: GitConfigManager) {}

  async executeSafe(repo: CLIGitRepository, operation: string, options: any = {}): Promise<any> {
    // Validate operation
    if (!this.config.isCommandAllowed(operation)) {
      throw new Error(`Git command '${operation}' not allowed`);
    }

    // Validate inputs
    if (operation === 'commit' && options.message) {
      if (!this.config.validateCommitMessage(options.message)) {
        throw new Error('Invalid commit message');
      }
    }

    // Check for destructive operations
    const isDestructive = ['reset', 'clean', 'force-push'].includes(operation);
    if (isDestructive && !this.config.config.safety.allowDestructive) {
      if (this.config.config.safety.requireConfirmation) {
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
      // ... other operations
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }
}
```

#### 3.2 Git Repository Auto-Detection
```typescript
export class GitRepositoryDetector {
  async findGitRepositories(rootPath: string): Promise<string[]> {
    const repositories: string[] = [];
    
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const gitDir = path.join(dir, '.git');
        await fs.promises.access(gitDir);
        repositories.push(dir);
      } catch {
        // Not a git repository, scan subdirectories
        try {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true });
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
        await fs.promises.access(gitDir);
        return currentPath;
      } catch {
        currentPath = path.dirname(currentPath);
      }
    }
    
    return null;
  }
}
```

### Phase 4: CLI Integration (1 day)

#### 4.1 Update CLI Commands
Modify `src/cli/commands/git.ts`:
```typescript
import { Command } from 'commander';
import { CLIGitService } from '../services/GitService';
import { GitConfigManager } from '../services/GitConfigManager';

export const gitCommand = new Command('git')
  .description('Git operations and repository management')
  .option('--workspace <path>', 'Workspace path')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const gitService = new CLIGitService({
      workspaceRoot: options.workspace || process.cwd(),
      enableDebug: options.debug
    });

    // Show git status by default
    try {
      const status = await gitService.getRepositoryState(options.workspace);
      if (status) {
        console.log(`📁 Repository: ${status.repositoryRoot}`);
        console.log(`🌿 Branch: ${status.currentBranch}`);
        console.log(`📊 Status: ${status.status.staged.length} staged, ${status.status.unstaged.length} unstaged`);
      } else {
        console.log('❌ No git repository found');
      }
    } catch (error) {
      console.error('❌ Git operation failed:', error.message);
    }
  });

// Add git subcommands
gitCommand
  .command('status')
  .description('Show git repository status')
  .option('--workspace <path>', 'Workspace path')
  .action(async (options) => {
    const gitService = new CLIGitService();
    const status = await gitService.getRepositoryState(options.workspace);
    // Display detailed status
  });

gitCommand
  .command('log')
  .description('Show commit history')
  .option('--count <number>', 'Number of commits', '10')
  .option('--workspace <path>', 'Workspace path')
  .action(async (options) => {
    const gitService = new CLIGitService();
    const state = await gitService.getRepositoryState(options.workspace);
    // Display commit log
  });
```

#### 4.2 WebSocket Integration
Update the main CLI server to use the new Git service:
```typescript
// In src/cli/server.ts or main WebSocket handler
import { CLIGitService } from './services/GitService';

export class CliServer {
  private gitService: CLIGitService;

  constructor() {
    this.gitService = new CLIGitService();
  }

  async handleGitOperation(clientId: string, message: any) {
    const { operation, ...options } = message.data;
    
    try {
      let result;
      switch (operation) {
        case 'status':
          result = await this.gitService.getRepositoryState(options.workspacePath);
          break;
        case 'log':
          result = await this.gitService.getRepositoryState(options.workspacePath);
          result = result?.recentCommits.slice(0, options.count || 10);
          break;
        case 'diff':
          result = await this.gitService.getCurrentDiff(options.workspacePath);
          break;
        // ... other operations
        default:
          throw new Error(`Unknown git operation: ${operation}`);
      }

      this.sendToClient(clientId, {
        type: 'git',
        id: message.id,
        data: { operation, result, success: true }
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'git',
        id: message.id,
        data: { operation, error: error.message, success: false }
      });
    }
  }
}
```

### Phase 5: Testing and Validation (1 day)

#### 5.1 Test Scenarios
```typescript
// tests/git-service.test.ts
import { CLIGitService } from '../src/cli/services/GitService';

describe('CLIGitService', () => {
  let gitService: CLIGitService;
  let testRepoPath: string;

  beforeEach(async () => {
    testRepoPath = createTestRepository();
    gitService = new CLIGitService({ workspaceRoot: testRepoPath });
  });

  test('should get repository status', async () => {
    const status = await gitService.getRepositoryState();
    expect(status).toBeDefined();
    expect(status?.currentBranch).toBe('main');
  });

  test('should get commit history', async () => {
    // Create test commits
    await createTestCommits(testRepoPath);
    
    const state = await gitService.getRepositoryState();
    expect(state?.recentCommits.length).toBeGreaterThan(0);
  });

  test('should handle non-git directories', async () => {
    const nonGitPath = createNonGitDirectory();
    const service = new CLIGitService({ workspaceRoot: nonGitPath });
    const status = await service.getRepositoryState();
    expect(status).toBeNull();
  });
});
```

#### 5.2 CLI Command Testing
```bash
# Test basic git operations
npm run build:cli
node ./out/cli/index.js git status
node ./out/cli/index.js git log --count 5
node ./out/cli/index.js git diff

# Test with workspace path
node ./out/cli/index.js git --workspace /path/to/repo git status

# Test error handling
node ./out/cli/index.js git --workspace /nonexistent/path git status
```

## Success Criteria

### Minimum Viable Product
- [ ] CLI Git service completely independent of VS Code APIs
- [ ] All basic git operations working (status, log, diff, commit)
- [ ] Repository auto-detection and caching
- [ ] Proper error handling and timeout management
- [ ] WebSocket integration for web interface

### Enhanced Features
- [ ] Git command safety validation
- [ ] Configuration management via JSON files
- [ ] Repository search and detection
- [ ] Debug logging and diagnostics
- [ ] Comprehensive test coverage

## Files to Create/Modify

### New Files
- `src/cli/services/GitService.ts` - Main CLI Git service
- `src/cli/services/GitRepository.ts` - Repository wrapper
- `src/cli/services/GitConfigManager.ts` - Configuration management
- `src/cli/services/GitTypes.ts` - Type definitions
- `src/cli/services/SafeGitExecutor.ts` - Safety wrapper
- `src/cli/services/GitRepositoryDetector.ts` - Repository detection
- `tests/git-service.test.ts` - Test suite

### Modified Files
- `src/cli/commands/git.ts` - CLI git commands
- `src/cli/server.ts` - Integrate new Git service
- `package.json` - Add git-related dependencies and scripts

### Files to Remove
- `src/server/GitService.ts` - Replace with CLI version

## Timeline
- **Day 1**: Basic CLI Git service structure and repository wrapper
- **Day 2**: Configuration management and safety features
- **Day 3**: Enhanced features (repository detection, safety wrapper)
- **Day 4**: CLI integration and WebSocket support
- **Day 5**: Testing, validation, and documentation

## Migration Strategy

1. **Parallel Development**: Keep original GitService during development
2. **Feature Parity**: Ensure all original functionality is preserved
3. **Incremental Testing**: Test each git operation independently
4. **Performance Validation**: Ensure CLI performance matches or exceeds VS Code version
5. **Documentation**: Update CLI documentation with git capabilities

This plan provides a comprehensive roadmap for migrating the Git service from VS Code extension dependencies to a fully functional CLI implementation.
