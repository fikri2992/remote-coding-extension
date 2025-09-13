# Prompt timeout in ChatPage ("acp timeout for op=prompt")

This document explains why you sometimes see a red toast like:

> Prompt Error — acp timeout for op=prompt

and how to diagnose and fix it in this repo.

## What the error means

The front-end sends ACP requests over WebSocket and expects one `acp_response` for each request. If no response arrives within the client timeout window, the promise rejects with a timeout error.

- Client timeout is defined in `src/webview/react-frontend/src/components/WebSocketProvider.tsx` in `sendAcp(...)`.
- Default timeout is currently 15s (`opts?.timeoutMs ?? 15000`).
- `ChatPage` calls `wsFirst('prompt', { prompt })` without overriding the default timeout.

So if the backend takes longer than ~15 seconds to complete the `prompt` operation or if the response is lost (e.g., due to a temporary WebSocket reconnect), the client will surface the timeout.

## Where this happens in code

- Front-end ACP wrapper:
  - `src/webview/react-frontend/src/components/WebSocketProvider.tsx` → `sendAcp(op, payload, opts?)`
    - Default timeout: `Math.max(1000, Math.min(60000, opts?.timeoutMs ?? 15000))`
- Chat page send flow:
  - `src/webview/react-frontend/src/pages/ChatPage.tsx` → `handleSend()`
    - Uses `const wsFirst = async <T=any>(op: string, payload: any): Promise<T> => await sendAcp(op, payload)`
    - `await wsFirst('prompt', { prompt })` (no custom timeout)
- Backend routing:
  - `src/server/WebSocketServer.ts` (generic service routing for `type: 'acp'`)
  - `src/cli/server.ts` registers `acp` service and forwards `op: 'prompt'` to `AcpHttpController.prompt(payload)`

## Common root causes

- __Long-running prompt__: Model inference and/or tools can exceed 15s easily, especially on first-token latency or when executing tool calls.
- __WebSocket reconnect during prompt__: If the browser dev server or network hiccups cause a reconnect mid-operation, the final `acp_response` may be delivered to the old socket and never reach the new one. The client still awaits the original request ID and times out.
- __Proxy/Origin issues under dev__: If the WS proxy cycles or drops frames, the server may finish the work but the response frame is lost.

Recent mitigations already in repo:
- `vite.config.ts/js` `changeOrigin: true` for `/ws` and explicit WS target.
- Server allowlist extended (and relaxed in dev) in `src/server/WebSocketServer.ts` and improved heartbeat.
- Client app-level pings and server-side heartbeat tweaks, reducing unintended disconnects.

These mitigations reduce reconnects but don’t entirely eliminate long-running prompts.

## Quick fixes (front-end)

1) __Increase timeout for prompt requests__

Change the local `wsFirst` helper to accept options and pass a longer timeout for `prompt`.

```ts
// src/webview/react-frontend/src/pages/ChatPage.tsx
const wsFirst = async <T = any>(op: string, payload: any, opts?: { timeoutMs?: number }): Promise<T> =>
  await sendAcp(op, payload, opts);

// In handleSend(), use a higher timeout for prompt
await wsFirst('prompt', { prompt }, { timeoutMs: 60000 }); // 60s
```

Alternatively, special-case the op name:

```ts
const wsFirst = async <T = any>(op: string, payload: any): Promise<T> =>
  await sendAcp(op, payload, op === 'prompt' ? { timeoutMs: 60000 } : undefined);
```

2) __Show progress while waiting__

Since updates stream via the WS event bus, keep the UI responsive with a spinner or “Thinking…” indicator while `prompt` is in-flight, and only treat it as a hard failure when the timeout triggers.

## Robust fixes (recommended)

1) __Ack-then-stream pattern on the server__

Make the `acp` handler for `prompt` return an immediate 202-style acknowledgement (an `acp_response` with `ok: true` and a small payload such as `{ accepted: true, sessionId, requestId }`), then stream the rest of the updates over the normal WS update channel. This way the request gets its response quickly and is not held hostage by long model/tool runs.

Where to change:
- `src/cli/server.ts` → inside the `'acp'` service `switch (operation)`, case `'prompt'` delegate can return early with an ack and do work async.

2) __Rebind responses after reconnect__

If a reconnect occurs mid-prompt, responses may go to the stale socket. A session-aware router could deliver the final `acp_response` to the latest connection associated with `sessionId` instead of the socket that originated the request.

Where to change:
- `src/server/WebSocketServer.ts` service routing. Track `sessionId → connectionId` mapping and deliver ACP responses accordingly.

3) __Client-side retry after reconnect__

If the socket reconnects while waiting, the client can:
- Call `session.ensureActive` or `session.state` to rebind.
- Optionally re-issue a “status” query for the last request.

## Diagnostics checklist

- __Browser console__
  - Confirm `🔽 WebSocket Received` and `🔼 WebSocket Sending` logs. Ensure `KIRO_DEBUG_WS` is set to `1` in localStorage (already handled in `WebSocketProvider`).
- __Server logs__
  - Look for `WebSocket connection closed:` or `Terminating dead connection:` around the time of the prompt.
  - Check ACP controller logs for how long the prompt took and whether an error occurred late.
- __Network__
  - Verify Vite WS proxy stability (no repeated `write ECONNABORTED`).

## TL;DR

- The timeout originates from the 15s default in `sendAcp`. Long prompts or WS reconnects can exceed that window.
- Short-term: increase prompt timeout to 60s on the client.
- Long-term: switch to an ack-then-stream server pattern and make responses session-aware so reconnects don’t drop them.
