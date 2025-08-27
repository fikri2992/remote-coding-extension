# Troubleshooting Guide

## Overview

This guide helps you diagnose and resolve common issues with the Vue.js frontend application. Issues are organized by category with step-by-step solutions and prevention tips.

## Connection Issues

### WebSocket Connection Failed

**Symptoms:**
- Connection status shows "Disconnected" or "Error"
- Real-time features not working
- Commands not executing
- Interface appears frozen

**Causes:**
- VS Code extension not running
- WebSocket server not started
- Network connectivity issues
- Firewall blocking connections
- Port conflicts

**Solutions:**

1. **Check VS Code Extension Status**
   ```bash
   # In VS Code, check if extension is active
   # Look for extension in Extensions panel
   # Verify extension is enabled and running
   ```

2. **Verify WebSocket Server**
   ```bash
   # Check if WebSocket server is running
   netstat -an | grep 3001  # Default WebSocket port
   
   # Or check process list
   ps aux | grep node
   ```

3. **Restart Services**
   ```bash
   # Restart VS Code extension
   # Use Command Palette: "Developer: Reload Window"
   
   # Or restart the entire VS Code instance
   ```

4. **Check Network Configuration**
   - Verify localhost resolution: `ping localhost`
   - Check firewall settings for port 3001
   - Ensure no other services using the same port

5. **Browser Console Debugging**
   ```javascript
   // Open browser DevTools (F12)
   // Check Console tab for WebSocket errors
   // Look for messages like:
   // "WebSocket connection to 'ws://localhost:3001' failed"
   ```

**Prevention:**
- Always start VS Code extension before opening the frontend
- Use consistent port configurations
- Monitor connection status indicator

### Slow Connection or High Latency

**Symptoms:**
- Commands take long time to execute
- File operations are slow
- Real-time updates delayed
- High latency numbers in connection status

**Solutions:**

1. **Check System Resources**
   ```bash
   # Monitor CPU and memory usage
   top
   # Or on Windows
   taskmgr
   ```

2. **Optimize WebSocket Configuration**
   ```typescript
   // In WebSocket composable configuration
   const config = {
     heartbeatInterval: 15000,  // Reduce from 30000
     messageTimeout: 5000,      // Reduce from 10000
     reconnectDelay: 500        // Reduce from 1000
   }
   ```

3. **Clear Browser Cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Clear browser cache and cookies
   - Disable browser extensions temporarily

4. **Network Diagnostics**
   ```bash
   # Test local network latency
   ping localhost
   
   # Check for network congestion
   netstat -i
   ```

## File System Issues

### File Operations Failing

**Symptoms:**
- Cannot create, delete, or rename files
- File tree not loading
- "Permission denied" errors
- File content not saving

**Solutions:**

1. **Check File Permissions**
   ```bash
   # Check workspace directory permissions
   ls -la /path/to/workspace
   
   # Fix permissions if needed
   chmod -R 755 /path/to/workspace
   ```

2. **Verify Workspace Path**
   ```typescript
   // Check if workspace path is correct
   console.log('Current workspace:', workspaceStore.workspaceFolders)
   
   // Verify path exists
   // In VS Code: File > Open Folder
   ```

3. **File System Locks**
   ```bash
   # Check for file locks (Linux/Mac)
   lsof /path/to/file
   
   # On Windows, check if files are open in other applications
   ```

4. **VS Code Integration**
   - Ensure VS Code has proper workspace access
   - Check VS Code settings for file associations
   - Verify no conflicting extensions

**Prevention:**
- Always open workspace in VS Code before using frontend
- Avoid editing files simultaneously in multiple applications
- Regular workspace cleanup

### File Tree Not Loading

**Symptoms:**
- Empty file explorer
- Loading spinner never stops
- Error messages in console

**Solutions:**

1. **Refresh File Tree**
   ```typescript
   // Manual refresh
   await fileSystemStore.loadFileTree()
   
   // Or use refresh button in interface
   ```

2. **Check WebSocket Connection**
   - Verify connection status
   - Check browser console for WebSocket errors
   - Restart connection if needed

3. **Large Directory Handling**
   ```typescript
   // For large directories, implement pagination
   const options = {
     maxDepth: 3,        // Limit tree depth
     maxFiles: 1000,     // Limit file count
     excludePatterns: ['node_modules', '.git']
   }
   ```

4. **Memory Issues**
   - Close unused browser tabs
   - Restart browser if memory usage is high
   - Consider virtual scrolling for large file lists

## Git Integration Issues

### Git Commands Not Working

**Symptoms:**
- Git status not updating
- Cannot stage or commit files
- Branch operations failing
- "Not a git repository" errors

**Solutions:**

1. **Verify Git Repository**
   ```bash
   # Check if directory is a git repository
   cd /path/to/workspace
   git status
   
   # Initialize if needed
   git init
   ```

2. **Check Git Configuration**
   ```bash
   # Verify git user configuration
   git config --list
   
   # Set if missing
   git config user.name "Your Name"
   git config user.email "your.email@example.com"
   ```

3. **Repository State Issues**
   ```bash
   # Check for merge conflicts
   git status
   
   # Reset if needed (caution: this discards changes)
   git reset --hard HEAD
   
   # Or resolve conflicts manually
   ```

4. **Permissions and Access**
   ```bash
   # Check .git directory permissions
   ls -la .git/
   
   # Fix if needed
   chmod -R 755 .git/
   ```

**Prevention:**
- Always work within a proper Git repository
- Keep Git configuration up to date
- Regular repository maintenance

### Git Status Not Updating

**Symptoms:**
- Changes not reflected in Git dashboard
- Stale branch information
- Incorrect file status indicators

**Solutions:**

1. **Manual Refresh**
   ```typescript
   // Force refresh Git status
   await gitStore.getStatus()
   await gitStore.getBranches()
   ```

2. **File System Watcher Issues**
   - Restart VS Code extension
   - Check if file system events are being captured
   - Verify no conflicting Git tools

3. **Repository Corruption**
   ```bash
   # Check repository integrity
   git fsck
   
   # Repair if needed
   git gc --prune=now
   ```

## Terminal Issues

### Terminal Not Connecting

**Symptoms:**
- Cannot create terminal sessions
- Terminal commands not executing
- "Connection refused" errors

**Solutions:**

1. **Check Terminal Service**
   ```bash
   # Verify terminal service is running
   ps aux | grep terminal
   
   # Check service logs
   ```

2. **Port Configuration**
   ```typescript
   // Verify terminal service port
   const terminalConfig = {
     port: 3002,  // Default terminal port
     host: 'localhost'
   }
   ```

3. **Shell Configuration**
   ```bash
   # Check default shell
   echo $SHELL
   
   # Verify shell is accessible
   which bash
   which zsh
   ```

4. **Permissions**
   ```bash
   # Check terminal execution permissions
   ls -la /bin/bash
   ls -la /bin/zsh
   ```

### Terminal Commands Hanging

**Symptoms:**
- Commands start but never complete
- No output from terminal
- Terminal becomes unresponsive

**Solutions:**

1. **Process Management**
   ```bash
   # Check for hung processes
   ps aux | grep [command]
   
   # Kill if necessary
   kill -9 [PID]
   ```

2. **Terminal Session Reset**
   ```typescript
   // Close and recreate terminal session
   await terminalStore.closeSession(sessionId)
   const newSessionId = await terminalStore.createSession()
   ```

3. **Resource Limits**
   - Check system memory and CPU usage
   - Limit concurrent terminal sessions
   - Avoid resource-intensive commands

## Performance Issues

### Slow Interface Response

**Symptoms:**
- UI feels sluggish
- Long delays between actions
- High CPU usage in browser

**Solutions:**

1. **Browser Performance**
   ```javascript
   // Check browser performance
   // Open DevTools > Performance tab
   // Record and analyze performance profile
   ```

2. **Vue.js Optimization**
   ```vue
   <!-- Use v-memo for expensive computations -->
   <div v-memo="[expensiveData]">
     {{ computedExpensiveValue }}
   </div>
   
   <!-- Use v-once for static content -->
   <div v-once>{{ staticContent }}</div>
   ```

3. **Virtual Scrolling**
   ```vue
   <!-- For large lists -->
   <VirtualList
     :items="largeDataSet"
     :item-height="50"
     :container-height="400"
   >
     <template #default="{ item }">
       <ListItem :data="item" />
     </template>
   </VirtualList>
   ```

4. **Memory Management**
   - Close unused browser tabs
   - Clear browser cache regularly
   - Monitor memory usage in DevTools

### Large File Handling

**Symptoms:**
- Browser freezes when opening large files
- Out of memory errors
- Slow file operations

**Solutions:**

1. **File Size Limits**
   ```typescript
   // Implement file size checks
   const MAX_FILE_SIZE = 1024 * 1024 * 10 // 10MB
   
   if (file.size > MAX_FILE_SIZE) {
     throw new Error('File too large for preview')
   }
   ```

2. **Streaming and Chunking**
   ```typescript
   // Read files in chunks
   const readFileInChunks = async (filePath: string) => {
     const chunkSize = 1024 * 1024 // 1MB chunks
     // Implementation for chunked reading
   }
   ```

3. **Lazy Loading**
   ```vue
   <!-- Load file content only when needed -->
   <FileViewer 
     :file-path="selectedFile"
     :lazy-load="true"
     :chunk-size="1024"
   />
   ```

## UI/UX Issues

### Responsive Design Problems

**Symptoms:**
- Layout breaks on mobile devices
- Elements overlapping
- Scrolling issues
- Touch interactions not working

**Solutions:**

1. **Viewport Configuration**
   ```html
   <!-- Ensure proper viewport meta tag -->
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   ```

2. **CSS Debugging**
   ```css
   /* Debug responsive issues */
   * {
     outline: 1px solid red; /* Temporary for debugging */
   }
   
   /* Check Tailwind breakpoints */
   @media (max-width: 768px) {
     /* Mobile styles */
   }
   ```

3. **Touch Events**
   ```typescript
   // Ensure touch events are handled
   const handleTouch = (event: TouchEvent) => {
     event.preventDefault()
     // Handle touch interaction
   }
   ```

### Theme and Styling Issues

**Symptoms:**
- Inconsistent colors
- Dark/light mode not working
- CSS classes not applying

**Solutions:**

1. **Theme Configuration**
   ```typescript
   // Check theme store
   const themeStore = useThemeStore()
   console.log('Current theme:', themeStore.currentTheme)
   
   // Force theme update
   themeStore.setTheme('dark')
   ```

2. **CSS Purging Issues**
   ```javascript
   // Check Tailwind configuration
   // Ensure classes are not being purged
   module.exports = {
     content: [
       './src/**/*.{vue,js,ts,jsx,tsx}',
       './index.html'
     ],
     // ...
   }
   ```

3. **CSS Specificity**
   ```css
   /* Use !important sparingly, prefer specificity */
   .component-class {
     @apply bg-blue-500 !important; /* Last resort */
   }
   ```

## Error Messages and Debugging

### Common Error Messages

#### "WebSocket connection failed"
- **Cause**: WebSocket server not running or unreachable
- **Solution**: Start VS Code extension and verify server status

#### "Command execution timeout"
- **Cause**: VS Code command taking too long or hanging
- **Solution**: Restart VS Code extension, check command validity

#### "File not found"
- **Cause**: File path incorrect or file deleted
- **Solution**: Refresh file tree, verify file exists

#### "Permission denied"
- **Cause**: Insufficient file system permissions
- **Solution**: Check and fix file/directory permissions

#### "Git repository not found"
- **Cause**: Working directory is not a Git repository
- **Solution**: Initialize Git repository or navigate to correct directory

### Debugging Tools

#### Browser DevTools
```javascript
// Console debugging
console.log('Debug info:', debugData)
console.error('Error details:', error)

// Network tab
// Check WebSocket connections
// Monitor HTTP requests

// Performance tab
// Profile application performance
// Identify bottlenecks
```

#### Vue DevTools
```javascript
// Install Vue DevTools browser extension
// Inspect component state
// Monitor Pinia store changes
// Debug reactive data
```

#### Application Logs
```typescript
// Enable debug logging
const DEBUG = import.meta.env.DEV

if (DEBUG) {
  console.log('Debug mode enabled')
}

// Log important events
const logEvent = (event: string, data?: any) => {
  if (DEBUG) {
    console.log(`[${new Date().toISOString()}] ${event}`, data)
  }
}
```

## Prevention and Best Practices

### Regular Maintenance

1. **Clear Browser Cache**
   - Weekly cache clearing
   - Use incognito mode for testing
   - Monitor storage usage

2. **Update Dependencies**
   ```bash
   # Check for updates
   npm outdated
   
   # Update packages
   npm update
   ```

3. **Monitor Performance**
   - Regular performance audits
   - Monitor memory usage
   - Check for memory leaks

### Development Best Practices

1. **Error Handling**
   ```typescript
   // Always wrap async operations
   try {
     await riskyOperation()
   } catch (error) {
     console.error('Operation failed:', error)
     // Handle error appropriately
   }
   ```

2. **Resource Management**
   ```typescript
   // Clean up resources
   onUnmounted(() => {
     // Close connections
     // Clear timers
     // Remove event listeners
   })
   ```

3. **Testing**
   - Test on different browsers
   - Verify mobile responsiveness
   - Test with slow network conditions

### Monitoring and Alerts

1. **Connection Monitoring**
   ```typescript
   // Monitor connection health
   const connectionHealth = computed(() => {
     return {
       isConnected: connectionStore.isConnected,
       latency: connectionStore.latency,
       lastConnected: connectionStore.lastConnected
     }
   })
   ```

2. **Error Tracking**
   ```typescript
   // Implement error reporting
   const reportError = (error: Error, context: string) => {
     console.error(`Error in ${context}:`, error)
     // Send to error tracking service
   }
   ```

3. **Performance Metrics**
   ```typescript
   // Track performance metrics
   const performanceMetrics = {
     loadTime: performance.now(),
     memoryUsage: performance.memory?.usedJSHeapSize,
     connectionLatency: connectionStore.latency
   }
   ```

## Getting Help

### Self-Diagnosis Checklist

Before seeking help, check:

- [ ] WebSocket connection status
- [ ] VS Code extension is running
- [ ] Browser console for errors
- [ ] Network connectivity
- [ ] File system permissions
- [ ] Git repository status
- [ ] System resources (CPU, memory)
- [ ] Browser cache and cookies

### Reporting Issues

When reporting issues, include:

1. **Environment Information**
   - Operating system and version
   - Browser and version
   - VS Code version
   - Extension version

2. **Error Details**
   - Exact error messages
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser console logs

3. **System State**
   - Connection status
   - File system state
   - Git repository status
   - Recent actions performed

### Support Resources

- **Documentation**: Check developer and user guides
- **Issue Tracker**: Search existing issues
- **Community**: Ask questions in project discussions
- **Logs**: Check application and browser logs

Remember: Most issues can be resolved by restarting the VS Code extension and refreshing the browser. When in doubt, try the simple solutions first!