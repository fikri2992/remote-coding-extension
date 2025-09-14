import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
function getVSCode(): any | null { try { return require('vscode'); } catch { return null; } }

export class CredentialManager {
  private credentials: Map<string, string> = new Map()

  constructor() {
    this.loadCredentials()
  }

  private loadCredentials(): void {
    // Priority 1: project-local config
    this.tryLoadFromConfig(path.join(process.cwd(), '.on-the-go', 'config.json'));

    // Priority 2: user-level legacy config (~/.kiro-remote/config.json)
    this.tryLoadFromConfig(path.join(os.homedir(), '.kiro-remote', 'config.json'));

    // Priority 3: VS Code settings (if present)
    try {
      const vs = getVSCode();
      const config = vs?.workspace?.getConfiguration?.('webAutomationTunnel')
      const mappings: Record<string, string> = {
        ANTHROPIC_API_KEY: 'anthropic.apiKey',
        OPENAI_API_KEY: 'openai.apiKey',
        GOOGLE_API_KEY: 'google.apiKey',
        GEMINI_API_KEY: 'gemini.apiKey',
        CLAUDE_API_KEY: 'claude.apiKey'
      };
      for (const [envVar, configKey] of Object.entries(mappings)) {
        const v = ((config?.get?.(configKey) as string | undefined) || '').trim();
        if (v) this.credentials.set(envVar, v);
      }
    } catch {}
  }

  private tryLoadFromConfig(p: string) {
    try {
      if (!fs.existsSync(p)) return;
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8')) || {};
      const env = (cfg && typeof cfg === 'object' ? (cfg.env || {}) : {}) as Record<string, any>;
      const integrations = (cfg && typeof cfg === 'object' ? (cfg.integrations || {}) : {}) as Record<string, any>;

      const setIf = (key: string, val?: any) => {
        const v = (val === undefined || val === null) ? '' : String(val).trim();
        if (v) this.credentials.set(key, v);
      };

      // Map from env
      setIf('ANTHROPIC_API_KEY', env.ANTHROPIC_API_KEY);
      setIf('CLAUDE_API_KEY', env.CLAUDE_API_KEY);
      setIf('GOOGLE_API_KEY', env.GOOGLE_API_KEY);
      setIf('GEMINI_API_KEY', env.GEMINI_API_KEY);
      setIf('OPENAI_API_KEY', env.OPENAI_API_KEY);

      // Map from integrations
      if (integrations.claudeCodeACP && integrations.claudeCodeACP.apiKey) {
        setIf('ANTHROPIC_API_KEY', integrations.claudeCodeACP.apiKey);
      }
      if (integrations.geminiCli && integrations.geminiCli.apiKey) {
        setIf('GEMINI_API_KEY', integrations.geminiCli.apiKey);
        // Some tools expect GOOGLE_API_KEY
        setIf('GOOGLE_API_KEY', integrations.geminiCli.apiKey);
      }
    } catch {}
  }

  getAllAICredentials(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of this.credentials.entries()) {
      if (v) out[k] = v
    }
    return out
  }

  hasCredential(envVar: string): boolean {
    const v = this.credentials.get(envVar)
    return !!(v && v.length > 0)
  }

  getAvailableAIProviders(): string[] {
    const providers: string[] = []
    if (this.hasCredential('ANTHROPIC_API_KEY') || this.hasCredential('CLAUDE_API_KEY')) providers.push('claude')
    if (this.hasCredential('OPENAI_API_KEY')) providers.push('openai')
    if (this.hasCredential('GOOGLE_API_KEY') || this.hasCredential('GEMINI_API_KEY')) providers.push('gemini')
    return providers
  }
}
