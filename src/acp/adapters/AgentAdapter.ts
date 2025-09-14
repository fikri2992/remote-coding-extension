export type Framing = 'ndjson' | 'lsp';

export interface AgentAdapter {
  id: string;
  title: string;
  framing: Framing;
  allowlist: RegExp;
  envKeys?: string[];
  defaultCommand(): string; // e.g., `npx -y @google/gemini-cli --experimental-acp`
}

export function splitCommand(cmd: string): { exe: string; args: string[] } {
  const matches = cmd.match(/(?:"[^"]+"|'[^']+'|\S+)/g) || [];
  const exe = matches.shift() || '';
  const dequote = (s: string) => (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")) ? s.slice(1, -1) : s;
  let resolvedExe = dequote(exe);
  if (process.platform === 'win32' && resolvedExe.toLowerCase() === 'npx') {
    resolvedExe = 'npx.cmd';
  }
  const args = matches.map(dequote);
  return { exe: resolvedExe, args };
}

