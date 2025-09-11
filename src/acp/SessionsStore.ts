import { promises as fs } from 'fs';
import path from 'path';

type SessionMeta = {
  id: string;
  title?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

type StoreFile = {
  lastSessionId: string | null;
  sessions: SessionMeta[];
};

export default class SessionsStore {
  private filePath: string;
  private data: StoreFile = { lastSessionId: null, sessions: [] };

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const raw = await fs.readFile(this.filePath, 'utf8').catch(() => '');
      if (raw) this.data = JSON.parse(raw) as StoreFile;
    } catch (e) {
      this.data = { lastSessionId: null, sessions: [] };
      await this.save();
    }
  }

  private async save(): Promise<void> {
    const json = JSON.stringify(this.data, null, 2);
    await fs.writeFile(this.filePath, json, 'utf8');
  }

  list(): SessionMeta[] {
    return [...this.data.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getLast(): string | null {
    return this.data.lastSessionId ?? null;
  }

  async select(sessionId: string): Promise<void> {
    if (!this.data.sessions.find(s => s.id === sessionId)) {
      const now = new Date().toISOString();
      this.data.sessions.push({ id: sessionId, createdAt: now, updatedAt: now });
    }
    this.data.lastSessionId = sessionId;
    await this.save();
  }

  async add(id: string, title?: string): Promise<void> {
    const now = new Date().toISOString();
    if (!this.data.sessions.find(s => s.id === id)) {
      const base: SessionMeta = { id, createdAt: now, updatedAt: now } as SessionMeta;
      const rec = (title ? { ...base, title } : base) as SessionMeta;
      this.data.sessions.push(rec);
    }
    this.data.lastSessionId = id;
    await this.save();
  }

  async touch(id: string): Promise<void> {
    const now = new Date().toISOString();
    const s = this.data.sessions.find(s => s.id === id);
    if (s) {
      s.updatedAt = now;
    } else {
      const base: SessionMeta = { id, createdAt: now, updatedAt: now } as SessionMeta;
      this.data.sessions.push(base);
    }
    await this.save();
  }

  async delete(id: string): Promise<void> {
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    if (this.data.lastSessionId === id) {
      this.data.lastSessionId = this.data.sessions[0]?.id ?? null;
    }
    await this.save();
  }
}
