# Chat loading indicator remains after reply completes

## Summary
The chat UI shows the nice three-dot typing indicator even after the assistant has finished replying. This indicates the `isTyping` state is not being cleared under certain conditions.

Affected UI: `src/webview/react-frontend/src/pages/ChatPage.tsx` (typing indicator around lines ~120–177 and ~1008–1019).

## Symptoms
- After sending a prompt, the reply renders fully.
- The typing indicator bubble (three bouncing dots) remains visible indefinitely.
- Cancelling or sending another message often clears it.

## Root cause analysis
There are two likely contributing issues in the typing-state logic:

1. "Active tool calls" never clear when status is "success"
   - Code path: `ChatPage.tsx` inside the `addMessageListener` callback.
   - We mark a tool call as active on statuses matching `(start|running|in_progress|progress|execut)` and clear it when status matches `(succeed|done|complete|finish|failed|error|cancel)`.
   - If the backend reports a terminal status like `success` (note: not `succeeded`) or `ok`, the current regex does not match any of the completion terms, so the tool call id remains in `activeToolCallsRef`. That makes `hasActive === true`, which prevents `isTyping` from being cleared.

2. Debounce check races with `sendingRef`
   - We schedule a single timeout (1200ms) after each update to potentially clear `isTyping`:
     ```ts
     typingTimeoutRef.current = setTimeout(() => {
       const hasActive = Object.values(activeToolCallsRef.current).some(Boolean);
       if (!hasActive && !sendingRef.current) {
         setIsTyping(false);
       }
     }, 1200);
     ```
   - If the timeout fires while `sendingRef.current` is still true, we do nothing and do not reschedule. If no more updates arrive (which is common after the final assistant message), `isTyping` stays stuck on.

Both issues can reproduce the stuck indicator independently; together they make it more likely.

## Proposed fixes

1) Normalize tool-call statuses and widen completion matching
- Accept `success`, `ok`, `completed`, and `finished` variants explicitly.
- Alternatively, map any status string to one of `running | completed | failed | canceled` and update the `activeToolCallsRef` off that normalized value.

Example change (conceptual):
```ts
const st = String(tc?.status || update?.status || '').toLowerCase();
const isRunning = /(start|running|in_progress|progress|execut|queued|pending)/.test(st);
const isDone = /(succeed|success|done|complete|completed|finish|finished|ok|failed|error|cancel|canceled|cancelled|timeout)/.test(st);
if (id) {
  if (isRunning) {
    activeToolCallsRef.current[id] = true;
    keepTyping = true;
  } else if (isDone) {
    delete activeToolCallsRef.current[id];
  }
}
```

2) Remove the one-shot race with `sendingRef`
- When `sending` flips from `true` to `false`, run the same clearing check. This guarantees we’ll clear `isTyping` even if the earlier timeout fired too early.

Example:
```ts
useEffect(() => {
  if (!sending) {
    const hasActive = Object.values(activeToolCallsRef.current).some(Boolean);
    if (!hasActive) {
      setIsTyping(false);
    }
  }
}, [sending]);
```

3) Add a quiet-period fallback
- If there have been no updates for N seconds (e.g., 2–3s) and `sending === false` and no active tools, force-hide the indicator.
- Implement via a lightweight interval or by recording a `lastActivityAt` timestamp and checking it when `sending` flips false.

4) Ensure resets on thread/session changes and on errors
- Clear `isTyping` and `activeToolCallsRef.current` when switching sessions or when a `Prompt Error` is shown.
- Some of this is already done (e.g., error path), but making it explicit helps.

## Code locations to change
- Typing indicator logic: `ChatPage.tsx`, within the `useEffect` started at line ~138 (the WebSocket message handler) and the `isTyping` rendering at lines ~1008–1019.
- The `sending` state transitions: `handleSend()` around lines ~414–474.

## Test plan
- Reproduce a prompt and verify the indicator hides shortly after the assistant’s final message.
- Verify tool-call paths:
  - Simulate a tool call reporting `status: "success"` and ensure it clears properly.
  - Simulate `status: "failed"` and `status: "cancelled"` also clear.
- Race condition validation:
  - Add a small artificial delay before `setSending(false)` in `handleSend` to ensure the `sending`-flip effect clears the indicator even when the debounce fired early.
- Session navigation:
  - Switch sessions while the indicator is on; verify it resets to a correct state for the new session.

## Quick temporary workarounds
- Trigger any event that causes the listener to run (e.g., send a no-op prompt or toggle a session) to force the debounce to re-run.
- If stuck due to `success` status, future updates will likely clear it once the regex is fixed.

## Next steps
- Implement fixes (1) and (2) above in `ChatPage.tsx`.
- Optional: introduce a small helper for typing-state management to centralize logic (normalize statuses, schedule/clear timers, react to `sending` changes).
- After code change, run through the test plan and add a small unit test or an integration test for the status normalization utility if feasible.
