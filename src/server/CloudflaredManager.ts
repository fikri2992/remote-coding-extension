import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as cp from 'child_process';

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// -------------------------
// Runtime tunnel management
// -------------------------

export interface StartedTunnelInfo {
  url: string;
  pid: number;
}

let currentProc: cp.ChildProcess | null = null;
let currentUrl: string | null = null;

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
 * Start a Quick Tunnel that exposes http://localhost:localPort
 * Resolves with the public URL and PID once available.
 */
export async function startQuickTunnel(localPort: number, context?: vscode.ExtensionContext, extraArgs: string[] = []): Promise<StartedTunnelInfo> {
  if (currentProc) throw new Error('A tunnel is already running');
  const bin = await ensureCloudflared(context);

  const args = [
    'tunnel',
    '--no-autoupdate',
    '--url', `http://localhost:${localPort}`,
    ...extraArgs,
  ];

  return spawnAndResolveUrl(bin, args);
}

/**
 * Start a Named Tunnel using a token or a configured tunnel name.
 * If token is provided, we run: cloudflared tunnel run --token <token>
 * Otherwise, we run: cloudflared tunnel run <tunnelName>
 * In both cases we append --no-autoupdate and attempt to route to localPort via --url to simplify usage.
 * Note: For production named tunnels, routing is often configured via YAML; this provides a simplified path.
 */
export async function startNamedTunnel(localPort: number, tunnelName?: string, token?: string, context?: vscode.ExtensionContext, extraArgs: string[] = []): Promise<StartedTunnelInfo> {
  if (currentProc) throw new Error('A tunnel is already running');
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

  return spawnAndResolveUrl(bin, args);
}

/** Stop the running tunnel process, if any */
export async function stopTunnel(): Promise<boolean> {
  if (!currentProc) return false;
  const pid = currentProc.pid ?? 0;

  return new Promise<boolean>((resolve) => {
    const proc = currentProc!;
    currentProc = null;
    currentUrl = null;

    const onExit = () => resolve(true);
    proc.once('exit', onExit);

    try {
      if (process.platform === 'win32' && pid) {
        // Use taskkill to ensure child tree termination on Windows
        cp.exec(`taskkill /PID ${pid} /T /F`, { windowsHide: true }, () => {});
      } else {
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 3000).unref?.();
      }
    } catch {
      resolve(false);
    }
  });
}

// -------------------------
// Helpers
// -------------------------

function parsePublicUrl(data: string): string | null {
  // Look for any https URL, prioritizing trycloudflare.com but allowing custom hosts
  const urlRegex = /(https?:\/\/[^\s\"]+)/g;
  const matches = data.match(urlRegex);
  if (!matches) return null;
  // Prefer trycloudflare if present
  const preferred = matches.find(u => /trycloudflare\.com/.test(u));
  return preferred || matches[0];
}

function spawnAndResolveUrl(bin: string, args: string[]): Promise<StartedTunnelInfo> {
  return new Promise<StartedTunnelInfo>((resolve, reject) => {
    try {
      const proc = cp.spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      currentProc = proc;

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          try { proc.kill(); } catch {}
          currentProc = null;
          reject(new Error('Timed out waiting for tunnel URL'));
        }
      }, 20000); // 20s

      const handleChunk = (buf: Buffer) => {
        const text = buf.toString();
        const url = parsePublicUrl(text);
        if (url && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          currentUrl = url;
          resolve({ url, pid: proc.pid ?? 0 });
        }
      };

      proc.stdout.on('data', handleChunk);
      proc.stderr.on('data', handleChunk);

      proc.on('error', (err) => {
        if (!resolved) {
          clearTimeout(timeout);
          currentProc = null;
          reject(err);
        }
      });
      proc.on('exit', (code) => {
        if (!resolved) {
          clearTimeout(timeout);
          currentProc = null;
          reject(new Error(`cloudflared exited with code ${code}`));
        }
      });
    } catch (e) {
      currentProc = null;
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
