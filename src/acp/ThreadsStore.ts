import { promises as fs } from 'fs';
import path from 'path';

export type ThreadUpdate = any;

export type ThreadFile = {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  title?: string;
  updates: ThreadUpdate[];
};

export type ThreadMeta = {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

export default class ThreadsStore {
  private dir: string;
  private indexPath: string;

  constructor(baseDir: string) {
    this.dir = baseDir;
    this.indexPath = path.join(this.dir, 'index.json');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const raw = await fs.readFile(this.indexPath, 'utf8').catch(() => '');
    if (!raw) await this.saveIndex([]);
  }

  private async loadIndex(): Promise<ThreadMeta[]> {
    const raw = await fs.readFile(this.indexPath, 'utf8').catch(() => '');
    if (!raw) return [];
    try { return JSON.parse(raw) as ThreadMeta[]; } catch { return []; }
  }

  private async saveIndex(list: ThreadMeta[]): Promise<void> {
    const json = JSON.stringify(list, null, 2);
    await fs.writeFile(this.indexPath, json, 'utf8');
  }

  private filePath(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  async append(id: string, update: ThreadUpdate): Promise<void> {
    const filePath = this.filePath(id);
    let thread: ThreadFile | null = null;
    const now = new Date().toISOString();
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      thread = JSON.parse(raw) as ThreadFile;
    } catch {}
    if (!thread) {
      thread = { id, createdAt: now, updatedAt: now, updates: [] };
    }
    // Deduplicate consecutive identical updates to reduce noise
    try {
      const last = thread.updates.length > 0 ? thread.updates[thread.updates.length - 1] : undefined;
      const same = last && JSON.stringify(last) === JSON.stringify(update);
      if (!same) thread.updates.push(update);
    } catch {
      thread.updates.push(update);
    }
    thread.updatedAt = now;
    await fs.writeFile(filePath, JSON.stringify(thread, null, 2), 'utf8');

    const index = await this.loadIndex();
    const ix = index.findIndex((t) => t.id === id);
    const base: ThreadMeta = { id, createdAt: thread.createdAt, updatedAt: thread.updatedAt } as ThreadMeta;
    const meta: ThreadMeta = (typeof thread.title === 'string' ? { ...base, title: thread.title } : base) as ThreadMeta;
    if (ix >= 0) index[ix] = meta; else index.push(meta);
    index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    await this.saveIndex(index);
  }

  async get(id: string): Promise<ThreadFile | null> {
    try {
      const raw = await fs.readFile(this.filePath(id), 'utf8');
      return JSON.parse(raw) as ThreadFile;
    } catch {
      return null;
    }
  }

  async list(): Promise<ThreadMeta[]> {
    return this.loadIndex();
  }
}
