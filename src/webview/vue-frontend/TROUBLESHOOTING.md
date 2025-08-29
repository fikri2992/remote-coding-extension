# Vue Frontend Troubleshooting Guide

## ✅ **FIXED: localhost:8080 Loading Issue**

### Problem
- Accessing `localhost:8080` showed infinite loading or "Aw, Snap!" error
- Vue frontend was not accessible

### Root Cause
- Vite dev server was configured to run on port 5173 (default)
- You were trying to access port 8080
- Complex initialization in main.ts was causing crashes

### Solution Applied
1. **✅ Updated Vite config** to run on port 8080
2. **✅ Simplified main.ts** to reduce initialization complexity
3. **✅ Fixed import issues** in App.vue
4. **✅ Updated proxy configuration** for API calls

## 🚀 **How to Start the Frontend**

### Method 1: NPM Script (Recommended)
```bash
cd src/webview/vue-frontend
npm run dev
```

### Method 2: Direct Vite Command
```bash
cd src/webview/vue-frontend
npx vite --host --port 8080
```

### Expected Output
```
VITE v5.4.19  ready in 1532 ms

➜  Local:   http://localhost:8080/
➜  Network: http://192.168.1.20:8080/
```

## 🌐 **Access URLs**

- **Local Development**: http://localhost:8080/
- **Network Access**: http://[your-ip]:8080/
- **VS Code Webview**: Will use the built version

## 🔧 **Configuration Changes Made**

### vite.config.ts
```typescript
server: {
  port: 8080,        // Changed from 5173
  host: true,
  open: false,
  cors: true,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',  // Updated proxy target
      changeOrigin: true,
      secure: false
    }
  }
}
```

### main.ts
- ✅ Simplified initialization
- ✅ Removed complex error handling setup
- ✅ Removed plugin configurations that could cause crashes
- ✅ Added basic console logging

### App.vue
- ✅ Removed error-handler imports
- ✅ Simplified initialization
- ✅ Added console logging for debugging

## 🐛 **Common Issues & Solutions**

### Issue: "Aw, Snap!" Error
**Cause**: JavaScript errors during initialization
**Solution**: Check browser console (F12) for error details

### Issue: Infinite Loading
**Cause**: Network issues or wrong port
**Solution**: Ensure dev server is running on correct port

### Issue: "Cannot GET /"
**Cause**: Dev server not started or wrong URL
**Solution**: Start dev server with `npm run dev`

### Issue: Theme Not Working
**Cause**: CSS not loading or theme store issues
**Solution**: Check if Tailwind CSS is properly loaded

### Issue: Sidebar Not Responsive
**Cause**: CSS classes not applied or JavaScript errors
**Solution**: Check browser console and ensure stores are working

## 🔍 **Debugging Steps**

### 1. Check Dev Server Status
```bash
# Should show server running on port 8080
npm run dev
```

### 2. Check Browser Console
- Open browser dev tools (F12)
- Look for JavaScript errors in Console tab
- Check Network tab for failed requests

### 3. Check Component Loading
- Look for Vue component mount messages in console
- Verify all imports are working

### 4. Check Store Initialization
- Verify Pinia stores are loading correctly
- Check if theme and UI stores are working

## 📱 **Testing Checklist**

### Basic Functionality
- [ ] Page loads at localhost:8080
- [ ] No JavaScript errors in console
- [ ] Header, sidebar, and footer render
- [ ] Navigation works between views

### Theme System
- [ ] Theme toggle button works
- [ ] Dark/light modes switch correctly
- [ ] Theme persists on page refresh

### Responsive Design
- [ ] Sidebar collapses on mobile
- [ ] Layout adapts to different screen sizes
- [ ] Touch interactions work on mobile

### Connection Status
- [ ] Connection indicator shows in header
- [ ] Status colors are correct (green/yellow/red)
- [ ] Latency displays when connected

## 🎯 **Next Steps**

1. **✅ Frontend now works on localhost:8080**
2. **Build for production**: `npm run build`
3. **Connect to real backend**: Update API endpoints
4. **Test in VS Code webview**: Use built version
5. **Add more features**: Enhance functionality as needed

## 📞 **Getting Help**

If you encounter issues:
1. Check browser console for errors
2. Verify dev server is running
3. Check network connectivity
4. Review this troubleshooting guide
5. Check the SIDEBAR_FIXES_SUMMARY.md for recent changes

**Status**: ✅ **RESOLVED** - Vue frontend now works correctly on localhost:8080