/**
 * FileSystemService - Workspace-scoped filesystem operations exposed over WebSocket
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FileNode, EnhancedWebSocketMessage } from './interfaces';

type SendFn = (clientId: string, message: any) => boolean;

interface TreeResult {
  path: string;
  children: FileNode[];
}

export class FileSystemService {
  private sendToClient: SendFn;
  private watchersByClient: Map<string, vscode.FileSystemWatcher[]> = new Map();
  private maxTextBytes = 1024 * 1024; // 1 MB safety limit for inline text content

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
          const result = await this.getTree(target);
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
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(target));
          } else {
            await vscode.workspace.fs.writeFile(vscode.Uri.file(target), new Uint8Array());
          }
          this.reply(clientId, id, op, { ok: true });
          break;
        }
        case 'delete': {
          const target = await this.resolvePathWithinWorkspace(data?.path);
          const recursive = data?.options?.recursive !== false;
          await vscode.workspace.fs.delete(vscode.Uri.file(target), { recursive, useTrash: false });
          this.reply(clientId, id, op, { ok: true });
          break;
        }
        case 'rename': {
          const src = await this.resolvePathWithinWorkspace(data?.path);
          const dst = await this.resolvePathWithinWorkspace(data?.options?.newPath);
          await vscode.workspace.fs.rename(vscode.Uri.file(src), vscode.Uri.file(dst), { overwrite: false });
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
      list.forEach(d => d.dispose());
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

  private getWorkspaceRoot(): string {
    const wf = vscode.workspace.workspaceFolders;
    if (!wf || wf.length === 0) throw new Error('No workspace open');
    return wf[0]!.uri.fsPath;
  }

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

  private async getTree(absPath: string): Promise<TreeResult> {
    const root = this.getWorkspaceRoot();
    const uri = vscode.Uri.file(absPath);
    const entries = await vscode.workspace.fs.readDirectory(uri);
    const children: FileNode[] = [];
    for (const [name, fileType] of entries) {
      const childAbs = path.join(absPath, name);
      const stat = await Promise.resolve(vscode.workspace.fs.stat(vscode.Uri.file(childAbs))).catch(() => null);
      const rel = childAbs.startsWith(root) ? childAbs.slice(root.length) || '/' : childAbs;
      const node: FileNode = {
        name,
        path: rel.replace(/\\/g, '/'),
        type: fileType === vscode.FileType.Directory ? 'directory' : 'file',
      };
      if (stat) {
        node.size = Number(stat.size);
        node.modified = new Date(Number(stat.mtime));
      }
      children.push(node);
    }
    const relSelf = absPath.startsWith(root) ? absPath.slice(root.length) || '/' : absPath;
    return { path: relSelf.replace(/\\/g, '/'), children };
  }

  private async openFile(absPath: string): Promise<{ path: string; content: string; encoding: 'utf8'; truncated: boolean; size: number }> {
    const root = this.getWorkspaceRoot();
    const uri = vscode.Uri.file(absPath);
    const stat = await vscode.workspace.fs.stat(uri);
    const size = Number(stat.size);
    const truncated = size > this.maxTextBytes;
    const bytes = await vscode.workspace.fs.readFile(uri);
    const slice = truncated ? bytes.slice(0, this.maxTextBytes) : bytes;
    // Best-effort UTF-8 decode
    const content = Buffer.from(slice).toString('utf8');
    const rel = absPath.startsWith(root) ? absPath.slice(root.length) || '/' : absPath;
    return { path: rel.replace(/\\/g, '/'), content, encoding: 'utf8', truncated, size };
  }

  private addWatcher(clientId: string, absPath: string) {
    // Create a RelativePattern covering the subtree
    const root = this.getWorkspaceRoot();
    const rel = absPath.startsWith(root) ? absPath.slice(root.length + 1) : absPath;
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) throw new Error('No workspace open');
    const pattern = rel && rel.length > 0 ? new vscode.RelativePattern(folder, rel.replace(/\\/g, '/') + '/**/*') : new vscode.RelativePattern(folder, '**/*');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const sendEvent = (kind: 'create' | 'change' | 'delete', uri: vscode.Uri) => {
      const relPath = uri.fsPath.startsWith(root) ? uri.fsPath.slice(root.length) || '/' : uri.fsPath;
      this.sendToClient(clientId, {
        type: 'fileSystem',
        data: {
          event: 'watch',
          kind,
          path: relPath.replace(/\\/g, '/'),
        }
      });
    };

    watcher.onDidCreate((u) => sendEvent('create', u));
    watcher.onDidChange((u) => sendEvent('change', u));
    watcher.onDidDelete((u) => sendEvent('delete', u));

    const arr = this.watchersByClient.get(clientId) || [];
    arr.push(watcher);
    this.watchersByClient.set(clientId, arr);
  }
}
