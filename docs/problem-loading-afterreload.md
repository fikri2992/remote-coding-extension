# Problem Analysis: Git Data Loading Issues After Page Reload

## Issue Description
When navigating between menu items in the Git interface, data loads quickly and correctly. However, when the page is reloaded (F5 or browser refresh), the git history and other data gets stuck in a loading state and never completes.

## Root Cause Analysis

### 1. **WebSocket Connection Timing Issue**
The primary issue appears to be a race condition between:
- React component initialization and useEffect hooks
- WebSocket connection establishment
- Initial data requests

**Evidence:**
- GitPage.tsx sends initial requests in useEffect immediately on mount
- WebSocket connection may not be fully established when requests are sent
- No retry mechanism for failed initial requests

### 2. **Request ID Management Problem**
The git service uses a pending request map (`pendingMap.current`) to track operations:

```typescript
const request = (operation: string, options: any = {}) => {
  const id = `git_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  pendingMap.current[id] = operation;
  // ...
  sendJson({ type: 'git', id, data: { gitData: { operation, options } } });
};
```

**Potential Issues:**
- If WebSocket is not connected, `sendJson` returns false but loading states remain true
- No cleanup of pending requests on connection failure
- No timeout handling for stuck requests

### 3. **Loading State Management**
Loading states are set optimistically but may never be cleared if:
- WebSocket message is lost
- Server doesn't respond
- Connection drops during request

**Current Flow:**
```typescript
// Set loading state
if (operation === 'log') {
  setHistoryLoading(true);
}

// Send request (may fail silently)
sendJson({ type: 'git', id, data: { gitData: { operation, options } } });

// Loading state only cleared on successful response
if (op === 'log') {
  setHistoryLoading(false);
}
```

### 4. **WebSocket Connection State Not Checked**
The GitPage component doesn't verify WebSocket connection status before sending requests:

```typescript
// GitPage sends requests without checking connection
useEffect(() => {
  // These may fail if WebSocket isn't ready
  request('status');
  request('diff');
  request('log', { count: logCount });
}, []);
```

### 5. **No Error Recovery Mechanism**
When requests fail:
- No automatic retry
- No fallback behavior
- Loading states remain stuck
- User has no indication of what went wrong

## Technical Details

### WebSocket Connection Flow
1. **Page Load**: React components mount
2. **WebSocket Init**: ReconnectingWebSocket starts connecting
3. **Immediate Requests**: GitPage sends requests before connection confirmed
4. **Connection Established**: May happen after requests are sent
5. **Lost Requests**: Initial requests never reach server

### Server-Side Handling
The CLI server properly handles git operations when they arrive:
- Git service is initialized correctly
- Operations work when WebSocket is connected
- No server-side caching issues identified

### Client-Side State Management
```typescript
// Problem: No connection state check
const { sendJson, addMessageListener } = useWebSocket();

// Should be:
const { sendJson, addMessageListener, isConnected } = useWebSocket();
```

## Reproduction Steps
1. Open git page in browser
2. Navigate away and back (works fine - WebSocket stays connected)
3. Reload page (F5) - gets stuck loading
4. Check browser dev tools - see failed WebSocket messages or connection timing

## Impact Assessment
- **Severity**: High - Core functionality broken on reload
- **User Experience**: Poor - Users must navigate away and back to recover
- **Frequency**: Every page reload
- **Workaround**: Navigate to different page and back to git page

## Recommended Solutions

### 1. **Connection State Awareness** (High Priority)
```typescript
// Wait for connection before sending requests
useEffect(() => {
  if (isConnected) {
    request('status');
    request('diff');
    request('log', { count: logCount });
  }
}, [isConnected]);
```

### 2. **Request Timeout and Retry** (High Priority)
```typescript
const request = (operation: string, options: any = {}) => {
  // Add timeout
  const timeoutId = setTimeout(() => {
    delete pendingMap.current[id];
    setError(`Request timeout: ${operation}`);
    clearLoadingStates();
  }, 10000);
  
  // Store timeout for cleanup
  pendingMap.current[id] = { operation, timeoutId };
};
```

### 3. **Loading State Cleanup** (Medium Priority)
```typescript
// Clear loading states on component unmount or error
useEffect(() => {
  return () => {
    setLoading(false);
    setHistoryLoading(false);
    setCommitDiffLoading(false);
  };
}, []);
```

### 4. **Error Recovery UI** (Medium Priority)
- Add retry buttons for failed requests
- Show connection status indicator
- Provide manual refresh options

### 5. **Request Queuing** (Low Priority)
- Queue requests when WebSocket is disconnected
- Send queued requests when connection is restored

## Files to Modify
1. `src/webview/react-frontend/src/pages/GitPage.tsx` - Add connection awareness
2. `src/webview/react-frontend/src/components/WebSocketProvider.tsx` - Expose connection state
3. `src/webview/react-frontend/src/components/git/GitHistoryViewer.tsx` - Add error states

## Testing Strategy
1. Test page reload scenarios
2. Test with slow network connections
3. Test WebSocket disconnection/reconnection
4. Verify error recovery mechanisms
5. Test with git debug logging enabled

## Priority
**HIGH** - This breaks core functionality and creates poor user experience on every page reload.