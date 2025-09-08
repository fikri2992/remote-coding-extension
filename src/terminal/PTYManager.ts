/*
 * PTYManager - Best-effort node-pty loader with vendor fallback
 */
// Avoid type dependency to keep optional

type SpawnOpts = { cwd: string; env: NodeJS.ProcessEnv; cols: number; rows: number; shell?: string; args?: string[] };

function loadNodePty(): any | null {
  try { return require('../..//vendor/node-pty/index.js'); } catch {}
  try { return require('node-pty'); } catch {}
  return null;
}

export function createPty(opts: SpawnOpts): { pty: any | null, engine: 'node-pty' | 'none' } {
  const nodePty = loadNodePty();
  if (!nodePty) return { pty: null, engine: 'none' };
  const shell = opts.shell || (process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash'));
  const args = opts.args || (process.platform === 'win32' ? ['-NoLogo', '-NoProfile'] : ['-i']);
  const pty = nodePty.spawn(shell, args, { cwd: opts.cwd, env: opts.env, cols: opts.cols, rows: opts.rows });
  return { pty, engine: 'node-pty' };
}
