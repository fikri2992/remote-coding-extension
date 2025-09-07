import * as vscode from 'vscode'

export class CredentialManager {
  private credentials: Map<string, string> = new Map()

  constructor() {
    this.loadCredentials()
  }

  private loadCredentials(): void {
    try {
      const config = vscode.workspace.getConfiguration('webAutomationTunnel')

      const mappings: Record<string, string> = {
        ANTHROPIC_API_KEY: 'anthropic.apiKey',
        OPENAI_API_KEY: 'openai.apiKey',
        GOOGLE_API_KEY: 'google.apiKey',
        GEMINI_API_KEY: 'gemini.apiKey',
        CLAUDE_API_KEY: 'claude.apiKey'
      }

      for (const [envVar, configKey] of Object.entries(mappings)) {
        const v = (config?.get<string>(configKey) || process.env[envVar] || '').trim()
        if (v) this.credentials.set(envVar, v)
      }
    } catch {
      // best-effort: still allow reading from env
      const envKeys = ['ANTHROPIC_API_KEY','OPENAI_API_KEY','GOOGLE_API_KEY','GEMINI_API_KEY','CLAUDE_API_KEY']
      for (const k of envKeys) {
        const v = (process.env[k] || '').trim()
        if (v) this.credentials.set(k, v)
      }
    }
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

