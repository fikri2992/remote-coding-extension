import path from 'path';
import fs from 'fs';
import { AgentAdapter } from './AgentAdapter';

function resolveNodeScript(...segments: string[]): string | null {
  try {
    const p = path.join(process.cwd(), ...segments);
    if (fs.existsSync(p)) return `"${process.execPath}" "${p}"`;
  } catch {}
  return null;
}

export const ClaudeAdapter: AgentAdapter = {
  id: 'claude',
  title: 'Claude Code ACP',
  framing: 'ndjson',
  allowlist: /claude-code-acp|@zed-industries\s*\/\s*claude-code-acp/i,
  envKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  defaultCommand() {
    const nmScript = resolveNodeScript('node_modules', '@zed-industries', 'claude-code-acp', 'dist', 'index.js');
    const localScript = resolveNodeScript('claude-code-acp', 'dist', 'index.js');
    return nmScript || localScript || 'npx -y @zed-industries/claude-code-acp';
  },
};

export const GeminiAdapter: AgentAdapter = {
  id: 'gemini',
  title: 'Gemini CLI (ACP)',
  // Gemini CLI communicates over newline-delimited JSON (NDJSON)
  framing: 'ndjson',
  allowlist: /gemini-cli|@google\s*\/\s*gemini|\bgemini\b/i,
  envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  defaultCommand() {
    // Prefer the flag-based invocation for broader compatibility across CLI versions
    // Older versions expect --experimental-acp (no subcommand), newer versions also still accept the flag.
    return 'npx -y @google/gemini-cli --experimental-acp';
  },
};

export const BuiltinAdapters: AgentAdapter[] = [ClaudeAdapter, GeminiAdapter];
