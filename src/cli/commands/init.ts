import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import * as fsSync from 'fs';
import * as cp from 'child_process';
import readline from 'readline';
import { isInstalled as cfIsInstalled, ensureCloudflared as cfEnsure } from '../../server/CloudflaredManager';
import { AcpHttpController } from '../../acp/AcpHttpController';

export const initCommand = new Command('init')
  .description('Initialize .on-the-go folder structure and set up prerequisites (cloudflared, Claude Code ACP)')
  .action(async () => {
    try {
      const onTheGoDir = '.on-the-go';

      // 1) Ensure .on-the-go structure (do not abort if already exists)
      let fresh = false;
      try {
        await fs.access(onTheGoDir);
        console.log('ℹ️  .on-the-go folder already exists. Continuing with environment checks...');
      } catch {
        // Directory doesn't exist, create the structure
        fresh = true;
        await fs.mkdir(onTheGoDir, { recursive: true });
        console.log('📁 Created .on-the-go/ directory');

        await fs.mkdir(path.join(onTheGoDir, 'prompts'), { recursive: true });
        console.log('📁 Created .on-the-go/prompts/ directory');

        await fs.mkdir(path.join(onTheGoDir, 'results'), { recursive: true });
        console.log('📁 Created .on-the-go/results/ directory');

        const config = {
          version: "1.0.0",
          server: { port: 3900, host: "localhost" },
          terminal: { shell: process.platform === 'win32' ? 'powershell.exe' : 'bash', cwd: process.cwd() },
          prompts: { directory: "./.on-the-go/prompts", autoSave: true },
          results: { directory: "./.on-the-go/results", format: "json" },
          created: new Date().toISOString(),
          lastModified: new Date().toISOString()
        } as const;
        await fs.writeFile(path.join(onTheGoDir, 'config.json'), JSON.stringify(config, null, 2));
        console.log('📄 Created .on-the-go/config.json');

        const examplePrompt = {
          name: "example-prompt",
          description: "Example prompt template",
          template: "Hello {{name}}! Welcome to {{app}}.",
          variables: ["name", "app"],
          created: new Date().toISOString()
        } as const;
        await fs.writeFile(path.join(onTheGoDir, 'prompts', 'example.json'), JSON.stringify(examplePrompt, null, 2));
        console.log('📄 Created .on-the-go/prompts/example.json');

        const readme = `# .on-the-go Folder

This folder contains configuration and data for Kiro Remote CLI.

## Structure

- \`config.json\` - Main configuration file
- \`prompts/\` - Prompt templates and configurations
- \`results/\` - Output results and logs

## Configuration

The \`config.json\` file contains settings for:
- Server configuration (port, host)
- Terminal settings (shell, working directory)
- Prompt management
- Result formatting

## Usage

Run \`kiro-remote start\` to launch the server with this configuration.

Created: ${new Date().toISOString()}
`;
        await fs.writeFile(path.join(onTheGoDir, 'README.md'), readme);
        console.log('📄 Created .on-the-go/README.md');
      }

      if (fresh) {
        console.log('\n✅ .on-the-go folder structure created successfully!');
        console.log('\n📁 Structure:');
        console.log('   .on-the-go/');
        console.log('   ├── config.json');
        console.log('   ├── prompts/');
        console.log('   │   └── example.json');
        console.log('   ├── results/');
        console.log('   └── README.md');
      }

      // 2) Environment checks and setup
      console.log('\n🔧 Running environment checks...');
      await ensureCloudflaredFlow();
      const agentOk = await ensureClaudeAgentFlow();
      if (agentOk) {
        await maybeAuthenticateClaudeAgent();
      }

      console.log('\n🎉 Setup complete. Next steps:');
      console.log('   • Start the server:   kiro-remote start');
      console.log('   • Open the app at:    http://localhost:3900');
      console.log('   • Use the ACP tab to manage agent sessions and auth if needed.');

    } catch (error) {
      console.error('❌ Failed to initialize:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ------------------------------
// Helpers
// ------------------------------

function askYesNo(question: string, defaultYes = false): Promise<boolean> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) return resolve(defaultYes);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
    rl.question(question + suffix, (answer) => {
      rl.close();
      const a = String(answer || '').trim().toLowerCase();
      if (!a) return resolve(defaultYes);
      resolve(a === 'y' || a === 'yes');
    });
  });
}

function askSelectIndex(question: string, choices: string[], defaultIndex = 0): Promise<number> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) return resolve(defaultIndex);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(question);
    choices.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
    rl.question(`Select [1-${choices.length}] (default ${defaultIndex + 1}): `, (ans) => {
      rl.close();
      const n = parseInt(String(ans).trim(), 10);
      if (!isFinite(n) || n < 1 || n > choices.length) return resolve(defaultIndex);
      resolve(n - 1);
    });
  });
}

async function ensureCloudflaredFlow(): Promise<void> {
  try {
    const installed = await cfIsInstalled();
    if (installed) {
      console.log('✅ cloudflared: found');
      return;
    }
    const ok = await askYesNo('cloudflared is not installed. Install it now?', true);
    if (!ok) {
      console.log('⏭️  Skipping cloudflared install. You can install later from the Tunnels page or re-run init.');
      return;
    }
    process.stdout.write('⬇️  Installing cloudflared... ');
    const bin = await cfEnsure(undefined);
    console.log(`done. Installed at: ${bin}`);
  } catch (e: any) {
    console.warn('⚠️  cloudflared setup skipped:', e?.message || String(e));
  }
}

function hasLocalClaudeAgent(): { found: boolean; path?: string } {
  const nodePath = path.join(process.cwd(), 'node_modules', '@zed-industries', 'claude-code-acp', 'dist', 'index.js');
  const workspacePath = path.join(process.cwd(), 'claude-code-acp', 'dist', 'index.js');
  if (fsSync.existsSync(nodePath)) return { found: true, path: nodePath };
  if (fsSync.existsSync(workspacePath)) return { found: true, path: workspacePath };
  return { found: false };
}

async function runNpmInstall(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'npm' : 'npm';
    const child = cp.spawn(cmd, args, { stdio: 'inherit', shell: true });
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

async function ensureClaudeAgentFlow(): Promise<boolean> {
  const local = hasLocalClaudeAgent();
  if (local.found) {
    console.log('✅ Claude Code ACP agent: found');
    return true;
  }
  console.log('ℹ️  Claude Code ACP agent not found in this project.');
  const ok = await askYesNo('Install @zed-industries/claude-code-acp locally now (npm install)?', true);
  if (!ok) {
    console.log('⏭️  Skipping local install. We can run the agent via npx when needed.');
    return true; // Allow proceeding (AcpHttpController will fall back to npx)
  }
  console.log('⬇️  Installing @zed-industries/claude-code-acp...');
  const code = await runNpmInstall(['install', '@zed-industries/claude-code-acp', '--save-dev']);
  if (code !== 0) {
    console.warn('⚠️  Installation failed. You can try again later or rely on npx fallback.');
    return false; // proceed but auth flow might still work through npx
  }
  const post = hasLocalClaudeAgent();
  console.log(post.found ? '✅ Installed successfully.' : '⚠️  Install completed but agent not detected. npx fallback will be used.');
  return true;
}

function extractMethodId(m: any): string | undefined {
  if (!m || typeof m !== 'object') return undefined;
  return (m.id && String(m.id)) || (m.methodId && String(m.methodId)) || (m.method_id && String(m.method_id)) || undefined;
}

async function maybeAuthenticateClaudeAgent(): Promise<void> {
  try {
    const want = await askYesNo('Would you like to authenticate the Claude Code agent now for the best experience?', true);
    if (!want) { console.log('⏭️  Skipping agent authentication. You can do this later from the ACP tab.'); return; }

    const acp = new AcpHttpController();
    await acp.init();
    process.stdout.write('🔌 Starting Claude Code agent... ');
    await acp.connect({});
    console.log('connected.');
    const methods = acp.getAuthMethods() || [];
    if (!methods.length) {
      console.log('✅ Agent is ready and did not report any authentication methods.');
      try { await acp.disconnect(); } catch {}
      return;
    }
    const labels = methods.map((m: any, i: number) => {
      const id = extractMethodId(m) || `method_${i+1}`;
      const name = (m && (m.name || m.label || m.provider)) ? (m.name || m.label || m.provider) : id;
      return `${name} (${id})`;
    });
    const idx = await askSelectIndex('Select an authentication method:', labels, 0);
    const methodId = extractMethodId(methods[idx]);
    if (!methodId) {
      console.warn('⚠️  Could not determine methodId. Skipping automatic authentication. Open the ACP tab to authenticate.');
      try { await acp.disconnect(); } catch {}
      return;
    }
    console.log(`🔐 Initiating authentication via: ${labels[idx]}`);
    await acp.authenticate({ methodId });
    console.log('📣 If a browser window opened or a link was printed, please complete the login there.');
    console.log('   You can revisit auth later at any time via the ACP tab in the UI.');
    try { await acp.disconnect(); } catch {}
  } catch (e: any) {
    console.warn('⚠️  Authentication flow skipped:', e?.message || String(e));
  }
}