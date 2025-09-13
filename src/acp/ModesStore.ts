import { promises as fs } from 'fs';
import path from 'path';

export type ModesRecord = {
  sessionId: string;
  available_modes?: Array<{ id: string; name?: string }>;
  current_mode_id?: string;
  updatedAt: string; // ISO
};

export default class ModesStore {
  private dir: string;

  constructor(baseDir: string) {
    this.dir = baseDir;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private filePath(sessionId: string): string {
    return path.join(this.dir, `${sessionId}.json`);
  }

  async get(sessionId: string): Promise<ModesRecord | null> {
    try {
      const raw = await fs.readFile(this.filePath(sessionId), 'utf8');
      return JSON.parse(raw) as ModesRecord;
    } catch { return null; }
  }

  async setSnapshot(sessionId: string, modes: any): Promise<void> {
    const now = new Date().toISOString();
    const cm = (modes?.current_mode_id ?? modes?.currentModeId) as string | undefined;
    const rec: ModesRecord = {
      sessionId,
      available_modes: (modes?.available_modes || modes?.availableModes || modes?.modes || []) as Array<{ id: string; name?: string }>,
      updatedAt: now,
      ...(cm !== undefined ? { current_mode_id: cm } : {}),
    };
    await fs.writeFile(this.filePath(sessionId), JSON.stringify(rec, null, 2), 'utf8');
  }

  async setCurrent(sessionId: string, modeId: string): Promise<void> {
    const now = new Date().toISOString();
    let rec = await this.get(sessionId);
    if (!rec) rec = { sessionId, available_modes: [], current_mode_id: modeId, updatedAt: now } as ModesRecord;
    else { rec.current_mode_id = modeId; rec.updatedAt = now; }
    await fs.writeFile(this.filePath(sessionId), JSON.stringify(rec, null, 2), 'utf8');
  }
}
