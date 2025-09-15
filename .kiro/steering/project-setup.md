---
inclusion: always
---
# IMPORTANT
YOU MUST NOT RUNNING DEV or START command unless i ask you to
# cotg-cli Project Guide

## Project Overview
cotg-cli is a VSCode extension with CLI capabilities providing web-based remote development tools. It consists of three main components:
- **VSCode Extension**: Commands and webview panels
- **CLI Server**: Standalone server (`kiro-remote` binary) 
- **React Frontend**: Web interface for remote development

## Architecture Patterns

### Core Services
- **WebSocket Services**: Real-time communication for `git`, `fileSystem`, `terminal`
- **HTTP Server**: Static file serving and API endpoints
- **Extension Host**: VSCode integration and command handling

### Technology Stack
- Backend: TypeScript, Node.js, WebSocket (ws), Commander.js
- Frontend: React, TanStack Router, Tailwind CSS, Vite
- Build: TypeScript compiler, Vite, npm scripts

## Key Directory Structure
```
src/
├── cli/                    # CLI server implementation
│   ├── commands/           # CLI command handlers  
│   ├── services/           # Core services (git, filesystem, terminal)
│   └── server.ts           # Main CLI server
├── server/                 # Shared server components
├── webview/react-frontend/ # React application
└── extension.ts            # VSCode extension entry point
```

## Development Workflow

### Build Commands
- `npm run build` - Complete build (agent + CLI + frontend)
- `npm run compile` - CLI-only TypeScript compile
- `npm run dev:cli` - Quick CLI development cycle
- `npm run compile:watch` - TypeScript watch mode

### Running the Project
- **CLI Mode**: `npm run start:cli` → http://localhost:3900
- **Extension Mode**: F5 in VSCode → Command Palette: "Start Web Automation Server"

### Development Iteration
1. **CLI changes**: `npm run dev:cli` → restart server
2. **Frontend changes**: `npm run build:react` → refresh browser
3. **Extension changes**: `npm run build` → reload Extension Development Host (Ctrl+R)

## Configuration

### CLI Configuration
- Location: `.on-the-go/config.json`
- Initialize: `npm run init:cli`

### VSCode Settings
- Prefix: `webAutomationTunnel.*`
- Key settings: `httpPort` (3900), `useEnhancedUI` (true), `terminal.engineMode`

## Debugging & Troubleshooting

### Debug Environment Variables
- `KIRO_GIT_DEBUG=1` - Git service debugging
- `KIRO_FS_DEBUG=1` - Filesystem service debugging  
- `KIRO_DEBUG_TERMINAL=1` - Terminal debugging

### Common Issues
- **Build failures**: `npm run clean && npm install && npm run build`
- **Port conflicts**: Use `--port 3901` flag
- **Frontend not loading**: `npm run build:react`

### Status Checking
- `npm run test:cli` - Check server status
- `lsof -i :3900` - Check port usage (Unix/Linux)

## WebSocket API
- **Endpoint**: `ws://localhost:3900/ws`
- **Services**: Send messages with `service` field: `fileSystem`, `git`, `terminal`
- **Real-time**: Bidirectional communication for all core operations

## Testing Strategy
- **Manual testing preferred** - Start server and test via browser
- **Integration test**: VSCode Command Palette: "Run Enhanced UI Integration Test"
- **No automatic test creation** unless explicitly requested

## Performance Expectations
- Frontend build: ~5-6 seconds
- TypeScript compilation: ~2-3 seconds  
- CLI startup: ~1-2 seconds
- Memory usage: ~50-100MB
