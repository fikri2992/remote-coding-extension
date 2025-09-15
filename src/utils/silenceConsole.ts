// Silences console output for production packaging
// This overrides console methods to no-ops to suppress backend logs.
// If you need logs locally, set KIRO_SILENT_LOGS=0 before starting.

const shouldSilence = process.env.KIRO_SILENT_LOGS !== '0';

if (shouldSilence) {
  const noop = () => {};
  try { console.log = noop; } catch {}
  try { console.info = noop as any; } catch {}
  try { console.warn = noop as any; } catch {}
  try { console.error = noop as any; } catch {}
  try { (console as any).debug = noop; } catch {}
}

export {}; // module side-effect only

