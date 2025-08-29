# WebSocket Connection Debug Guide

## Issue Summary
The Vue frontend is experiencing WebSocket timeout errors when trying to load the file tree. The error "Message timeout after 10000ms" indicates that the WebSocket connection is not properly established or the server is not responding to commands.

## Root Cause Analysis
1. **Connection Service Not Initialized**: The `connectionService` was not being initialized in the App.vue component
2. **Short Timeout**: The default 10-second timeout was too short for file operations
3. **Missing Error Handling**: Insufficient error handling and debugging information
4. **Server Not Running**: The WebSocket server may not be running on the expected port (8081)
5. **SPA Routing Issue**: The HTTP server was not handling Single Page Application routes properly, causing 404 errors on direct access or refresh

## Fixes Applied

### 1. App.vue - Connection Service Initialization
- Added proper initialization of `connectionService` in the `onMounted` lifecycle
- Added error handling for connection failures
- Added proper cleanup in `onUnmounted`

### 2. useFileSystem.ts - Enhanced Error Handling
- Added connection status checks before sending messages
- Increased timeout from 10s to 15s for file operations
- Added detailed logging for debugging
- Improved error messages with specific guidance

### 3. useWebSocket.ts - Better Response Handling
- Added connection status validation before sending messages
- Enhanced logging for message sending and receiving
- Improved timeout error messages with context

### 4. Connection Service - Enhanced Debugging
- Added detailed logging for WebSocket URL determination
- Increased message timeout to 15 seconds
- Better error reporting with context

### 5. UI Components - Debug Tools
- Added `ConnectionStatus.vue` component for real-time connection monitoring
- Added debug button in FileExplorer for manual testing
- Enhanced AppFooter with connection status display

## Testing Instructions

### Step 1: Start the Server with SPA Routing Support
```bash
# Run the test server that includes both HTTP and WebSocket servers with SPA routing
node test-spa-routing.js
```

This will start:
- HTTP Server on port 8080 (with SPA routing support)
- WebSocket Server on port 8081

**Alternative servers for testing:**
```bash
# Simple SPA-aware HTTP server only
node spa-server.js

# Original WebSocket test server
node test-websocket-connection.js
```

### Step 2: Open the Frontend
1. Open http://localhost:8080 in your browser
2. Open browser developer tools (F12)
3. Check the Console tab for connection logs

### Step 3: Monitor Connection Status
- Look at the footer of the application for connection status indicator
- Green dot = Connected
- Yellow dot (pulsing) = Connecting/Reconnecting
- Red dot = Error
- Gray dot = Disconnected

### Step 4: Test File Tree Loading
1. Navigate to the Files view
2. Click the "🔧 Debug" button in the file explorer header
3. Check console logs for detailed debugging information

### Step 5: Manual Testing
1. Try refreshing the file tree using the refresh button
2. Check if the connection status changes
3. Look for specific error messages in the console

## Expected Console Output

### Successful Connection:
```
🚀 Vue Frontend Starting...
🎉 Vue.js Frontend Application Initialized
🔌 Initializing connection service...
🔌 VS Code webview detected, connecting to ws://localhost:8081
✅ Connection service initialized successfully
📁 Loading file tree for path: .
📤 Sending message with ID msg_xxx: {...}
📥 Received response for message msg_xxx: {...}
✅ Response success for msg_xxx
✅ File tree loaded successfully: X nodes
```

### Connection Failure:
```
🚀 Vue Frontend Starting...
🎉 Vue.js Frontend Application Initialized
🔌 Initializing connection service...
🔌 VS Code webview detected, connecting to ws://localhost:8081
❌ Failed to initialize connection service: [Error details]
⚠️ WebSocket not connected, attempting to load file tree anyway...
❌ Failed to load file tree: WebSocket connection not available
```

## Troubleshooting

### Issue: "WebSocket connection not available"
**Solution**: Ensure the WebSocket server is running on port 8081
```bash
node test-websocket-connection.js
```

### Issue: "Message timeout after 15000ms"
**Possible Causes**:
1. Server is not responding to the specific command
2. Server is overloaded or crashed
3. Network connectivity issues

**Solution**: 
1. Check server logs for errors
2. Restart the server
3. Check if the command handler exists on the server

### Issue: "Failed to connect to WebSocket server"
**Possible Causes**:
1. Server not running
2. Port 8081 is blocked or in use
3. CORS issues

**Solution**:
1. Verify server is running: `netstat -an | grep 8081`
2. Check for port conflicts
3. Verify CORS settings in server configuration

### Issue: "404 Not Found when accessing /files directly"
**Root Cause**: Single Page Application (SPA) routing issue - the server doesn't know how to handle client-side routes.

**Solution**: The HttpServer has been updated with SPA routing support:
- Routes like `/files`, `/automation`, `/git` now serve the main `index.html`
- Static assets (files with extensions) are served normally
- Client-side routing handles the rest

**Test**: 
1. Start server with `node test-spa-routing.js`
2. Access http://localhost:8080/files directly
3. Refresh the page - should still work
4. Navigate between sections and refresh - no 404 errors

## Debug Commands

### Check WebSocket Connection in Browser Console:
```javascript
// Check if WebSocket is available
console.log('WebSocket available:', typeof WebSocket !== 'undefined')

// Manual WebSocket test
const ws = new WebSocket('ws://localhost:8081')
ws.onopen = () => console.log('✅ WebSocket connected')
ws.onerror = (error) => console.error('❌ WebSocket error:', error)
ws.onclose = (event) => console.log('🔌 WebSocket closed:', event)
```

### Check Network Tab:
1. Open Developer Tools → Network tab
2. Filter by "WS" (WebSocket)
3. Look for connection attempts to localhost:8081
4. Check connection status and messages

## Server-Side Debugging

### Check if Server is Running:
```bash
# Check if port 8081 is listening
netstat -an | grep 8081
# or
lsof -i :8081
```

### Server Logs:
Look for these messages when starting the server:
```
✅ Servers started successfully!
🌐 HTTP Server: http://localhost:8080
🔌 WebSocket Server: ws://localhost:8081
```

## Next Steps

If the issue persists after following this guide:

1. **Check Server Implementation**: Verify that the WebSocket server properly handles the `vscode.workspace.getFileTree` command
2. **Network Analysis**: Use Wireshark or similar tools to analyze WebSocket traffic
3. **Server Logs**: Enable detailed logging on the server side to see incoming messages
4. **Alternative Ports**: Try different ports if 8081 is not available
5. **Firewall/Antivirus**: Check if security software is blocking the connection

## Files Modified

### Frontend Changes:
1. `src/webview/vue-frontend/src/App.vue` - Added connection service initialization
2. `src/webview/vue-frontend/src/composables/useFileSystem.ts` - Enhanced error handling
3. `src/webview/vue-frontend/src/composables/useWebSocket.ts` - Better response handling
4. `src/webview/vue-frontend/src/services/connection.ts` - Enhanced debugging
5. `src/webview/vue-frontend/src/components/common/ConnectionStatus.vue` - New component
6. `src/webview/vue-frontend/src/components/layout/AppFooter.vue` - Added connection status
7. `src/webview/vue-frontend/src/components/files/FileExplorer.vue` - Added debug functionality

### Backend Changes:
8. `src/server/HttpServer.ts` - Added SPA routing support
9. `simple-server.js` - Updated with SPA routing logic

### Test Scripts:
10. `test-websocket-connection.js` - WebSocket connection test
11. `test-spa-routing.js` - Complete server test with SPA routing
12. `spa-server.js` - Standalone SPA-aware HTTP server

## Additional Resources

- [WebSocket API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Vue.js Debugging Guide](https://vuejs.org/guide/scaling-up/testing.html)
- [Browser Developer Tools](https://developer.chrome.com/docs/devtools/)