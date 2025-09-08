import { Command } from 'commander';
import { CLIGitService, GitConfigManager } from '../services/GitService';

export const gitCommand = new Command('git')
    .description('Git repository operations')
    .option('--workspace <path>', 'Workspace path')
    .option('--debug', 'Enable debug logging')
    .action(async (options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd(),
            enableDebug: options.debug
        });

        console.log('🔀 Git Service Configuration:');
        console.log(`   Default Branch: ${gitService.config.defaultBranch}`);
        console.log(`   Workspace: ${gitService.config.workspaceRoot}`);
        console.log(`   Debug: ${gitService.config.enableDebug}`);
        console.log(`   Timeout: ${gitService.config.timeoutMs}ms`);
        console.log(`   Max Buffer: ${gitService.config.maxBufferSize} bytes`);
    });

// Git status command
gitCommand
    .command('status')
    .description('Show git repository status')
    .option('--json', 'Output as JSON')
    .option('--workspace <path>', 'Repository path')
    .action(async (options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd()
        });

        try {
            const status = await gitService.getStatus(options.workspace);

            if (!status) {
                console.log('❌ No git repository found');
                return;
            }

            if (options.json) {
                console.log(JSON.stringify(status, null, 2));
            } else {
                console.log('📋 Git Status:');
                console.log(`   Staged files: ${status.staged.length}`);
                console.log(`   Unstaged files: ${status.unstaged.length}`);
                console.log(`   Untracked files: ${status.untracked.length}`);
                console.log(`   Conflicted files: ${status.conflicted.length}`);

                if (status.staged.length > 0) {
                    console.log('\n📝 Staged files:');
                    status.staged.forEach(file => console.log(`   + ${file}`));
                }

                if (status.unstaged.length > 0) {
                    console.log('\n📝 Unstaged files:');
                    status.unstaged.forEach(file => console.log(`   * ${file}`));
                }

                if (status.untracked.length > 0) {
                    console.log('\n📝 Untracked files:');
                    status.untracked.forEach(file => console.log(`   ? ${file}`));
                }

                if (status.conflicted.length > 0) {
                    console.log('\n⚠️  Conflicted files:');
                    status.conflicted.forEach(file => console.log(`   ! ${file}`));
                }
            }
        } catch (error) {
            console.error('❌ Failed to get git status:', error);
        }
    });

// Git log command
gitCommand
    .command('log')
    .description('Show commit history')
    .option('--count <number>', 'Number of commits to show', '10')
    .option('--json', 'Output as JSON')
    .option('--workspace <path>', 'Repository path')
    .action(async (options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd()
        });

        try {
            const commits = await gitService.getRecentCommits(parseInt(options.count), options.workspace);

            if (commits.length === 0) {
                console.log('❌ No commits found or no git repository');
                return;
            }

            if (options.json) {
                console.log(JSON.stringify(commits, null, 2));
            } else {
                console.log('📜 Commit History:');
                commits.forEach((commit, index) => {
                    console.log(`\n${index + 1}. ${commit.hash.substring(0, 7)}`);
                    console.log(`   Author: ${commit.author}`);
                    console.log(`   Date: ${commit.date.toLocaleString()}`);
                    console.log(`   Message: ${commit.message}`);
                });
            }
        } catch (error) {
            console.error('❌ Failed to get git log:', error);
        }
    });

// Git diff command
gitCommand
    .command('diff')
    .description('Show git diff')
    .argument('[file]', 'Specific file to diff')
    .option('--json', 'Output as JSON')
    .option('--workspace <path>', 'Repository path')
    .action(async (file: string, options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd()
        });

        try {
            const diffs = await gitService.getCurrentDiff(options.workspace);

            if (diffs.length === 0) {
                console.log('✅ No changes to show');
                return;
            }

            // Filter by file if specified
            const filteredDiffs = file ? diffs.filter(diff => diff.file === file) : diffs;

            if (filteredDiffs.length === 0) {
                console.log(`❌ No changes found for file: ${file}`);
                return;
            }

            if (options.json) {
                console.log(JSON.stringify(filteredDiffs, null, 2));
            } else {
                console.log('🔄 Git Diff:');
                filteredDiffs.forEach((diff, index) => {
                    console.log(`\n${index + 1}. ${diff.file}`);
                    console.log(`   Type: ${diff.type}`);
                    console.log(`   Additions: +${diff.additions}`);
                    console.log(`   Deletions: -${diff.deletions}`);

                    if (diff.content && diff.content.length < 1000) {
                        console.log('   Content:');
                        console.log('   ' + diff.content.trim().replace(/\n/g, '\n   '));
                    } else if (diff.content) {
                        console.log(`   Content: ${diff.content.length} characters (truncated)`);
                    }
                });
            }
        } catch (error) {
            console.error('❌ Failed to get git diff:', error);
        }
    });

// Git add command
gitCommand
    .command('add')
    .description('Add files to staging area')
    .argument('<files...>', 'Files to add')
    .option('--workspace <path>', 'Repository path')
  .action(async (files: string[], options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd()
        });

        try {
            console.log('📤 Adding files to staging area...');
            files.forEach(file => console.log(`   + ${file}`));

            await gitService.add(files, options.workspace);
            console.log('✅ Files added successfully');
        } catch (error) {
            console.error('❌ Failed to add files:', error);
        }
    });

// Git commit command
gitCommand
    .command('commit')
    .description('Create a commit')
    .argument('<message>', 'Commit message')
    .option('--files <files...>', 'Files to commit (adds and commits)')
    .option('--workspace <path>', 'Repository path')
    .action(async (message, options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd()
        });

        try {
            console.log(`💾 Creating commit: "${message}"`);
            if (options.files && options.files.length > 0) {
                console.log('Files to commit:');
                options.files.forEach((file: string) => console.log(`   + ${file}`));
            }

            await gitService.commit(message, options.files, options.workspace);
            console.log('✅ Commit created successfully');
        } catch (error) {
            console.error('❌ Failed to create commit:', error);
        }
    });

// Git push command
gitCommand
    .command('push')
    .description('Push commits to remote')
    .option('--remote <remote>', 'Remote name', 'origin')
    .option('--branch <branch>', 'Branch name')
    .option('--workspace <path>', 'Repository path')
    .action(async (options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd()
        });

        try {
            console.log(`📤 Pushing to ${options.remote}${options.branch ? `/${options.branch}` : ''}...`);

            await gitService.push(options.remote, options.branch, options.workspace);
            console.log('✅ Push completed successfully');
        } catch (error) {
            console.error('❌ Failed to push:', error);
        }
    });

// Git pull command
gitCommand
    .command('pull')
    .description('Pull from remote')
    .option('--remote <remote>', 'Remote name', 'origin')
    .option('--branch <branch>', 'Branch name')
    .option('--workspace <path>', 'Repository path')
    .action(async (options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd()
        });

        try {
            console.log(`📥 Pulling from ${options.remote}${options.branch ? `/${options.branch}` : ''}...`);

            await gitService.pull(options.remote, options.branch, options.workspace);
            console.log('✅ Pull completed successfully');
        } catch (error) {
            console.error('❌ Failed to pull:', error);
        }
    });

// Git branch operations
gitCommand
    .command('branch')
    .description('Branch operations')
    .option('--create <name>', 'Create new branch')
    .option('--from <source>', 'Source branch for new branch')
    .option('--switch <name>', 'Switch to branch')
    .option('--workspace <path>', 'Repository path')
    .action(async (options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd()
        });

        try {
            if (options.create) {
                console.log(`🌿 Creating branch: ${options.create}`);
                if (options.from) {
                    console.log(`   From: ${options.from}`);
                }

                await gitService.executeSafeOperation('create-branch', {
                    name: options.create,
                    from: options.from,
                    workspacePath: options.workspace
                });
                console.log('✅ Branch created successfully');

            } else if (options.switch) {
                console.log(`🔄 Switching to branch: ${options.switch}`);

                await gitService.executeSafeOperation('switch-branch', {
                    name: options.switch,
                    workspacePath: options.workspace
                });
                console.log('✅ Switched to branch successfully');

            } else {
                // Show current branch
                const repo = await gitService.getRepository(options.workspace);
                if (repo) {
                    const currentBranch = await repo.getCurrentBranch();
                    console.log(`🌿 Current branch: ${currentBranch}`);
                } else {
                    console.log('❌ No git repository found');
                }
            }
        } catch (error) {
            console.error('❌ Branch operation failed:', error);
        }
    });

// Git repository state
gitCommand
    .command('state')
    .description('Show complete repository state')
    .option('--json', 'Output as JSON')
    .option('--workspace <path>', 'Repository path')
    .action(async (options) => {
        const gitService = new CLIGitService({
            workspaceRoot: options.workspace || process.cwd()
        });

        try {
            const state = await gitService.getRepositoryState(options.workspace);

            if (!state) {
                console.log('❌ No git repository found');
                return;
            }

            if (options.json) {
                console.log(JSON.stringify(state, null, 2));
            } else {
                console.log('📊 Repository State:');
                console.log(`   Repository Root: ${state.repositoryRoot}`);
                console.log(`   Current Branch: ${state.currentBranch}`);
        console.log(`   Remote Status: ${state.remoteStatus.remote ? 'Connected' : 'No remote'}`);
        
        if (state.remoteStatus.remote) {
                    console.log(`   Remote: ${state.remoteStatus.remote}`);
                    console.log(`   Ahead: ${state.remoteStatus.ahead} commits`);
                    console.log(`   Behind: ${state.remoteStatus.behind} commits`);
                }

                console.log(`   Staged files: ${state.status.staged.length}`);
                console.log(`   Unstaged files: ${state.status.unstaged.length}`);
                console.log(`   Untracked files: ${state.status.untracked.length}`);
                console.log(`   Conflicted files: ${state.status.conflicted.length}`);
                console.log(`   Recent commits: ${state.recentCommits.length}`);
            }
        } catch (error) {
            console.error('❌ Failed to get repository state:', error);
        }
    });

// Find repositories
gitCommand
    .command('find-repos')
    .description('Find git repositories in directory')
    .argument('[path]', 'Directory to search', '.')
    .option('--json', 'Output as JSON')
    .action(async (searchPath, options) => {
        const gitService = new CLIGitService();

        try {
            console.log(`🔍 Searching for git repositories in: ${searchPath}`);
            const repositories = await gitService.findRepositories(searchPath);

            if (options.json) {
                console.log(JSON.stringify(repositories, null, 2));
            } else {
                console.log(`📁 Found ${repositories.length} git repositories:`);
                repositories.forEach((repo, index) => {
                    console.log(`   ${index + 1}. ${repo}`);
                });
            }
        } catch (error) {
            console.error('❌ Failed to find repositories:', error);
        }
    });

// Git configuration
gitCommand
    .command('config')
    .description('Show git configuration')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
        const gitService = new CLIGitService();
        const config = gitService.getConfig();

        if (options.json) {
            console.log(JSON.stringify(config, null, 2));
        } else {
            console.log('⚙️  Git Configuration:');
            console.log(`   Default Branch: ${config.defaultBranch}`);
            console.log(`   Timeout: ${config.timeoutMs}ms`);
            console.log(`   Max Buffer: ${config.maxBufferSize} bytes`);
            console.log(`   Debug: ${config.enableDebug}`);
            console.log(`   Allowed Commands: ${config.allowedCommands.join(', ')}`);
            console.log(`   Allow Destructive: ${config.safety.allowDestructive}`);
            console.log(`   Require Confirmation: ${config.safety.requireConfirmation}`);
            console.log(`   Max Commit Message Length: ${config.safety.maxCommitMessageLength}`);
        }
    });
