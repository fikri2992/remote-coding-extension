# Git — Mobile Cards for Status, Diffs, and Commits

Outcome: Clean, legible Git overview on mobile with staged/unstaged/untracked lists, commit creation, push/pull, and basic diffs. Builds on existing `GitService`.

Current state

- `src/server/GitService.ts` already exposes rich helpers (status, log, diff, commit, push, pull, branches).

Protocol (WS v1)

- Envelope: `{ type: 'git', id?, data: { gitData: { operation, options? } } }`
- Operations: `status | log | diff | branch | commit | push | pull`
  - `status`: returns `GitRepositoryState` (see `interfaces.ts`).
  - `log`: last N commits. `options.count`.
  - `diff`: diff for working tree and index.
  - `branch`: list heads; current indicated by `currentBranch` from status.
  - `commit`: `{ message, files? }` (stage optional files then commit).
  - `push` / `pull`: run and report success/errors.

Server tasks

- WS routing: Add case `type === 'git'` and forward to `GitService.executeGitCommand` with `gitData.operation`.
- Error mapping: Normalize errors to readable client messages; include suggestions (auth, remotes).
- Security: Confirm cwd inside workspace; disallow destructive ops (reset, clean) in v1.
- Performance: Limit diff sizes; truncate with “view more” hints.

Frontend tasks (UI flows)

- `GitPage.tsx` (build UI):
  - Header cards: current branch, ahead/behind, repo root.
  - Status lists: staged, unstaged, untracked, conflicted with colored chips.
  - Actions: stage/unstage (phase 2), commit input with template helpers, push/pull.
  - Diff viewer: inline unified diff chunks; expandable for large files.
  - Branches: quick switch (phase 2) + create branch.
  - Error cases: credential issues, detached head, unresolved merges.

Checklists

- Server
  - [ ] Implement WS `git` routing in `WebSocketServer` or `ServerManager` bridge.
  - [ ] Wrap `GitService` results into `gitData.result` for consistency.
  - [ ] Truncate diffs > 200KB with notice; allow explicit fetch more.
- Frontend
  - [ ] Card layout with big touch targets; bold colors for states.
  - [ ] Commit composer with message lint hints (subject ≤ 50 chars).
  - [ ] Pull‑to‑refresh and auto‑refresh on FS changes.
  - [ ] Error banners with action buttons (Open Auth, Retry).
- QA
  - [ ] Empty repo handling (no HEAD).
  - [ ] Ahead/behind reflects remote; push blocked → clear error.
  - [ ] Large diffs don’t lock UI; virtualization works.

Acceptance criteria

- Status loads under 700ms for small repos; diffs degrade gracefully.
- Commit then push from phone with < 5 taps.
- Visual states readable outdoors (contrast and color use OK).

