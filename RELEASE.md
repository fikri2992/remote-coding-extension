# Release Guide

This project ships as an npm package (global CLI) and optionally as cross-platform binaries built with `pkg`.

## Prerequisites

- Node.js 18+
- npm logged in: `npm whoami` (use `npm login` if needed)
- Public package: ensure first publish uses `--access public`

## Dry Run (Local Tarball)

```
# Windows (cmd):
scripts\release-dry-run.bat

# Steps performed:
# 1) Unlink and uninstall any global installs
# 2) Build (agent + compile + react)
# 3) npm pack to create a tarball
# 4) npm i -g <tarball>
# 5) Verify: cotg-cli --help
```

## Prerelease to `next`

```
npm run release:next
# => bumps to x.y.z-next.n, publishes with tag=next

# Verify:
npx -y coding-on-the-go@next cotg-cli --help
```

## Stable Release

Pick one based on changes:

```
# Patch
npm run release:patch

# Minor
npm run release:minor

# Major
npm run release:major

# Verify latest
npx -y coding-on-the-go cotg-cli --help
```

Note: `prepublishOnly` runs `npm run build` so published packages include compiled CLI and web assets.

## Binaries (Optional)

Build self-contained binaries via `pkg`:

```
npm run build:cli-only
dir dist

# Windows: dist\cotg-cli-win.exe
# macOS:   dist/cotg-cli-macos
# Linux:   dist/cotg-cli-linux
```

Attach binaries to GitHub Releases for users who prefer direct executables.

