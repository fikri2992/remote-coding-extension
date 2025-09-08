# Simple CLI Migration Plan

## Goal
Create a basic CLI that can:
1. Start a web server
2. Serve WebSocket connections  
3. Host the React frontend
4. Stop the server
5. Show basic status

## Current State Analysis

### What We Already Have
- ✅ React frontend in `src/webview/react-frontend/`
- ✅ WebSocket server implementation
- ✅ HTTP server with Express
- ✅ Basic CLI structure in `src/cli/`
- ✅ Server management logic

### What We Need to Remove
- ❌ VS Code extension entry point (`extension.ts`)
- ❌ Webview provider (`webview/provider.ts`)
- ❌ VS Code commands and configuration
- ❌ Extension-specific packaging

## Simple CLI Plan

### Phase 1: Basic CLI Structure (1-2 days)

#### 1.1 Create New CLI Entry Point
```bash
src/
├── cli/
│   ├── index.ts          # Main CLI entry
│   ├── commands/
│   │   ├── init.ts       # Initialize project structure
│   │   ├── start.ts      # Start server
│   │   ├── stop.ts       # Stop server  
│   │   └── status.ts     # Show status
│   └── server.ts         # Server wrapper
└── webview/
    └── react-frontend/   # Keep existing, just build differently
```

#### 1.2 Init Command Structure
The `init` command will create:
```
.on-the-go/
├── config.json          # Configuration file
├── prompts/             # Prompt templates
└── results/             # Output results
```

#### 1.3 Package.json Updates
```json
{
  "name": "kiro-remote-cli",
  "version": "1.0.0",
  "description": "Kiro Remote CLI",
  "main": "dist/cli/index.js",
  "bin": {
    "kiro-remote": "dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli/index.js start",
    "dev": "ts-node src/cli/index.ts start",
    "build:frontend": "cd src/webview/react-frontend && npm run build"
  },
  "dependencies": {
    "commander": "^11.1.0",
    "chalk": "^5.3.0"
  }
}
```

### Phase 2: Init Command Implementation (1 day)

#### 2.1 Create Init Command
Create `src/cli/commands/init.ts`:
```typescript
import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';

export const initCommand = new Command('init')
  .description('Initialize .on-the-go folder structure')
  .action(async () => {
    try {
      const onTheGoDir = '.on-the-go';
      
      // Create main directory
      await fs.mkdir(onTheGoDir, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(onTheGoDir, 'prompts'), { recursive: true });
      await fs.mkdir(path.join(onTheGoDir, 'results'), { recursive: true });
      
      // Create default config.json
      const config = {
        version: "1.0.0",
        server: {
          port: 3900,
          host: "localhost"
        },
        terminal: {
          shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
          cwd: process.cwd()
        },
        prompts: {
          directory: "./.on-the-go/prompts",
          autoSave: true
        },
        results: {
          directory: "./.on-the-go/results",
          format: "json"
        },
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(onTheGoDir, 'config.json'),
        JSON.stringify(config, null, 2)
      );
      
      // Create example prompt
      const examplePrompt = {
        name: "example-prompt",
        description: "Example prompt template",
        template: "Hello {{name}}! Welcome to {{app}}.",
        variables: ["name", "app"],
        created: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(onTheGoDir, 'prompts', 'example.json'),
        JSON.stringify(examplePrompt, null, 2)
      );
      
      console.log('✅ .on-the-go folder structure created successfully!');
      console.log('📁 .on-the-go/');
      console.log('   ├── config.json');
      console.log('   ├── prompts/');
      console.log('   └── results/');
      
    } catch (error) {
      console.error('❌ Failed to initialize .on-the-go folder:', error);
      process.exit(1);
    }
  });
```

#### 2.2 Config.json Structure
The config file will contain:
```json
{
  "version": "1.0.0",
  "server": {
    "port": 3900,
    "host": "localhost"
  },
  "terminal": {
    "shell": "bash",
    "cwd": "/current/working/directory"
  },
  "prompts": {
    "directory": "./.on-the-go/prompts",
    "autoSave": true
  },
  "results": {
    "directory": "./.on-the-go/results",
    "format": "json"
  },
  "created": "2024-01-01T00:00:00.000Z",
  "lastModified": "2024-01-01T00:00:00.000Z"
}
```

### Phase 3: Server Wrapper (1-2 days)

#### 3.1 Simple Server Manager
Create `src/cli/server.ts`:
```typescript
import { ServerManager } from '../server/ServerManager';
import { WebServer } from '../server/WebServer';

export class CliServer {
  private serverManager?: ServerManager;
  private webServer?: WebServer;
  private isRunning = false;

  async start(options: { port?: number } = {}) {
    if (this.isRunning) {
      console.log('Server is already running');
      return;
    }

    try {
      // Initialize server manager (no VS Code context needed)
      this.serverManager = new ServerManager();
      
      // Start the core server
      await this.serverManager.start();
      
      // Start web server with React frontend
      this.webServer = new WebServer(this.serverManager, options.port);
      await this.webServer.start();
      
      this.isRunning = true;
      console.log(`🚀 Server started on port ${this.webServer.getPort()}`);
      console.log(`📱 Web interface: http://localhost:${this.webServer.getPort()}`);
      
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Server is not running');
      return;
    }

    try {
      await this.webServer?.stop();
      await this.serverManager?.stop();
      this.isRunning = false;
      console.log('✅ Server stopped');
    } catch (error) {
      console.error('❌ Failed to stop server:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.webServer?.getPort(),
      serverStatus: this.serverManager?.getServerStatus()
    };
  }
}
```

#### 3.2 Basic CLI Commands
Create `src/cli/commands/start.ts`:
```typescript
import { Command } from 'commander';
import { CliServer } from '../server';

export const startCommand = new Command('start')
  .description('Start the Kiro Remote server')
  .option('-p, --port <number>', 'Port number', '3900')
  .action(async (options) => {
    const server = new CliServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await server.stop();
      process.exit(0);
    });

    try {
      await server.start({ port: parseInt(options.port) });
      
      // Keep process alive
      console.log('Press Ctrl+C to stop the server');
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });
```

### Phase 4: Web Server Updates (1 day)

#### 4.1 Modify Web Server to Serve React App
Update `src/server/WebServer.ts`:
```typescript
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

export class WebServer {
  private app: express.Application;
  private server?: any;
  private port: number;

  constructor(private serverManager: any, port: number = 3900) {
    this.app = express();
    this.port = port;
    this.setupRoutes();
  }

  private setupRoutes() {
    // Serve React frontend
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const frontendPath = path.join(__dirname, '../../webview/react-frontend/dist');
    
    this.app.use(express.static(frontendPath));
    
    // API routes
    this.app.get('/api/status', (req, res) => {
      res.json(this.serverManager.getServerStatus());
    });

    // Fallback to React app for any other routes
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

  async start() {
    return new Promise<void>((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Web server listening on port ${this.port}`);
        resolve();
      }).on('error', reject);
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Web server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort() {
    return this.port;
  }
}
```

#### 4.2 Update React Frontend for Standalone Use
Update `src/webview/react-frontend/src/lib/utils.ts`:
```typescript
// Remove VS Code specific API calls
export const postMessage = (message: any) => {
  // Use fetch API instead of VS Code webview messaging
  if (window.location.origin) {
    fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }
};

// Remove VS Code webview state management
export const getState = () => {
  return {
    // Basic state from localStorage or API
    serverUrl: window.location.origin
  };
};
```

### Phase 5: Remove VS Code Dependencies (1 day)

#### 5.1 Update ServerManager for CLI Use
Modify `src/server/ServerManager.ts`:
```typescript
// Remove VS Code context dependency
constructor(private context?: any) {  // Make context optional
  // Initialize without VS Code specific features
  this.initialize();
}

private initialize() {
  // Remove VS Code configuration watching
  // Remove VS Code secret storage
  // Use simple in-memory or file-based storage
}
```

#### 5.2 Clean Up Package.json
Remove VS Code specific fields:
```json
{
  // Remove these fields:
  // "engines": { "vscode": "..." },
  // "categories": ["Other"],
  // "activationEvents": [...],
  // "main": "./out/extension.js",
  // "contributes": {...}
  
  // Keep only CLI relevant fields
  "bin": {
    "kiro-remote": "./dist/cli/index.js"
  }
}
```

### Phase 6: Testing and Polish (1 day)

#### 6.1 Basic CLI Flow
```bash
# Install
npm install

# Build
npm run build

# Build frontend
npm run build:frontend

# Start server
npm start
# OR
node dist/cli/index.js start
# OR
npx kiro-remote start --port 3900
```

#### 6.2 Simple Status Command
Create `src/cli/commands/status.ts`:
```typescript
import { Command } from 'commander';
import { CliServer } from '../server';

export const statusCommand = new Command('status')
  .description('Show server status')
  .action(async () => {
    const server = new CliServer();
    const status = server.getStatus();
    
    if (status.isRunning) {
      console.log(`✅ Server is running on port ${status.port}`);
      console.log(`📱 Web interface: http://localhost:${status.port}`);
    } else {
      console.log('❌ Server is not running');
    }
  });
```

## Success Criteria

### Minimum Viable Product
- [ ] CLI init command creates .on-the-go folder structure
- [ ] CLI can start web server
- [ ] React frontend loads in browser
- [ ] WebSocket connections work
- [ ] Basic terminal functionality
- [ ] Server can be stopped gracefully

### Nice to Have
- [ ] Port configuration
- [ ] Status command
- [ ] Error handling
- [ ] Basic logging

## Files to Modify/Create

### New Files
- `src/cli/index.ts` - CLI entry point
- `src/cli/commands/init.ts` - Init command
- `src/cli/commands/start.ts` - Start command
- `src/cli/commands/stop.ts` - Stop command
- `src/cli/commands/status.ts` - Status command
- `src/cli/server.ts` - Server wrapper

### Modified Files
- `src/server/ServerManager.ts` - Remove VS Code dependencies
- `src/server/WebServer.ts` - Serve React app
- `package.json` - Update for CLI
- `src/webview/react-frontend/src/lib/utils.ts` - Remove VS Code APIs

### Files to Remove
- `src/extension.ts` - VS Code extension entry
- `src/webview/provider.ts` - VS Code webview provider
- `src/commands/` - VS Code commands

## Timeline
- **Day 1**: Basic CLI structure and init command
- **Day 2**: Server wrapper and basic commands
- **Day 3**: Web server updates and React frontend
- **Day 4**: Remove VS Code dependencies
- **Day 5**: Testing and polish
- **Day 6**: Documentation and final fixes

This simplified plan focuses on getting a working CLI that can run the web server and React frontend without the complexity of TUI or advanced features.