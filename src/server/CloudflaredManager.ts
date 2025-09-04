import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as cp from 'child_process';

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Read tunnel startup timeout from settings (default 60s)
function getTunnelStartTimeoutMs(): number {
  try {
    const cfg = vscode.workspace.getConfiguration('webAutomationTunnel');
    const ms = cfg.get<number>('tunnelStartTimeoutMs', 60000);
    return typeof ms === 'number' && ms > 0 ? ms : 60000;
  } catch {
    return 60000;
  }
}

// -------------------------
export interface TunnelInfo {
  id: string;
  name?: string;
  url: string;
  localPort: number;
  pid: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  type: 'quick' | 'named';
  token?: string;
  createdAt: Date;
  error?: string;
}

export interface CreateTunnelRequest {
  localPort: number;
  name?: string;
  token?: string;
  type: 'quick' | 'named';
}

export interface TunnelStatus {
  isInstalled: boolean;
  activeTunnels: TunnelInfo[];
  totalCount: number;
}

// -------------------------
let activeTunnels: Map<string, TunnelInfo> = new Map();
// Keep strong references to child processes to avoid stdout/stderr pipe backpressure and GC
const tunnelProcesses: Map<string, cp.ChildProcess> = new Map();

/** Check if cloudflared is installed/available */
export async function isInstalled(): Promise<boolean> {
  if (await isInPath()) return true;
  // Check cached install location heuristic
  const home = os.homedir();
  const guess = process.platform === 'win32'
    ? path.join(home, '.vscode-cloudflared', 'cloudflared.exe')
    : path.join(home, '.vscode-cloudflared', 'cloudflared');
  return fileExists(guess);
}

/** Install cloudflared (or return existing path) */
export async function install(context?: vscode.ExtensionContext): Promise<string> {
  return ensureCloudflared(context);
}

/**
 * Create a new tunnel
 */
export async function createTunnel(request: CreateTunnelRequest, context?: vscode.ExtensionContext): Promise<TunnelInfo> {
  const tunnelId = `tunnel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const tunnelInfo: TunnelInfo = {
    id: tunnelId,
    localPort: request.localPort,
    status: 'starting',
    type: request.type,
    createdAt: new Date(),
    url: '', // Will be set when tunnel starts
    pid: 0,  // Will be set when tunnel starts
    ...(request.name && { name: request.name }),
    ...(request.token && { token: request.token }),
  };

  activeTunnels.set(tunnelId, tunnelInfo);

  try {
    const result = request.type === 'quick'
      ? await startQuickTunnel(request.localPort, context)
      : await startNamedTunnel(request.localPort, request.name, request.token, context);

    // Update tunnel with actual info
    const updatedTunnel: TunnelInfo = {
      ...tunnelInfo,
      url: result.url,
      pid: result.pid,
      status: 'running',
    };

    activeTunnels.set(tunnelId, updatedTunnel);
    // Keep process reference and drain output to avoid blocking
    if ((result as any).proc) {
      const proc = (result as any).proc as cp.ChildProcess;
      // Drain to prevent pipe backpressure
      proc.stdout?.on('data', () => {});
      proc.stderr?.on('data', () => {});
      tunnelProcesses.set(tunnelId, proc);
      // Cleanup on exit
      proc.on('exit', () => {
        tunnelProcesses.delete(tunnelId);
        const t = activeTunnels.get(tunnelId);
        if (t) activeTunnels.set(tunnelId, { ...t, status: 'stopped' });
      });
    }
    return updatedTunnel;
  } catch (error) {
    // Update tunnel with error
    const errorTunnel: TunnelInfo = {
      ...tunnelInfo,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to start tunnel',
    };

    activeTunnels.set(tunnelId, errorTunnel);
    throw error;
  }
}

/**
 * Get all active tunnels
 */
export function getActiveTunnels(): TunnelInfo[] {
  return Array.from(activeTunnels.values());
}

/**
 * Get tunnel by ID
 */
export function getTunnelById(tunnelId: string): TunnelInfo | undefined {
  return activeTunnels.get(tunnelId);
}

/**
 * Stop a tunnel by its generated ID
 */
export async function stopTunnelById(tunnelId: string): Promise<boolean> {
  const info = activeTunnels.get(tunnelId);
  if (!info) return false;
  let ok = false;
  try {
    const proc = tunnelProcesses.get(tunnelId);
    if (proc && proc.pid) {
      ok = await stopTunnelByPid(proc.pid);
    } else {
      ok = await stopTunnelByPid(info.pid);
    }
  } finally {
    try { tunnelProcesses.get(tunnelId)?.removeAllListeners(); } catch {}
    tunnelProcesses.delete(tunnelId);
  }
  activeTunnels.delete(tunnelId);
  return ok;
}

/**
 * Stop all active tunnels
 */
export async function stopAllTunnels(): Promise<number> {
  const ids = Array.from(activeTunnels.keys());
  let count = 0;
  for (const id of ids) {
    try {
      const ok = await stopTunnelById(id);
      if (ok) count++;
    } catch {
      // ignore
    }
  }
  return count;
}

/**
 * Get summarized status for tunnels (installation + active list)
 */
export async function getTunnelsSummary(): Promise<TunnelStatus> {
  return {
    isInstalled: await isInstalled(),
    activeTunnels: getActiveTunnels(),
    totalCount: activeTunnels.size
  };
}

/**
 * Stop a specific tunnel
 */
export async function stopTunnel(tunnelId: string): Promise<boolean> {
  const tunnel = activeTunnels.get(tunnelId);
  if (!tunnel) return false;

  // Update status to stopping
  const stoppingTunnel: TunnelInfo = { ...tunnel, status: 'stopping' };
  activeTunnels.set(tunnelId, stoppingTunnel);

  try {
    const success = await stopTunnelByPid(tunnel.pid);
    if (success) {
      activeTunnels.delete(tunnelId);
    } else {
      // Update status back if stop failed
      const errorTunnel: TunnelInfo = { ...tunnel, status: 'error', error: 'Failed to stop tunnel' };
      activeTunnels.set(tunnelId, errorTunnel);
    }
    return success;
  } catch (error) {
    // Update status with error
    const errorTunnel: TunnelInfo = { ...tunnel, status: 'error', error: 'Failed to stop tunnel' };
    activeTunnels.set(tunnelId, errorTunnel);
    return false;
  }
}


/**
 * Get tunnel status summary
 */
export async function getTunnelStatus(): Promise<TunnelStatus> {
  const isInstalledFlag = await isInstalled();
  const activeTunnelsList = getActiveTunnels();

  return {
    isInstalled: isInstalledFlag,
    activeTunnels: activeTunnelsList,
    totalCount: activeTunnelsList.length,
  };
}

/**
 * Helper function to stop tunnel by PID
 */
async function stopTunnelByPid(pid: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      if (process.platform === 'win32') {
        // Use taskkill to ensure child tree termination on Windows
        cp.exec(`taskkill /PID ${pid} /T /F`, { windowsHide: true }, () => {
          resolve(true);
        });
      } else {
        process.kill(pid, 'SIGTERM');
        setTimeout(() => {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {}
          resolve(true);
        }, 3000);
      }
    } catch {
      resolve(false);
    }
  });
}

// Exported utility for other modules to terminate a process tree reliably
export async function killProcessTree(pid: number): Promise<boolean> {
  return stopTunnelByPid(pid);
}

/**
 * Start a Quick Tunnel that exposes http://localhost:localPort
 * Resolves with the public URL and PID once available.
 */
export async function startQuickTunnel(localPort: number, context?: vscode.ExtensionContext, extraArgs: string[] = []): Promise<{ url: string; pid: number; proc: cp.ChildProcess }> {
  const bin = await ensureCloudflared(context);

  const args = [
    'tunnel',
    '--no-autoupdate',
    '--url', `http://localhost:${localPort}`,
    ...extraArgs,
  ];

  return spawnAndResolveUrl(bin, args, getTunnelStartTimeoutMs());
}

/**
 * Start a Named Tunnel using a token or a configured tunnel name.
 * If token is provided, we run: cloudflared tunnel run --token <token>
 * Otherwise, we run: cloudflared tunnel run <tunnelName>
 * In both cases we append --no-autoupdate and attempt to route to localPort via --url to simplify usage.
 * Note: For production named tunnels, routing is often configured via YAML; this provides a simplified path.
 */
export async function startNamedTunnel(localPort: number, tunnelName?: string, token?: string, context?: vscode.ExtensionContext, extraArgs: string[] = []): Promise<{ url: string; pid: number; proc: cp.ChildProcess }> {
  const bin = await ensureCloudflared(context);

  const base = ['tunnel', '--no-autoupdate'];
  const route = ['--url', `http://localhost:${localPort}`];
  let args: string[];

  if (token && token.trim().length > 0) {
    args = [...base, 'run', '--token', token, ...route, ...extraArgs];
  } else if (tunnelName && tunnelName.trim().length > 0) {
    args = [...base, 'run', tunnelName, ...route, ...extraArgs];
  } else {
    // Fallback to quick tunnel if neither provided
    args = [...base, ...route, ...extraArgs];
  }

  return spawnAndResolveUrl(bin, args, getTunnelStartTimeoutMs());
}

// -------------------------
// Helpers
// -------------------------

export function parsePublicUrl(data: string): string | null {
  // Extract all candidate URLs in the chunk
  const urlRegex = /(https?:\/\/[^\s\)\]\}\>\"']+)/g;
  const rawMatches = data.match(urlRegex) || [];
  if (!rawMatches.length) return null;

  // Clean trailing punctuation often printed around links
  const clean = (u: string) => u.replace(/[)\]\}\>\.,;:'\"]+$/g, '');

  const matches = rawMatches.map(clean);

  // Allowed tunnel host patterns (avoid ToS links like cloudflare.com/website-terms)
  const allow = [
    /\.trycloudflare\.com$/i,
    /\.cfargotunnel\.com$/i,
    /\.cloudflaretunnel\.com$/i,
    /\.tunnel\.cloudflare\.com$/i
  ];

  const hostname = (u: string) => {
    try { return new URL(u).hostname; } catch { return ''; }
  };

  const allowed = matches.filter(u => {
    const h = hostname(u);
    return h && allow.some(rx => rx.test(h));
  });

  if (!allowed.length) return null;

  // Preference order: trycloudflare > cfargotunnel > cloudflaretunnel > tunnel.cloudflare.com
  const rank = (u: string) => {
    const h = hostname(u);
    if (/\.trycloudflare\.com$/i.test(h)) return 1;
    if (/\.cfargotunnel\.com$/i.test(h)) return 2;
    if (/\.cloudflaretunnel\.com$/i.test(h)) return 3;
    if (/\.tunnel\.cloudflare\.com$/i.test(h)) return 4;
    return 99;
  };

  allowed.sort((a, b) => rank(a) - rank(b));
  return allowed.length > 0 ? allowed[0]! : null;
}

function spawnAndResolveUrl(bin: string, args: string[], timeoutMs?: number): Promise<{ url: string; pid: number; proc: cp.ChildProcess }> {
  return new Promise<{ url: string; pid: number; proc: cp.ChildProcess }>((resolve, reject) => {
    try {
      const proc = cp.spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          try { proc.kill(); } catch {}
          reject(new Error('Timed out waiting for tunnel URL'));
        }
      }, typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : getTunnelStartTimeoutMs());

      const handleChunk = (buf: Buffer) => {
        const text = buf.toString();
        const url = parsePublicUrl(text);
        if (url && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ url, pid: proc.pid ?? 0, proc });
        }
      };

      proc.stdout.on('data', handleChunk);
      proc.stderr.on('data', handleChunk);

      proc.on('error', (err) => {
        if (!resolved) {
          clearTimeout(timeout);
          reject(err);
        }
      });
      proc.on('exit', (code) => {
        if (!resolved) {
          clearTimeout(timeout);
          reject(new Error(`cloudflared exited with code ${code}`));
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function download(url: string, dest: string, redirectsLeft = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const doGet = (u: string, remaining: number) => {
      const file = fs.createWriteStream(dest);
      const req = https.get(u, { headers: { 'User-Agent': 'kiro-remote/1.0' } }, (res) => {
        const status = res.statusCode || 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          file.close();
          fs.unlink(dest, () => {});
          if (remaining <= 0) return reject(new Error(`Too many redirects downloading ${u}`));
          return doGet(location, remaining - 1);
        }
        if (status !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error(`HTTP ${status} downloading ${u}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      });
      req.on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    doGet(url, redirectsLeft);
  });
}

function getAssetForPlatform(): { url: string; isArchive: boolean; outName: string } {
  const base = 'https://github.com/cloudflare/cloudflared/releases/latest/download';
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    // Detect real OS architecture, independent of Node build
    const pa = (process.env.PROCESSOR_ARCHITECTURE || '').toLowerCase();
    const paw = (process.env.PROCESSOR_ARCHITEW6432 || '').toLowerCase();
    const isArm64 = pa.includes('arm64') || paw.includes('arm64');
    const isAmd64 = pa.includes('amd64') || paw.includes('amd64') || pa.includes('x86_64') || paw.includes('x86_64');
    const isX86 = pa === 'x86' && paw === '';

    if (isX86) {
      throw new Error('Unsupported platform: Windows 32-bit is not supported by cloudflared');
    }

    const file = isArm64 ? 'cloudflared-windows-arm64.exe' : 'cloudflared-windows-amd64.exe';
    return { url: `${base}/${file}`, isArchive: false, outName: 'cloudflared.exe' };
  }
  if (platform === 'linux') {
    const file = arch === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
    return { url: `${base}/${file}`, isArchive: false, outName: 'cloudflared' };
  }
  if (platform === 'darwin') {
    const file = arch === 'arm64' ? 'cloudflared-darwin-arm64.tgz' : 'cloudflared-darwin-amd64.tgz';
    return { url: `${base}/${file}`, isArchive: true, outName: 'cloudflared' };
  }
  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function isInPath(): Promise<boolean> {
  return new Promise((resolve) => {
    cp.exec('cloudflared version', (err) => resolve(!err));
  });
}

async function canRun(binaryPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    cp.exec(`"${binaryPath}" version`, { windowsHide: true }, (err) => resolve(!err));
  });
}

async function isLikelyWindowsExe(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.promises.open(filePath, 'r');
    const buf = Buffer.alloc(2);
    await fd.read(buf, 0, 2, 0);
    await fd.close();
    const stats = await fs.promises.stat(filePath);
    return buf[0] === 0x4d && buf[1] === 0x5a && stats.size > 1024 * 100; // 'MZ' and >100KB
  } catch {
    return false;
  }
}

export async function ensureCloudflared(context?: vscode.ExtensionContext): Promise<string> {
  // If available on PATH, use it
  if (await isInPath()) return 'cloudflared';

  const baseDir = context
    ? (context.globalStorageUri?.fsPath || context.globalStoragePath)
    : path.join(os.homedir(), '.vscode-cloudflared');

  ensureDirSync(baseDir);
  const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const dest = path.join(baseDir, binName);

  if (await fileExists(dest)) {
    if (await canRun(dest)) return dest;
    // If existing file cannot run (wrong arch or corrupted), remove and redownload
    try { await fs.promises.unlink(dest); } catch {}
  }

  let { url, isArchive, outName } = getAssetForPlatform();
  const tmp = path.join(baseDir, `download-${Date.now()}${path.extname(url)}`);

  await download(url, tmp);

  if (isArchive) {
    // Extract using system tar to avoid adding deps
    const extractDir = baseDir;
    await new Promise<void>((resolve, reject) => {
      const tarCmd = `tar -xzf "${tmp}" -C "${extractDir}"`;
      cp.exec(tarCmd, (err) => (err ? reject(err) : resolve()));
    });
    await fs.promises.unlink(tmp).catch(() => {});
    const extractedPath = path.join(extractDir, outName);
    if (!(await fileExists(extractedPath))) {
      throw new Error('Failed to extract cloudflared binary');
    }
    // Ensure executable permissions
    if (process.platform !== 'win32') await fs.promises.chmod(extractedPath, 0o755);
    // Validate it runs; if not on Windows, try alternate arch once
    if (!(await canRun(extractedPath)) && process.platform === 'win32') {
      // Try alternate Windows asset
      const alt = process.arch === 'arm64'
        ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
        : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-arm64.exe';
      const altTmp = path.join(baseDir, `download-alt-${Date.now()}.exe`);
      await download(alt, altTmp);
      const finalDest = path.join(baseDir, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
      await fs.promises.rename(altTmp, finalDest).catch(async () => {
        await fs.promises.copyFile(altTmp, finalDest);
        await fs.promises.unlink(altTmp).catch(() => {});
      });
      if (!(await canRun(finalDest))) {
        throw new Error('Downloaded cloudflared binary cannot run on this system (arch mismatch)');
      }
      return finalDest;
    }
    return extractedPath;
  } else {
    // Move/rename to final destination
    await fs.promises.rename(tmp, dest).catch(async () => {
      // fallback to copy if cross-device
      await fs.promises.copyFile(tmp, dest);
      await fs.promises.unlink(tmp).catch(() => {});
    });
    if (process.platform !== 'win32') await fs.promises.chmod(dest, 0o755);
    // Windows: validate PE header first to catch bad downloads (e.g. HTML)
    if (process.platform === 'win32' && !(await isLikelyWindowsExe(dest))) {
      // Try alternate Windows asset immediately
      const alt = process.arch === 'arm64'
        ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
        : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-arm64.exe';
      const altTmp = path.join(baseDir, `download-alt-${Date.now()}.exe`);
      await download(alt, altTmp);
      await fs.promises.rename(altTmp, dest).catch(async () => {
        await fs.promises.copyFile(altTmp, dest);
        await fs.promises.unlink(altTmp).catch(() => {});
      });
      if (!(await isLikelyWindowsExe(dest))) {
        throw new Error('Downloaded cloudflared binary is not a valid Windows executable (possible blocked/HTML download)');
      }
    }
    // Validate it runs; if not on Windows, try alternate arch once
    if (!(await canRun(dest)) && process.platform === 'win32') {
      const alt = process.arch === 'arm64'
        ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
        : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-arm64.exe';
      const altTmp = path.join(baseDir, `download-alt-${Date.now()}.exe`);
      await download(alt, altTmp);
      await fs.promises.rename(altTmp, dest).catch(async () => {
        await fs.promises.copyFile(altTmp, dest);
        await fs.promises.unlink(altTmp).catch(() => {});
      });
      if (!(await canRun(dest))) {
        throw new Error('Downloaded cloudflared binary cannot run on this system (arch mismatch)');
      }
    }
    return dest;
  }
}
