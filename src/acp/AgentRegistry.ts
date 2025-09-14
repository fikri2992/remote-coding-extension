import path from 'path';
import fs from 'fs';
import { AcpHttpController } from './AcpHttpController';
import { AgentAdapter } from './adapters/AgentAdapter';
import { BuiltinAdapters } from './adapters/builtins';

/**
 * Holds one AcpHttpController per agentId (e.g., 'claude', 'gemini').
 * Each controller persists to an agent-scoped directory under baseDir.
 */
export class AgentRegistry {
  private controllers = new Map<string, AcpHttpController>();
  private adapters = new Map<string, AgentAdapter>();
  constructor(private baseDir = path.join(process.cwd(), '.on-the-go', 'acp')) {
    for (const a of BuiltinAdapters) this.adapters.set(a.id, a);
    this.loadConfigAdapters();
  }

  private loadConfigAdapters() {
    try {
      const cfgPath = path.join(process.cwd(), '.on-the-go', 'agents.json');
      if (!fs.existsSync(cfgPath)) return;
      const raw = fs.readFileSync(cfgPath, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const e of arr) {
          if (!e || typeof e.id !== 'string') continue;
          const id = e.id.trim();
          const adapter: AgentAdapter = {
            id,
            title: String(e.title || id),
            framing: (e.framing === 'ndjson' ? 'ndjson' : 'lsp'),
            allowlist: new RegExp(String(e.allowlist || id), 'i'),
            envKeys: Array.isArray(e.envKeys) ? e.envKeys.map(String) : [],
            defaultCommand() { return String(e.defaultCommand || ''); },
          };
          this.adapters.set(id, adapter);
        }
      }
    } catch {}
  }

  list(): { id: string; title: string; framing: string; envKeys?: string[] }[] {
    return Array.from(this.adapters.values()).map(a => ({ id: a.id, title: a.title, framing: a.framing, ...(a.envKeys ? { envKeys: a.envKeys } : {}) }));
  }

  getAdapter(id: string): AgentAdapter | undefined { return this.adapters.get(id); }

  get(agentId?: string): AcpHttpController {
    const id = (agentId && agentId.trim()) || 'claude';
    let ctl = this.controllers.get(id);
    if (!ctl) {
      const dir = path.join(this.baseDir, id);
      const adapter = this.adapters.get(id);
      ctl = new AcpHttpController(dir, id, adapter);
      ctl.init().catch(() => {});
      this.controllers.set(id, ctl);
    }
    return ctl;
  }
}
