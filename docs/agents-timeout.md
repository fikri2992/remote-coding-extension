# Long‑Running Agents, Timeouts, and Robust Loading Indicators

## Overview

Some agents (notably CLI‑backed ones like Gemini) can take a while to start or respond, especially on first run, cold network, or when auth is required. Users see timeouts, ambiguous “idle” states, or flickering “connecting…” messages. This doc summarizes root causes and proposes practical fixes across frontend UX, client timeouts, and backend instrumentation.

## Symptoms

- Connect clicks hang or silently fail; user sees “Idle” then “Connected” flicker or nothing.
- Prompt returns timeout while the agent is actually starting or streaming slowly.
- After reload, the page looks reset until WS reconnects and data rehydrates.
- Users can’t tell which phase is slow (spawn vs initialize vs session.new vs models.list).

## Likely Root Causes

1) Frontend request timeouts not tuned per operation
- `sendAcp` generic helper defaulted to ~15s which is too short for `connect` and sometimes tight for `prompt`.
- No uniform “slow operation” indicator; only a simple spinner/toast in some places.

2) Missing phase‑level progress signals in the UI
- Users can’t see “Agent process started”, “Initialized”, “Session created”, etc.
- We do receive events (`agent_connect`, `agent_initialized`, `session_update`) but don’t surface them as progress.

3) Agent warm‑up / auth delays
- Gemini may need OAuth or API key validation. Long first‑time downloads (e.g., npx) increase startup time.

4) Backend JSON‑RPC stream has no per‑request timeout awareness
- `JsonRpcStdioClient` doesn’t enforce timeouts (it should not for streaming), so the client must handle them.

5) Races on app load
- WS not yet connected when initial requests are fired → UI looks reset until retries happen.

## Recommended Fixes

### A) Frontend: timeouts and indicators

1) Per‑op timeouts (already partially implemented in ChatPage)
- `connect`: 120s
- `prompt`: 60s (stream starts quickly, but give room on cold starts)
- Misc ops: 10–15s
- Implement via a small wrapper over `sendAcp` (done in ChatPage). Consider centralizing in a shared helper so ACPPage and SettingsPage benefit too.

2) Slow‑op banners and progress stepper
- Add a small stepper in Chat header that reflects phases:
  - “Starting agent” → upon `agent_connect`
  - “Initialized” → upon `agent_initialized`
  - “Creating session” → when calling `session.new` or `session.select`
  - “Fetching models” → on `models.list`
- If a phase exceeds `KIRO_WARN_SLOW_CONNECT_MS` (default 8000ms), show a banner: “This is taking longer than usual…”.

3) Cancellable operations
- When `connecting` is true, show a Cancel button that calls `disconnect` and resets UI.
- On long `prompt`, allow `cancel` to clear typing indicator and stop the stream.

4) Always defer initial loads until WS is connected
- Already applied to SettingsPage and ACPPage: mount effects wait for `isConnected` before loading.

5) Expose timeout settings in Settings
- UI fields mapped to env (or localStorage) so advanced users can tune:
  - `KIRO_ACP_CONNECT_TIMEOUT_MS`
  - `KIRO_ACP_PROMPT_TIMEOUT_MS`
  - `KIRO_WARN_SLOW_CONNECT_MS`

### B) Backend: instrumentation & resilience

1) Leverage existing events
- We already emit `agent_connect`, `agent_initialized`, `agent_stderr`, `agent_exit`, `session_update`. Surface them to UI stepper.

2) Optional: spawn preflight
- Add an option to pre‑warm agents at server start (already hinted by `KIRO_ACP_AUTOSTART` and `KIRO_ACP_AUTOSTART_AGENTS`). Document this for users who prefer zero‑latency connects.

3) Keepalive
- We already send WS pings; continue to send lightweight pings (`{type:'ping'}`) to keep proxies happy.

### C) UX Design for Robust Loading

- Header indicators:
  - Status chip: Idle / Connecting / Connected
  - Badges: Models and Modes availability (added)
  - Stepper: Start → Init → Session → Models
- Slow op toast & banner:
  - Trigger at 8s (configurable), include a “Show logs” action that opens a panel streaming `agent_stderr` lines.
- Retry affordances:
  - After connect timeout, offer “Retry (120s)” and “Use longer timeout (180s)” options.
  - After prompt timeout, keep the user’s input in the composer; suggest retry.

## Pseudocode Patterns

Per‑op send wrapper
```ts
const DEFAULT_TIMEOUTS = { connect: 120000, prompt: 60000, default: 15000 };
function acp(op: string, payload: any, opts?: { timeoutMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? (op === 'connect' ? DEFAULT_TIMEOUTS.connect : op === 'prompt' ? DEFAULT_TIMEOUTS.prompt : DEFAULT_TIMEOUTS.default);
  return sendAcp(op, payload, { timeoutMs });
}
```

Slow‑op banner
```ts
useEffect(() => {
  if (!connecting) return;
  const t = setTimeout(() => {
    if (connecting) show({ title: 'Agent Warming Up', description: 'Still connecting…', variant: 'default' });
  }, Number(process.env.KIRO_WARN_SLOW_CONNECT_MS) || 8000);
  return () => clearTimeout(t);
}, [connecting]);
```

Stepper driven by events
```ts
useEffect(() => addMessageListener((msg) => {
  if (msg.type === 'agent_connect') setPhase('start');
  if (msg.type === 'agent_initialized') setPhase('init');
  if (msg.type === 'session_update' && msg.update?.type === 'session_created') setPhase('session');
}), []);
```

## Configuration

- KIRO_ACP_CONNECT_TIMEOUT_MS: default 120000
- KIRO_ACP_PROMPT_TIMEOUT_MS: default 60000
- KIRO_WARN_SLOW_CONNECT_MS: default 8000
- KIRO_ACP_AUTOSTART, KIRO_ACP_AUTOSTART_AGENTS: pre‑warm agents on server boot

## Implementation Checklist

Frontend
- [ ] Centralize per‑op timeouts in a small helper (ACP aware) used by ChatPage, ACPPage, SettingsPage.
- [ ] Add a header stepper: Start → Init → Session → Models (drive from WS events).
- [ ] Add a “Show logs” toggle that streams recent `agent_stderr` lines.
- [ ] Expose timeout settings in /settings and persist them.
- [ ] Add cancel buttons for Connecting and long Prompt.

Backend
- [ ] Document and surface `KIRO_ACP_AUTOSTART` to reduce cold start.
- [ ] Optionally log phase durations (spawn→init, init→session) for diagnostics.

Docs
- [x] This guide.
- [ ] Update multi‑agent ChatPage doc to link to this file.

## Notes

- Avoid adding hard request timeouts to the RPC layer for streaming ops. Let the UI own time expectations and recovery policy.
- The “slow connect” toast is an early warning; do not fail the operation prematurely if the agent is still progressing.

