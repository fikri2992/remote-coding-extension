# Git — Mobile-First Commit History and Diff Viewer

Outcome: A two-screen mobile application for viewing git commit history and examining code changes. Built with React and Tailwind CSS for optimal mobile experience. Builds on existing `GitService`.

## Architecture Overview

**Main Components:**
- `GitHistoryViewer` - handles navigation between history list and diff view
- `CommitDiff` - displays detailed file changes for a selected commit
- State management via React `useState` for view switching and file expansion
- Tailwind CSS with consistent design system for mobile-first UI

**Current State:**
- `src/server/GitService.ts` already exposes rich helpers (status, log, diff, commit, push, pull, branches)

## Protocol (WS v1)

**Envelope:** `{ type: 'git', id?, data: { gitData: { operation, options? } } }`

**Primary Operations for History/Diff Viewer:**
- `log`: Fetch commit history with metadata. `options: { count?, since?, author? }`
- `show`: Get detailed commit info including file changes. `options: { commitHash }`
- `diff`: Get diff between commits or working tree. `options: { from?, to?, file? }`
- `status`: Current repository state for context
- `branch`: Current branch info for header display

**Response Format:**
- `log`: Array of commits with hash, message, author, date, files changed
- `show`: Commit details with full file diffs and metadata
- `diff`: Unified diff format with file paths and change statistics

## Server Implementation

**Core Tasks:**
- WS routing: Handle `type === 'git'` and forward to `GitService` operations
- Commit parsing: Extract metadata (author, date, message, files) from git log
- Diff processing: Generate unified diffs with proper formatting and syntax highlighting hints
- Performance optimization: Paginate commit history, limit diff sizes (>200KB truncated)
- Error handling: Normalize git errors to user-friendly messages

**Security & Performance:**
- Workspace boundary validation for all git operations
- Read-only operations only (no destructive commands)
- Diff size limits with "view more" functionality
- Commit history pagination (default 50 commits per page)

## Frontend Implementation (Mobile-First UI)

**Two-Screen Navigation:**
- **History View**: Scrollable list of commit cards with metadata
- **Diff View**: Detailed file changes for selected commit with back navigation

**Key UI Components:**
- `GitHistoryViewer.tsx`: Main container handling view state and navigation
- `CommitCard.tsx`: Individual commit display with touch-friendly design
- `CommitDiff.tsx`: Expandable file diff viewer with syntax highlighting
- `DiffFile.tsx`: Individual file change component with expand/collapse

**Mobile-First Design Features:**
- Large touch targets (min 44px) for all interactive elements
- Readable typography (text-xl for commit messages, text-lg for metadata)
- Generous spacing and padding for thumb navigation
- Color-coded additions/deletions with high contrast
- Smooth transitions and hover states for touch feedback
- Pull-to-refresh functionality for commit history updates

**Interactive Elements:**
- Tap commit card → Navigate to diff view
- Tap back arrow → Return to history list
- Tap file header → Expand/collapse individual file diff
- Expand/Collapse All buttons → Bulk control over file visibility
- Infinite scroll for commit history pagination

## Implementation Checklist

**Server Tasks:**
- [ ] Implement WS `git` routing with proper operation handling
- [ ] Add commit history pagination with metadata extraction
- [ ] Implement commit diff generation with file change statistics
- [ ] Add diff size limiting and truncation with "view more" hints
- [ ] Error handling for common git scenarios (empty repo, detached HEAD)

**Frontend Tasks:**
- [ ] Build `GitHistoryViewer` with two-screen navigation
- [ ] Create responsive commit cards with metadata display
- [ ] Implement expandable diff viewer with syntax highlighting areas
- [ ] Add touch-friendly interactions and animations
- [ ] Implement pull-to-refresh and infinite scroll
- [ ] Error states and loading indicators

**Mobile UX Tasks:**
- [ ] Optimize for thumb navigation with large touch targets
- [ ] Ensure readability in various lighting conditions
- [ ] Test scroll performance with large commit histories
- [ ] Implement smooth transitions between views
- [ ] Add haptic feedback for key interactions (if supported)

## Acceptance Criteria

**Performance:**
- Commit history loads under 500ms for repos with <1000 commits
- Diff view renders under 300ms for files <100KB
- Smooth 60fps scrolling through commit history
- Graceful degradation for large diffs with virtualization

**Mobile Experience:**
- All interactive elements easily tappable with thumb
- Readable text at arm's length on mobile devices
- Smooth navigation between history and diff views
- Works well in portrait and landscape orientations
- Accessible color contrast ratios (WCAG AA compliant)

**Functionality:**
- Display commit metadata: hash, message, author, date, files changed
- Show file-by-file diffs with addition/deletion statistics
- Handle edge cases: empty repos, merge commits, binary files
- Provide clear error messages for git operation failures