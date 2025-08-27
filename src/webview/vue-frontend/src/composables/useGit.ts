import { ref, computed, onUnmounted, type Ref } from 'vue'
import type { 
  GitRepository,
  GitBranch,
  GitCommit,
  GitFile,
  GitDiff,
  GitFileStatus
} from '../types/git'

import { useCommands } from './useCommands'
import { 
  GIT_COMMAND_TIMEOUT,
  GIT_STATUS_REFRESH_INTERVAL,
  GIT_MAX_COMMIT_HISTORY,
  GIT_DIFF_CONTEXT_LINES
} from '../utils/constants'

export interface GitOperationOptions {
  timeout?: number
  refresh?: boolean
}

export interface GitComposable {
  isLoading: Ref<boolean>
  repository: Ref<GitRepository | null>
  currentBranch: Ref<string | null>
  branches: Ref<GitBranch[]>
  status: Ref<GitFile[]>
  stagedFiles: Ref<GitFile[]>
  unstagedFiles: Ref<GitFile[]>
  untrackedFiles: Ref<GitFile[]>
  commitHistory: Ref<GitCommit[]>
  hasChanges: Ref<boolean>
  
  initRepository: () => Promise<void>
  getStatus: (options?: GitOperationOptions) => Promise<GitFile[]>
  getBranches: (options?: GitOperationOptions) => Promise<GitBranch[]>
  getCurrentBranch: () => Promise<string | null>
  switchBranch: (branchName: string) => Promise<void>
  createBranch: (branchName: string, checkout?: boolean) => Promise<void>
  deleteBranch: (branchName: string, force?: boolean) => Promise<void>
  stageFile: (filePath: string) => Promise<void>
  unstageFile: (filePath: string) => Promise<void>
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  commit: (message: string, amend?: boolean) => Promise<void>
  getCommitHistory: (limit?: number, options?: GitOperationOptions) => Promise<GitCommit[]>
  push: (remote?: string, branch?: string, force?: boolean) => Promise<void>
  pull: (remote?: string, branch?: string) => Promise<void>
  fetch: (remote?: string) => Promise<void>
  getDiff: (filePath?: string, staged?: boolean) => Promise<GitDiff[]>
  refreshStatus: () => Promise<void>
  startAutoRefresh: (interval?: number) => void
  stopAutoRefresh: () => void
}

export function useGit(): GitComposable {
  const { executeCommand } = useCommands()
  
  const isLoading = ref(false)
  const repository = ref<GitRepository | null>(null)
  const currentBranch = ref<string | null>(null)
  const branches = ref<GitBranch[]>([])
  const status = ref<GitFile[]>([])
  const commitHistory = ref<GitCommit[]>([])
  const autoRefreshTimer = ref<NodeJS.Timeout | null>(null)

  const stagedFiles = computed(() => 
    status.value.filter(file => file.staged)
  )
  
  const unstagedFiles = computed(() => 
    status.value.filter(file => !file.staged && file.status !== '??')
  )
  
  const untrackedFiles = computed(() => 
    status.value.filter(file => file.status === '??')
  )
  
  const hasChanges = computed(() => status.value.length > 0)

  // Helper function to parse Git file status
  const parseGitFile = (fileData: any): GitFile => {
    return {
      path: fileData.path || '',
      status: fileData.status as GitFileStatus || 'M',
      staged: fileData.staged || false,
      additions: fileData.additions,
      deletions: fileData.deletions
    }
  }

  // Helper function to parse Git branch data
  const parseGitBranch = (branchData: any): GitBranch => {
    return {
      name: branchData.name || '',
      current: branchData.current || false,
      remote: branchData.remote,
      ahead: branchData.ahead || 0,
      behind: branchData.behind || 0
    }
  }

  // Helper function to parse Git commit data
  const parseGitCommit = (commitData: any): GitCommit => {
    return {
      hash: commitData.hash || '',
      shortHash: commitData.shortHash || commitData.hash?.substring(0, 7) || '',
      message: commitData.message || '',
      author: {
        name: commitData.author?.name || '',
        email: commitData.author?.email || ''
      },
      date: new Date(commitData.date || Date.now()),
      files: Array.isArray(commitData.files) ? commitData.files.map(parseGitFile) : []
    }
  }

  const initRepository = async (): Promise<void> => {
    isLoading.value = true
    try {
      await executeCommand('git.init')
      await refreshStatus()
    } catch (error) {
      console.error('Failed to initialize Git repository:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const getStatus = async (options: GitOperationOptions = {}): Promise<GitFile[]> => {
    const { timeout = GIT_COMMAND_TIMEOUT, refresh = true } = options
    
    try {
      const result = await executeCommand('git.status', [], { timeout })
      const gitFiles: GitFile[] = Array.isArray(result) ? result.map(parseGitFile) : []
      
      if (refresh) {
        status.value = gitFiles
      }
      
      return gitFiles
    } catch (error) {
      console.error('Failed to get Git status:', error)
      throw error
    }
  }

  const getBranches = async (options: GitOperationOptions = {}): Promise<GitBranch[]> => {
    const { timeout = GIT_COMMAND_TIMEOUT, refresh = true } = options
    
    try {
      const result = await executeCommand('git.branch', ['-a'], { timeout })
      const gitBranches: GitBranch[] = Array.isArray(result) ? result.map(parseGitBranch) : []
      
      if (refresh) {
        branches.value = gitBranches
        const current = gitBranches.find(branch => branch.current)
        currentBranch.value = current?.name || null
      }
      
      return gitBranches
    } catch (error) {
      console.error('Failed to get Git branches:', error)
      throw error
    }
  }

  const getCurrentBranch = async (): Promise<string | null> => {
    try {
      const result = await executeCommand('git.currentBranch')
      const branchName = typeof result === 'string' ? result : null
      currentBranch.value = branchName
      return branchName
    } catch (error) {
      console.error('Failed to get current branch:', error)
      throw error
    }
  }

  const switchBranch = async (branchName: string): Promise<void> => {
    isLoading.value = true
    try {
      await executeCommand('git.checkout', [branchName])
      currentBranch.value = branchName
      await refreshStatus()
    } catch (error) {
      console.error(`Failed to switch to branch ${branchName}:`, error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const createBranch = async (branchName: string, checkout = true): Promise<void> => {
    isLoading.value = true
    try {
      const args = checkout ? ['-b', branchName] : [branchName]
      await executeCommand('git.branch', args)
      
      if (checkout) {
        currentBranch.value = branchName
      }
      
      await getBranches()
      await refreshStatus()
    } catch (error) {
      console.error(`Failed to create branch ${branchName}:`, error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const deleteBranch = async (branchName: string, force = false): Promise<void> => {
    isLoading.value = true
    try {
      const flag = force ? '-D' : '-d'
      await executeCommand('git.branch', [flag, branchName])
      await getBranches()
    } catch (error) {
      console.error(`Failed to delete branch ${branchName}:`, error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const stageFile = async (filePath: string): Promise<void> => {
    try {
      await executeCommand('git.add', [filePath])
      await refreshStatus()
    } catch (error) {
      console.error(`Failed to stage file ${filePath}:`, error)
      throw error
    }
  }

  const unstageFile = async (filePath: string): Promise<void> => {
    try {
      await executeCommand('git.reset', ['HEAD', filePath])
      await refreshStatus()
    } catch (error) {
      console.error(`Failed to unstage file ${filePath}:`, error)
      throw error
    }
  }

  const stageAll = async (): Promise<void> => {
    try {
      await executeCommand('git.add', ['.'])
      await refreshStatus()
    } catch (error) {
      console.error('Failed to stage all files:', error)
      throw error
    }
  }

  const unstageAll = async (): Promise<void> => {
    try {
      await executeCommand('git.reset', ['HEAD'])
      await refreshStatus()
    } catch (error) {
      console.error('Failed to unstage all files:', error)
      throw error
    }
  }

  const commit = async (message: string, amend = false): Promise<void> => {
    isLoading.value = true
    try {
      const args = amend ? ['--amend', '-m', message] : ['-m', message]
      await executeCommand('git.commit', args)
      await refreshStatus()
      await getCommitHistory(GIT_MAX_COMMIT_HISTORY)
    } catch (error) {
      console.error('Failed to commit changes:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const getCommitHistory = async (limit = GIT_MAX_COMMIT_HISTORY, options: GitOperationOptions = {}): Promise<GitCommit[]> => {
    const { timeout = GIT_COMMAND_TIMEOUT, refresh = true } = options
    
    try {
      const result = await executeCommand('git.log', [`--max-count=${limit}`, '--pretty=format:%H|%h|%s|%an|%ae|%ad'], { timeout })
      const commits: GitCommit[] = Array.isArray(result) ? result.map(parseGitCommit) : []
      
      if (refresh) {
        commitHistory.value = commits
      }
      
      return commits
    } catch (error) {
      console.error('Failed to get commit history:', error)
      throw error
    }
  }

  const push = async (remote = 'origin', branch?: string, force = false): Promise<void> => {
    isLoading.value = true
    try {
      const targetBranch = branch || currentBranch.value
      if (!targetBranch) {
        throw new Error('No branch specified and no current branch found')
      }
      
      const args = [remote, targetBranch]
      if (force) {
        args.unshift('--force')
      }
      
      await executeCommand('git.push', args)
      await refreshStatus()
    } catch (error) {
      console.error('Failed to push changes:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const pull = async (remote = 'origin', branch?: string): Promise<void> => {
    isLoading.value = true
    try {
      const targetBranch = branch || currentBranch.value
      const args = targetBranch ? [remote, targetBranch] : [remote]
      
      await executeCommand('git.pull', args)
      await refreshStatus()
      await getCommitHistory(GIT_MAX_COMMIT_HISTORY)
    } catch (error) {
      console.error('Failed to pull changes:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const fetch = async (remote = 'origin'): Promise<void> => {
    isLoading.value = true
    try {
      await executeCommand('git.fetch', [remote])
      await getBranches()
      await refreshStatus()
    } catch (error) {
      console.error('Failed to fetch changes:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const getDiff = async (filePath?: string, staged = false): Promise<GitDiff[]> => {
    try {
      const args = []
      if (staged) {
        args.push('--staged')
      }
      args.push(`--unified=${GIT_DIFF_CONTEXT_LINES}`)
      
      if (filePath) {
        args.push(filePath)
      }
      
      const result = await executeCommand('git.diff', args)
      // Parse diff result - this would need more complex parsing in a real implementation
      return Array.isArray(result) ? result : []
    } catch (error) {
      console.error('Failed to get diff:', error)
      throw error
    }
  }

  const refreshStatus = async (): Promise<void> => {
    try {
      await Promise.all([
        getStatus(),
        getBranches(),
        getCurrentBranch()
      ])
    } catch (error) {
      console.error('Failed to refresh Git status:', error)
      throw error
    }
  }

  const startAutoRefresh = (interval = GIT_STATUS_REFRESH_INTERVAL): void => {
    stopAutoRefresh()
    autoRefreshTimer.value = setInterval(() => {
      refreshStatus().catch(error => {
        console.error('Auto-refresh failed:', error)
      })
    }, interval)
  }

  const stopAutoRefresh = (): void => {
    if (autoRefreshTimer.value) {
      clearInterval(autoRefreshTimer.value)
      autoRefreshTimer.value = null
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopAutoRefresh()
  })

  return {
    isLoading,
    repository,
    currentBranch,
    branches,
    status,
    stagedFiles,
    unstagedFiles,
    untrackedFiles,
    commitHistory,
    hasChanges,
    initRepository,
    getStatus,
    getBranches,
    getCurrentBranch,
    switchBranch,
    createBranch,
    deleteBranch,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    commit,
    getCommitHistory,
    push,
    pull,
    fetch,
    getDiff,
    refreshStatus,
    startAutoRefresh,
    stopAutoRefresh
  }
}