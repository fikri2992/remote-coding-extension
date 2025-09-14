// Centralized helpers for ACP timeouts and config

export type AcpOp = 'connect' | 'prompt' | string;

function readNumberLocal(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

export function getTimeoutMs(op: AcpOp): number {
  const DEF_CONNECT = readNumberLocal('KIRO_ACP_CONNECT_TIMEOUT_MS', 120000);
  const DEF_PROMPT = readNumberLocal('KIRO_ACP_PROMPT_TIMEOUT_MS', 60000);
  const DEF_DEFAULT = readNumberLocal('KIRO_ACP_DEFAULT_TIMEOUT_MS', 15000);
  if (op === 'connect') return DEF_CONNECT;
  if (op === 'prompt') return DEF_PROMPT;
  return DEF_DEFAULT;
}

