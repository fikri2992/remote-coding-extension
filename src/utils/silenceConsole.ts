// Console output controls for packaging
// Defaults:
// - Keep console.log/info/warn/error visible so users see helpful messages
// - Silence console.debug by default to reduce noise
// Overrides:
// - Set KIRO_SILENT_LOGS=1 to silence all console methods (fully quiet)
// - Set KIRO_SILENT_DEBUG=0 to allow console.debug as well

const fullySilent = process.env.KIRO_SILENT_LOGS === '1';
const silentDebug = process.env.KIRO_SILENT_DEBUG !== '0';

const noop = () => {};

if (fullySilent) {
  try { console.log = noop; } catch {}
  try { console.info = noop as any; } catch {}
  try { console.warn = noop as any; } catch {}
  try { console.error = noop as any; } catch {}
  try { (console as any).debug = noop; } catch {}
} else {
  // Only suppress debug by default
  if (silentDebug) {
    try { (console as any).debug = noop; } catch {}
  }
  // Filter noisy categories while keeping helpful startup info visible
  // Toggle off by setting KIRO_SILENT_NOISE=0
  if (process.env.KIRO_SILENT_NOISE !== '0') {
    const originalLog = console.log.bind(console);
    const noisePatterns: RegExp[] = [
      /WebSocket Frame/i,
      /Terminal Frame/i,
      /Processing Terminal Frame/i,
      /CommandHandler unavailable/i,
      /Registered service/i,
      /Unregistered service/i,
      /FileSystem Service (workspace root|config)/i,
      /Git Service workspace root/i,
      /\[WS\] Command error/i,
    ];
    try {
      (console as any).log = (...args: any[]) => {
        try {
          const joined = args.map((a) => {
            if (typeof a === 'string') return a;
            try { return JSON.stringify(a); } catch { return String(a); }
          }).join(' ');
          if (noisePatterns.some((re) => re.test(joined))) return;
        } catch {}
        return (originalLog as any)(...args);
      };
    } catch {}
  }
}

export {}; // side-effect only
