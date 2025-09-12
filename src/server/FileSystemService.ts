/**
 * FileSystemService - Workspace-scoped filesystem operations exposed over WebSocket (CLI-safe)
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { FileNode, EnhancedWebSocketMessage } from './interfaces';

type SendFn = (clientId: string, message: any) => boolean;

interface TreeResult {
  path: string;
  children: FileNode[];
}

export class FileSystemService {
  private sendToClient: SendFn;
  private watchersByClient: Map<string, fs.FSWatcher[]> = new Map();
  private maxTextBytes = 1024 * 1024; // 1 MB safety limit for inline text content
  private maxBinaryBytes = 15 * 1024 * 1024; // 15 MB safety limit for inline binary content
  private imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg']);

  constructor(sendFn: SendFn) {
    this.sendToClient = sendFn;
  }

  /** Handle an incoming WS message for fileSystem */
  public async handle(clientId: string, message: EnhancedWebSocketMessage): Promise<void> {
    const id = message.id;
    const data = message.data?.fileSystemData || (message.data as any);
    const op = data?.operation as string;

    try {
      switch (op) {
        case 'tree': {
          const target = await this.resolvePathWithinWorkspace(data?.path);
          const depth = Math.max(1, Math.min(20, Number(data?.options?.depth) || 1));
          const result = await this.getTree(target, depth);
          this.reply(clientId, id, op, { ok: true, result });
          break;
        }
        case 'open': {
          const target = await this.resolvePathWithinWorkspace(data?.path);
          const result = await this.openFile(target);
          this.reply(clientId, id, op, { ok: true, result });
          break;
        }
        case 'create': {
          const target = await this.resolvePathWithinWorkspace(data?.path);
          const isDir = data?.options?.type === 'directory';
          if (isDir) {
            await fsp.mkdir(target, { recursive: true });
          } else {
            // Ensure parent directory exists for file creation
            try {
              const parent = path.dirname(target);
              await fsp.mkdir(parent, { recursive: true });
            } catch {}
            const raw = data?.content;
            let bytes: Uint8Array;
            if (typeof raw === 'string') {
              bytes = Buffer.from(raw, 'utf8');
            } else if (raw instanceof Uint8Array) {
              bytes = raw;
            } else if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
              // Support for ArrayLike data payloads
              bytes = Uint8Array.from((raw as any).data as number[]);
            } else {
              bytes = new Uint8Array();
            }
            await fsp.writeFile(target, Buffer.from(bytes));
          }
          this.reply(clientId, id, op, { ok: true });
          break;
        }
        case 'delete': {
          const target = await this.resolvePathWithinWorkspace(data?.path);
          const recursive = data?.options?.recursive !== false;
          if (recursive) {
            await fsp.rm(target, { recursive: true, force: true });
          } else {
            await fsp.unlink(target);
          }
          this.reply(clientId, id, op, { ok: true });
          break;
        }
        case 'rename': {
          const src = await this.resolvePathWithinWorkspace(data?.path);
          const dst = await this.resolvePathWithinWorkspace(data?.options?.newPath);
          await fsp.rename(src, dst);
          this.reply(clientId, id, op, { ok: true });
          break;
        }
        case 'watch': {
          const target = await this.resolvePathWithinWorkspace(data?.path);
          this.addWatcher(clientId, target);
          this.reply(clientId, id, op, { ok: true });
          break;
        }
        default: {
          throw new Error(`Unsupported fileSystem operation: ${op}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.reply(clientId, id, op || 'unknown', { ok: false, error: msg });
    }
  }

  /** Dispose watchers for a client on disconnect */
  public onClientDisconnect(clientId: string) {
    const list = this.watchersByClient.get(clientId);
    if (list && list.length) {
      list.forEach(d => { try { d.close(); } catch {} });
    }
    this.watchersByClient.delete(clientId);
  }

  // --- Helpers ---

  private reply(clientId: string, id: string | undefined, operation: string, payload: any) {
    const body = {
      type: 'fileSystem',
      id,
      data: {
        operation,
        ...payload,
      },
    };
    this.sendToClient(clientId, body);
  }

  private getWorkspaceRoot(): string { return process.cwd(); }

  private async resolvePathWithinWorkspace(relOrAbs?: string): Promise<string> {
    const root = this.getWorkspaceRoot();
    const raw = (relOrAbs || '').trim();
    const normRoot = path.normalize(root);
    // Treat undefined, empty, '.', '/', '\\' as workspace root
    if (!raw || raw === '/' || raw === '\\' || raw === '.' || raw === './') {
      return normRoot;
    }
    let abs: string;
    // If the path starts with a leading slash or backslash, interpret as workspace-relative
    if (raw.startsWith('/') || raw.startsWith('\\')) {
      abs = path.join(normRoot, raw.slice(1));
    } else if (path.isAbsolute(raw)) {
      abs = raw;
    } else {
      abs = path.join(normRoot, raw);
    }
    const normalized = path.normalize(abs);
    if (normalized === normRoot) return normalized;
    if (!normalized.startsWith(normRoot + path.sep)) {
      throw new Error('Path outside workspace');
    }
    return normalized;
  }

  private async getTree(absPath: string, depth: number): Promise<TreeResult> {
    const root = this.getWorkspaceRoot();
    const entries = await fsp.readdir(absPath, { withFileTypes: true });
    const children: FileNode[] = [];
    for (const dirent of entries) {
      const name = dirent.name;
      const childAbs = path.join(absPath, name);
      const stat = await Promise.resolve(fsp.stat(childAbs)).catch(() => null);
      const rel = childAbs.startsWith(root) ? childAbs.slice(root.length) || '/' : childAbs;
      const node: FileNode = {
        name,
        path: rel.replace(/\\/g, '/'),
        type: dirent.isDirectory() ? 'directory' : 'file',
      };
      if (stat) {
        node.size = Number(stat.size);
        node.modified = new Date(Number(stat.mtime));
      }
      // Recurse into subdirectories if depth allows
      if (dirent.isDirectory() && depth > 1) {
        try {
          const sub = await this.getTree(childAbs, depth - 1);
          if (Array.isArray(sub.children)) node.children = sub.children;
        } catch {}
      }
      children.push(node);
    }
    const relSelf = absPath.startsWith(root) ? absPath.slice(root.length) || '/' : absPath;
    return { path: relSelf.replace(/\\/g, '/'), children };
  }

  private async openFile(absPath: string): Promise<{ path: string; content: string; encoding: 'utf8'; truncated: boolean; size: number } | { path: string; base64: string; encoding: 'base64'; contentType: string; size: number }> {
    const root = this.getWorkspaceRoot();
    const stat = await fsp.stat(absPath);
    const size = Number(stat.size);
    const rel = absPath.startsWith(root) ? absPath.slice(root.length) || '/' : absPath;
    const fileName = rel.split('/').pop() || '';
    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

    // Check if it's an image file
    if (this.imageExtensions.has(fileExt)) {
      // Handle SVG files as text
      if (fileExt === 'svg') {
        if (size > this.maxTextBytes) {
          const bytes = await fsp.readFile(absPath);
          const slice = bytes.slice(0, this.maxTextBytes);
          const content = Buffer.from(slice).toString('utf8');
          return { path: rel.replace(/\\/g, '/'), content, encoding: 'utf8', truncated: true, size };
        } else {
          const bytes = await fsp.readFile(absPath);
          const content = Buffer.from(bytes).toString('utf8');
          return { path: rel.replace(/\\/g, '/'), content, encoding: 'utf8', truncated: false, size };
        }
      }
      
      // Handle raster images as binary
      if (size > this.maxBinaryBytes) {
        throw new Error(`File too large for inline viewing (${size} bytes > ${this.maxBinaryBytes} bytes). Use download instead.`);
      }
      
      const bytes = await fsp.readFile(absPath);
      const base64 = Buffer.from(bytes).toString('base64');
      const contentType = this.getImageContentType(fileExt);
      return { path: rel.replace(/\\/g, '/'), base64, encoding: 'base64', contentType, size };
    }

    // Handle as text file (existing behavior)
    const truncated = size > this.maxTextBytes;
    const bytes = await fsp.readFile(absPath);
    const slice = truncated ? bytes.slice(0, this.maxTextBytes) : bytes;
    // Best-effort UTF-8 decode
    const content = Buffer.from(slice).toString('utf8');
    return { path: rel.replace(/\\/g, '/'), content, encoding: 'utf8', truncated, size };
  }

  private getImageContentType(extension: string): string {
    const contentTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon'
    };
    return contentTypes[extension] || 'application/octet-stream';
  }

  private addWatcher(clientId: string, absPath: string) {
    const root = this.getWorkspaceRoot();
    const sendEvent = (kind: 'create' | 'change' | 'delete', filePath: string) => {
      const relPath = filePath.startsWith(root) ? filePath.slice(root.length) || '/' : filePath;
      this.sendToClient(clientId, { type: 'fileSystem', data: { event: 'watch', kind, path: relPath.replace(/\\/g, '/') } });
    };
    const watcher = fs.watch(absPath, { recursive: true }, (event, filename) => {
      if (!filename) return;
      const full = path.join(absPath, filename.toString());
      const kind = event === 'rename' ? 'change' : 'change';
      sendEvent(kind, full);
    });
    const arr = this.watchersByClient.get(clientId) || [];
    arr.push(watcher);
    this.watchersByClient.set(clientId, arr);
  }
}
