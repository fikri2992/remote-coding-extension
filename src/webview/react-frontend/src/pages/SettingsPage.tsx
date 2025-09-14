import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Key, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '../components/ui/toast';
import { useWebSocket } from '../components/WebSocketProvider';

const CONFIG_PATH = '/.on-the-go/config.json';

type OTGConfig = Record<string, any> & {
  version?: string;
  created?: string;
  lastModified?: string;
  integrations?: {
    claudeCodeACP?: { apiKey?: string };
    geminiCli?: { apiKey?: string };
  };
  env?: Record<string, string>;
};

const nowIso = () => new Date().toISOString();

const CollapsibleCard: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, description, collapsed, onToggle, children }) => {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="truncate">{title}</span>
          </div>
          {description && (
            <div className="mt-1 text-xs text-muted-foreground truncate">{description}</div>
          )}
        </div>
      </button>
      {!collapsed && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const ws = useWebSocket();
  const { isConnected } = ws as any;
  const { show } = useToast();
  const [loading, setLoading] = useState<boolean>(false);
  const [config, setConfig] = useState<OTGConfig | null>(null);
  const [claudeCollapsed, setClaudeCollapsed] = useState<boolean>(false);
  const [geminiCollapsed, setGeminiCollapsed] = useState<boolean>(false);
  const [claudeApiKey, setClaudeApiKey] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState<string>('');
  const [confirmApiType, setConfirmApiType] = useState<string>('');
  // Autostart
  const [autostartCollapsed, setAutostartCollapsed] = useState<boolean>(false);
  const [autostartEnabled, setAutostartEnabled] = useState<boolean>(true);
  const [autostartAgents, setAutostartAgents] = useState<string[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; title: string }>>([]);

  // Generic request helper for fileSystem open/create with timeout and send guard
  const sendFs = async (operation: 'open' | 'create', payload: any) => {
    return new Promise<any>((resolve, reject) => {
      try {
        const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        let done = false;
        const unsub = ws.addMessageListener((msg) => {
          if (msg?.type !== 'fileSystem') return;
          if (msg.id !== id) return;
          if (done) return;
          done = true;
          try { unsub(); } catch {}
          if (msg.data?.operation !== operation) {
            return reject(new Error('Mismatched operation'));
          }
          if (msg.data?.ok) resolve(msg.data?.result || true);
          else reject(new Error(msg.data?.error || `${operation} failed`));
        });
        const sent = ws.sendJson({ type: 'fileSystem', id, data: { fileSystemData: { operation, ...payload } } });
        if (!sent) {
          try { unsub(); } catch {}
          return reject(new Error('WebSocket not connected'));
        }
        const t = setTimeout(() => {
          if (!done) {
            try { unsub(); } catch {}
            reject(new Error('Request timeout'));
          }
        }, 10000);
        try { (t as any).unref?.(); } catch {}
      } catch (e) { reject(e); }
    });
  };

  // Load config when WebSocket is connected (prevents early-read race)
  useEffect(() => {
    if (!isConnected) return;
    (async () => {
      setLoading(true);
      try {
        let cfg: OTGConfig | null = null;
        try {
          const res = await sendFs('open', { path: CONFIG_PATH });
          const text = typeof res?.content === 'string' ? res.content : '';
          cfg = text ? JSON.parse(text) as OTGConfig : {} as OTGConfig;
        } catch {
          // Create default config in memory; don't write until user saves
          cfg = { version: '1.0.0', created: nowIso(), lastModified: nowIso(), integrations: {}, env: {} };
        }
        setConfig(cfg || {});
        const cApi = cfg?.integrations?.claudeCodeACP?.apiKey || cfg?.env?.ANTHROPIC_API_KEY || '';
        const gApi = cfg?.integrations?.geminiCli?.apiKey || cfg?.env?.GEMINI_API_KEY || '';
        setClaudeApiKey(cApi);
        setGeminiApiKey(gApi);
        // Autostart values from env
        const env = cfg?.env || {};
        const enabled = String(env.KIRO_ACP_AUTOSTART ?? '').trim();
        setAutostartEnabled(enabled !== '0');
        const extra = String(env.KIRO_ACP_AUTOSTART_AGENTS ?? '').trim();
        setAutostartAgents(extra ? extra.split(/[,;\s]+/).filter(Boolean) : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [isConnected]);

  // Load agents list for autostart selection once connected
  useEffect(() => {
    if (!isConnected) return;
    (async () => {
      try {
        const res = await (ws as any)?.sendAcp?.('agents.list', {});
        const list = Array.isArray(res?.agents) ? res.agents : [];
        setAvailableAgents(list.map((a: any) => ({ id: a.id, title: a.title || a.id })));
      } catch {}
    })();
  }, [ws, isConnected]);

  // Merge helper
  const mergeAndSave = async (next: Partial<OTGConfig>) => {
    const base: OTGConfig = config || { version: '1.0.0', created: nowIso(), integrations: {}, env: {} };
    const merged: OTGConfig = {
      ...base,
      ...next,
      integrations: { ...(base.integrations || {}), ...(next.integrations || {}) },
      env: { ...(base.env || {}), ...(next.env || {}) },
      lastModified: nowIso(),
    };
    const content = JSON.stringify(merged, null, 2);
    try {
      await sendFs('create', { path: CONFIG_PATH, content });
      setConfig(merged);
      show({ title: 'Saved', description: 'Settings updated', variant: 'default' });
    } catch (e: any) {
      const msg = e?.message || String(e) || 'Failed to save settings';
      show({ title: 'Save failed', description: msg, variant: 'destructive' });
      throw e;
    }
  };

  const saveClaude = async () => {
    const actualSave = async () => {
      await mergeAndSave({
        integrations: { claudeCodeACP: { apiKey: claudeApiKey } },
        env: { ...(config?.env || {}), ANTHROPIC_API_KEY: claudeApiKey }
      });
    };
    
    setConfirmTitle('Save Claude API Key');
    setConfirmApiType('ANTHROPIC_API_KEY');
    setConfirmAction(() => actualSave);
    setShowConfirmDialog(true);
  };

  const resetClaude = () => {
    const def = config?.integrations?.claudeCodeACP?.apiKey || config?.env?.ANTHROPIC_API_KEY || '';
    setClaudeApiKey(def || '');
  };

  const saveGemini = async () => {
    const actualSave = async () => {
      await mergeAndSave({
        integrations: { geminiCli: { apiKey: geminiApiKey } },
        env: { ...(config?.env || {}), GEMINI_API_KEY: geminiApiKey }
      });
    };
    
    setConfirmTitle('Save Gemini API Key');
    setConfirmApiType('GEMINI_API_KEY');
    setConfirmAction(() => actualSave);
    setShowConfirmDialog(true);
  };

  const resetGemini = () => {
    const def = config?.integrations?.geminiCli?.apiKey || config?.env?.GEMINI_API_KEY || '';
    setGeminiApiKey(def || '');
  };

  const saveAutostart = async () => {
    const env = { ...(config?.env || {}) };
    env.KIRO_ACP_AUTOSTART = autostartEnabled ? '1' : '0';
    env.KIRO_ACP_AUTOSTART_AGENTS = (autostartAgents || []).join(',');
    await mergeAndSave({ env });
  };

  const resetAutostart = () => {
    const env = config?.env || {};
    const enabled = String(env.KIRO_ACP_AUTOSTART ?? '').trim();
    setAutostartEnabled(enabled !== '0');
    const extra = String(env.KIRO_ACP_AUTOSTART_AGENTS ?? '').trim();
    setAutostartAgents(extra ? extra.split(/[,;\s]+/).filter(Boolean) : []);
  };

  const handleConfirmSave = async () => {
    if (confirmAction) {
      try {
        await confirmAction();
      } catch (error) {
        // Error already handled in mergeAndSave
      }
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  const handleCancelSave = () => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  return (
    <div className="space-y-6">
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border border-border p-6 max-w-md mx-4 neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <h3 className="text-lg font-semibold">{confirmTitle}</h3>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                  ⚠️ Security Warning
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Your API key will be stored in <code>/.on-the-go/config.json</code>. This file contains sensitive information.
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                  💡 Recommended: Use Environment Variables
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  For better security, set your API key as an environment variable instead:
                </p>
                <code className="block text-xs bg-blue-100 dark:bg-blue-900/40 p-2 rounded border text-blue-900 dark:text-blue-100">
                  export {confirmApiType}="your-api-key-here"
                </code>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                  🔒 Important: Add to .gitignore
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Make sure <code>.on-the-go/</code> is in your <code>.gitignore</code> file to prevent committing API keys.
                </p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to save this API key to the config file?
            </p>
            
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={handleCancelSave}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]"
              >
                No, Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={loading}
                className="rounded-md bg-primary px-4 py-2 text-white text-sm hover:bg-primary/90 neo:rounded-none neo:border-[3px] neo:border-border neo:text-primary-foreground neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]"
              >
                Yes, Save API Key
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Autostart */}
      <CollapsibleCard
        title={<span className="inline-flex items-center gap-2">Autostart</span>}
        description="Control agent autostart behavior when the server launches"
        collapsed={autostartCollapsed}
        onToggle={() => setAutostartCollapsed(c => !c)}
      >
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autostartEnabled}
              onChange={(e) => setAutostartEnabled(e.target.checked)}
            />
            Autostart primary agent on server start
          </label>
          <div>
            <div className="text-sm font-medium mb-1">Additional agents to autostart</div>
            <div className="grid grid-cols-2 gap-2">
              {availableAgents.map(a => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autostartAgents.includes(a.id)}
                    onChange={(e) => setAutostartAgents(prev => e.target.checked ? Array.from(new Set([...prev, a.id])) : prev.filter(x => x !== a.id))}
                  />
                  {a.title}
                </label>
              ))}
              {availableAgents.length === 0 && (
                <div className="text-xs text-muted-foreground">No agents detected yet.</div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Stored as env KIRO_ACP_AUTOSTART and KIRO_ACP_AUTOSTART_AGENTS in /.on-the-go/config.json</p>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={loading} onClick={saveAutostart} className="rounded-md bg-primary px-3 py-2 text-white text-sm hover:bg-primary/90 neo:rounded-none neo:border-[4px] neo:border-border neo:text-primary-foreground neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">Save</button>
            <button disabled={loading} onClick={resetAutostart} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted neo:rounded-none neo:border-[4px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">Reset</button>
          </div>
        </div>
      </CollapsibleCard>

      {/* Claude Code ACP */}
      <CollapsibleCard
        title={<span className="inline-flex items-center gap-2"><Key className="w-4 h-4" /> Claude Code ACP</span>}
        description="Configure API access for Claude Code ACP"
        collapsed={claudeCollapsed}
        onToggle={() => setClaudeCollapsed(c => !c)}
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="claudeApiKey">API Key</label>
          <div className="flex items-center gap-2">
            <input
              id="claudeApiKey"
              type="password"
              value={claudeApiKey}
              onChange={(e) => setClaudeApiKey(e.target.value)}
              placeholder="Enter ANTHROPIC_API_KEY"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary neo:rounded-none neo:border-[3px] neo:border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <button disabled={loading} onClick={saveClaude} className="rounded-md bg-primary px-3 py-2 text-white text-sm hover:bg-primary/90 neo:rounded-none neo:border-[4px] neo:border-border neo:text-primary-foreground neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">Save</button>
            <button disabled={loading} onClick={resetClaude} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted neo:rounded-none neo:border-[4px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">Reset</button>
          </div>
          <p className="text-xs text-muted-foreground">Stored in <code>/.on-the-go/config.json</code> under <code>integrations.claudeCodeACP.apiKey</code> and mirrored to <code>env.ANTHROPIC_API_KEY</code>.</p>
        </div>
      </CollapsibleCard>

      {/* Gemini CLI */}
      <CollapsibleCard
        title={<span className="inline-flex items-center gap-2"><Shield className="w-4 h-4" /> Gemini CLI</span>}
        description="Configure API access for Gemini CLI"
        collapsed={geminiCollapsed}
        onToggle={() => setGeminiCollapsed(c => !c)}
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="geminiApiKey">API Key</label>
          <div className="flex items-center gap-2">
            <input
              id="geminiApiKey"
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Enter GEMINI_API_KEY"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary neo:rounded-none neo:border-[3px] neo:border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <button disabled={loading} onClick={saveGemini} className="rounded-md bg-primary px-3 py-2 text-white text-sm hover:bg-primary/90 neo:rounded-none neo:border-[4px] neo:border-border neo:text-primary-foreground neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">Save</button>
            <button disabled={loading} onClick={resetGemini} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted neo:rounded-none neo:border-[4px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">Reset</button>
          </div>
          <p className="text-xs text-muted-foreground">Stored in <code>/.on-the-go/config.json</code> under <code>integrations.geminiCli.apiKey</code> and mirrored to <code>env.GEMINI_API_KEY</code>.</p>
        </div>
      </CollapsibleCard>
    </div>
  );
};

export default SettingsPage;
