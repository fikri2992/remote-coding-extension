# ACP connection at server startup vs on‑demand (mobile reliability)

This note evaluates whether we should start the ACP agent connection during server/WebSocket server startup, based on the current lifecycle described in `docs/guide/acp-lifecycle.md`.

It compares the current "on‑demand" behavior with an optional "autostart" at boot, with specific focus on mobile reconnection reliability.

---

## Background (how it works today)

- Backend starts HTTP + WS in `src/cli/server.ts` and constructs a single `AcpHttpController` instance.
- The ACP agent process is NOT started until a client issues `{ type: 'acp', op: 'connect' }` over WebSocket.
- `AcpHttpController.connect()` is idempotent and reuses an existing connection if present. It wires all ACP events to a global `AcpEventBus` which the server broadcasts to all clients via WebSocket.
- Client WS drops/reconnects do not automatically kill the agent; the agent is a backend process. The UI re-issues `connect` (if needed) and uses `session.state`/`session_recovered` to restore state.

Key references:
- `src/cli/server.ts` — boot + WS service registration (`acp` routes to `AcpHttpController`).
- `src/acp/AcpHttpController.ts` — `connect()`, `newSession()`, `prompt()`, session recovery, event bridging.
- `src/acp/ACPConnection.ts` — spawns the agent and handles JSON‑RPC.
- `docs/guide/acp-lifecycle.md` — end‑to‑end flow and contracts.

---

## Option A — Keep on‑demand connect (current)

Pros:
- Minimal resource usage when ACP isn’t needed (no background process until a user connects).
- Fewer boot‑time failure modes (no agent login/API key issues blocking server startup).
- Simpler logs; agent stderr only appears when actively used.

Cons:
- First‑use latency: initial `connect → initialize` can add noticeable delay before the first prompt.
- If the agent exits while no client is connected, the next user will pay the startup cost again.

Mobile impact:
- Generally OK because the agent is backend‑scoped, not WS‑scoped. WS reconnects don’t drop the agent. The bigger factor is the UI re‑connecting and calling `session.state` / handling `session_recovered`.

---

## Option B — Autostart the ACP agent at server startup

What it means:
- After `AcpHttpController.init()` in `src/cli/server.ts`, proactively call `acpController.connect()` so the agent is initialized before any client appears.

Pros:
- Lower first‑interaction latency (agent pre‑warmed).
- Perceived reliability: when a mobile user returns after a drop, the agent is more likely already running.
- Connection state clearly owned by the backend, independent of any particular WS client (same as today), but now eagerly ensured.

Cons / risks:
- Boot dependency on credentials and environment:
  - If `ANTHROPIC_API_KEY` or equivalent is missing, `connect()` may fail and pollute startup logs (or require catch/suppress).
  - Claude’s interactive login cannot be performed headlessly at boot; the server would emit auth‑required errors that no client sees.
- Resource cost when unused: the agent will consume memory/CPU even with zero active users.
- Crash loops if we add auto‑respawn without backoff.
- Early events (e.g., `agent_initialized`) may be emitted before any clients are connected; they’re broadcast but not persisted.

Mobile impact:
- Improves “come back later and it’s ready” scenarios by removing cold starts. Does not change the fact that ACP is already server‑scoped.

---

## Option C — On‑demand with pre‑warm and health policy (recommended)

A middle ground that keeps the default lightweight but enables better UX for mobile with a toggle.

Suggested policy knobs (env‑gated, optional):
- `KIRO_ACP_AUTOSTART=1` — Attempt an eager `connect()` at server boot.
- `KIRO_ACP_AUTORESPAWN=1` — If the agent exits unexpectedly, schedule a reconnect with exponential backoff.
- `KIRO_ACP_IDLE_SHUTDOWN_MS=300000` — If no sessions/traffic for N ms, gracefully disconnect to free resources.
- `HTTPS_PROXY`/`HTTP_PROXY` — honored already; pass through when calling `connect()`.

Boot hook (illustrative placement):
- In `src/cli/server.ts`, after `await this.acpController.init()`:

```ts
try {
  if (process.env.KIRO_ACP_AUTOSTART === '1') {
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const env: Record<string, string> = {};
    if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    await this.acpController.connect({ env, proxy });
  }
} catch (e) {
  console.warn('[ACP] Autostart failed (non‑fatal):', (e as Error).message);
}
```

Operational notes:
- Keep the eager connect non‑fatal for server startup. Let the UI retry `connect` on demand.
- If `KIRO_ACP_AUTORESPAWN=1`, add a listener on `agent_exit` to schedule reconnection with backoff.
- If `KIRO_ACP_IDLE_SHUTDOWN_MS` is set, run a timer that checks recent ACP activity (session updates/prompts) and call `disconnect()` when idle.

---

## Decision matrix (mobile focus)

- Cold‑start latency matters for “open app → send first message” on mobile:
  - Autostart (B) or pre‑warm (C) reduces latency.
- Stability across drops: already achieved because ACP is backend‑scoped; focus on reconnection UX:
  - Ensure the UI calls `session.state` and handles `session_recovered` (already implemented in `ACPPage.tsx`/`ChatPage.tsx`).
  - Keep WS `ping`/`reconnecting-websocket` tuned (already in `WebSocketProvider`).
- Operational risk tolerance:
  - If credentials/auth can be missing at boot, prefer (C) with non‑fatal autostart and good backoff.

---

## Recommendation

- Keep current on‑demand behavior as the safe default.
- Add an optional, non‑fatal autostart gate (`KIRO_ACP_AUTOSTART=1`) with backoff‑based auto‑respawn and idle shutdown. This yields a better mobile experience without introducing new boot hard‑dependencies.
- Do not move ACP to be per‑WebSocket; it is already backend‑scoped and shared via `AcpEventBus`.

---

## Open questions / next steps

- What are acceptable idle thresholds for shutdown in your deployments?
- Do we need to persist the last `initialize` snapshot so late‑joining clients can render pre‑warm status without a round‑trip?
- Should we surface a server status endpoint that reports ACP readiness for health checks?
