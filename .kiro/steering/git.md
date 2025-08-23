---
inclusion: always
---

# Git Workflow & Conventions
## VERY IMPORTANT
- MAKE SURE is in the correct branch before start coding
- CHECK git hygine before start coding

## Branch Strategy
- **main**: Production-ready code, all releases tagged here
- **dev**: Integration branch for feature development
- **feature/***: Single-purpose branches from dev (e.g., `feature/websocket-auth`)
- **hotfix/***: Critical fixes branched from main

## Commit Guidelines
- Use present tense imperative: "Add WebSocket authentication", "Fix path validation"
- Keep commits atomic and focused on single changes
- Reference issues when applicable: "Fix #123: Handle WebSocket connection errors"
- Prefix extension-specific commits: "ext: Add status bar toggle"

## Development Workflow
1. Branch from latest dev: `git checkout dev && git pull && git checkout -b feature/name`
2. Make focused commits with clear messages
3. Rebase on dev regularly: `git fetch && git rebase origin/dev`
4. Open PR to dev early for feedback
5. Squash-merge after approval

## Pull Request Requirements
- Clear title describing the change
- Link related issues or specs
- Update tests for new functionality
- Update README.md if user-facing changes
- Ensure CI passes (compile, lint, test)
- Keep diffs small and reviewable

## Release Process
- Merge stable dev to main via PR
- Tag releases using SemVer: `v1.2.3`
- Update package.json version before tagging
- Generate changelog for VS Code marketplace

## Extension-Specific Rules
- Test changes with VS Code extension host
- Verify WebSocket and HTTP server functionality
- Check file operations work in test-workspace
- Ensure configuration changes are backward compatible
- Update extension manifest (package.json) for new features

## Quality Gates
- All tests pass (`npm test`)
- No ESLint warnings (`npm run lint`)
- TypeScript compiles without errors (`npm run compile`)
- Extension activates successfully in VS Code