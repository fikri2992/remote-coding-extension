#!/usr/bin/env node
/*
 * Release helper: builds and publishes the CLI (and optional workspaces) to npm.
 *
 * Usage examples:
 *   node scripts/publish-all.js --tag latest --bump patch
 *   node scripts/publish-all.js --tag next --bump prerelease --preid next
 *   node scripts/publish-all.js --dry-run
 *
 * Flags:
 *   --tag <distTag>        npm dist-tag to use (default: latest)
 *   --bump <type>          version bump: patch|minor|major|prerelease (optional)
 *   --preid <id>           preid for prerelease (e.g., next)
 *   --no-agent             skip building workspace agent packages
 *   --dry-run              run through without publishing
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function runCapture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32', ...opts });
  if (res.status !== 0) {
    const err = (res.stderr || Buffer.from('')).toString();
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}\n${err}`);
  }
  return (res.stdout || Buffer.from('')).toString().trim();
}

function hasWorkspace(dir) {
  try { return fs.existsSync(path.join(dir, 'package.json')); } catch { return false; }
}

function parseArgs(argv) {
  const out = { tag: 'latest', bump: null, preid: null, agent: true, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tag') out.tag = String(argv[++i] || 'latest');
    else if (a === '--bump') out.bump = String(argv[++i] || '');
    else if (a === '--preid') out.preid = String(argv[++i] || 'next');
    else if (a === '--no-agent') out.agent = false;
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

(async () => {
  const opts = parseArgs(process.argv);
  const cwd = process.cwd();

  console.log('Release: starting');

  // 1) Verify npm auth
  try {
    const who = runCapture('npm', ['whoami']);
    console.log(`npm: authenticated as ${who}`);
  } catch (e) {
    console.error('npm authentication check failed. Run `npm login` and retry.');
    throw e;
  }

  // 2) Optionally bump version
  if (opts.bump) {
    const inGit = (() => {
      try {
        const out = runCapture('git', ['rev-parse', '--is-inside-work-tree']);
        return out.trim() === 'true';
      } catch { return false; }
    })();

    // npm v10 removed -m; use default message when in git, or bump JSON only when not in git
    const args = ['version'];
    if (opts.bump === 'prerelease' && opts.preid) {
      args.push('--preid', opts.preid, 'prerelease');
    } else {
      args.push(opts.bump);
    }
    if (!inGit) args.push('--no-git-tag-version');
    console.log(`Version bump: npm ${args.join(' ')}`);
    run('npm', args);
  }

  // 3) Build (optionally agent workspace)
  if (opts.agent && hasWorkspace(path.join(cwd, 'claude-code-acp'))) {
    console.log('Building workspace agent (claude-code-acp)...');
    run('npm', ['run', '-w', 'claude-code-acp', 'build']);
  } else {
    console.log('Skipping workspace agent build');
  }

  console.log('Building CLI...');
  run('npm', ['run', 'build']);

  // 4) Pack preview
  console.log('Packing preview...');
  run('npm', ['pack']);

  if (opts.dryRun) {
    console.log('Dry run: stopping before publish.');
    return;
  }

  // 5) Publish CLI
  console.log(`Publishing CLI to npm (tag=${opts.tag})...`);
  run('npm', ['publish', '--access', 'public', '--tag', opts.tag]);

  // Optional: publish agent workspace if not private and requested
  if (opts.agent) {
    const agentDir = path.join(cwd, 'claude-code-acp');
    if (hasWorkspace(agentDir)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(agentDir, 'package.json'), 'utf8'));
        if (!pkg.private) {
          console.log(`Publishing workspace package '${pkg.name}' (from claude-code-acp)...`);
          run('npm', ['publish', '--access', 'public'], { cwd: agentDir });
        } else {
          console.log('Workspace package is private; skipping publish.');
        }
      } catch (e) {
        console.warn('Skipping workspace publish (could not read package.json):', e.message || String(e));
      }
    }
  }

  console.log('Release: completed successfully');
})().catch((err) => {
  console.error('Release failed:', err && (err.stack || err.message) || err);
  process.exit(1);
});
