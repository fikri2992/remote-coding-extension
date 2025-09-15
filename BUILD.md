# How This Project Is Built

This document explains the build architecture, processes, and toolchain for the Coding on the Go (COTG) CLI project.

## Project Architecture Overview

COTG is a multi-component Node.js application consisting of:

1. **CLI Server** - TypeScript backend with WebSocket and HTTP services
2. **React Frontend** - Modern web UI built with Vite and React
3. **ACP Agent** - Agent Client Protocol integration (workspace dependency)
4. **Cross-platform Binaries** - Packaged executables for distribution

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript with strict configuration
- **CLI Framework**: Commander.js for command-line interface
- **WebSocket**: `ws` library for real-time communication
- **HTTP Server**: Custom implementation with static file serving
- **Process Management**: UUID-based session tracking

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5 for fast development and optimized builds
- **Routing**: TanStack Router for type-safe routing
- **Styling**: Tailwind CSS with custom design system
- **Terminal**: xterm.js for terminal emulation
- **Code Editor**: CodeMirror 6 for syntax highlighting
- **WebSocket**: reconnecting-websocket for connection resilience

### Development Tools
- **TypeScript**: Strict configuration with comprehensive type checking
- **ESLint**: Code quality and consistency enforcement
- **Prettier**: Code formatting (via .prettierrc.json)
- **pkg**: Binary packaging for cross-platform distribution
- **Concurrently**: Parallel development server execution

## Build Process

### 1. Multi-Stage Build Pipeline

The build process follows a specific order to handle dependencies:

```bash
npm run build
```

This executes:
1. `npm run clean` - Remove previous build artifacts
2. `npm run build:agent` - Build ACP agent workspace
3. `npm run compile` - Compile TypeScript to JavaScript
4. `npm run build:react` - Build React frontend with Vite

### 2. TypeScript Compilation

**Configuration**: `tsconfig.json`
- Target: ES2020 for modern Node.js compatibility
- Module: CommonJS for Node.js runtime
- Output: `out/` directory with source maps
- Strict mode enabled with comprehensive type checking

**Included Files**:
- CLI commands and services (`src/cli/**/*.ts`)
- Server components (`src/server/**/*.ts`)
- Type definitions (`src/types/**/*.d.ts`)

**Excluded Files**:
- React frontend (handled by Vite)
- Test files
- VS Code extension code (legacy)

### 3. React Frontend Build

**Location**: `src/webview/react-frontend/`
**Build Tool**: Vite with React plugin

**Configuration** (`vite.config.ts`):
- TypeScript compilation with React JSX
- Path aliases (`@/` → `./src/`)
- WebSocket proxy to backend (`/ws` → `ws://localhost:3900`)
- Development server with hot module replacement

**Output**: `src/webview/react-frontend/dist/`
- Optimized bundle with code splitting
- Static assets with content hashing
- Source maps for debugging

### 4. ACP Agent Integration

**Location**: `claude-code-acp/` (workspace)
**Purpose**: Agent Client Protocol implementation

Built separately as a workspace dependency:
```bash
npm run build:agent
```

Provides AI agent capabilities through standardized protocol.

## Development Workflows

### Full Development Mode
```bash
npm run dev:full
```
- Starts backend server with TypeScript compilation
- Launches Vite dev server with HMR
- Proxies WebSocket connections
- Enables real-time development

### Backend-Only Development
```bash
npm run dev:server
```
- Compiles TypeScript and starts server
- Skips frontend build for faster iteration
- Useful for API and WebSocket development

### Frontend-Only Development
```bash
npm run dev:frontend
```
- Runs Vite dev server with proxy
- Assumes backend is running separately
- Optimal for UI development

## Binary Packaging

### Cross-Platform Distribution

**Tool**: pkg (Vercel's binary packager)
**Configuration**: `pkg.config.json`

**Targets**:
- Windows x64 (node18-win-x64)
- macOS x64 (node18-macos-x64)
- Linux x64 (node18-linux-x64)

**Assets Included**:
- React frontend build (`src/webview/react-frontend/dist/**/*`)
- ACP agent build (`claude-code-acp/dist/**/*`)
- Zed Industries dependencies (`node_modules/@zed-industries/**/*`)
- Compiled JavaScript (`out/**/*.js`)

**Output**: `./dist/` directory with platform-specific binaries

### Build Command
```bash
npm run package:cli
```

Creates standalone executables that include:
- Node.js runtime
- Application code
- Static assets
- Dependencies

## Configuration Management

### Build Configuration Files

1. **TypeScript** (`tsconfig.json`)
   - Strict type checking
   - ES2020 target for Node.js compatibility
   - Source maps for debugging

2. **React Frontend** (`src/webview/react-frontend/tsconfig.json`)
   - Modern ES2020 with DOM types
   - Bundler module resolution
   - React JSX transformation

3. **Styling** (`tailwind.config.js`, `postcss.config.js`)
   - Custom design system
   - Autoprefixer for browser compatibility
   - Content scanning for unused CSS removal

4. **Packaging** (`pkg.config.json`)
   - Cross-platform binary targets
   - Asset inclusion rules
   - Output configuration

### Environment-Specific Builds

**Development**:
- Source maps enabled
- Hot module replacement
- Proxy configuration for API calls

**Production**:
- Minified bundles
- Optimized assets
- Tree-shaking for smaller bundle size

## Build Scripts Reference

### Primary Commands
- `npm run build` - Complete production build
- `npm run dev:full` - Full development environment
- `npm run package:cli` - Create distribution binaries

### Component-Specific
- `npm run compile` - TypeScript compilation only
- `npm run build:react` - React frontend only
- `npm run build:agent` - ACP agent only

### Utility Commands
- `npm run clean` - Remove build artifacts
- `npm run lint` - Code quality checks
- `npm run setup` - Development environment setup

## Build Performance

### Typical Build Times
- TypeScript compilation: ~2-3 seconds
- React frontend build: ~5-6 seconds
- Complete build: ~8-10 seconds
- Binary packaging: ~15-20 seconds

### Optimization Strategies
- Incremental TypeScript compilation with watch mode
- Vite's fast HMR for frontend development
- Parallel execution of independent build steps
- Selective rebuilding based on changed components

## Troubleshooting Build Issues

### Common Problems

1. **TypeScript Errors**
   - Check `tsconfig.json` includes/excludes
   - Verify type definitions are installed
   - Run `npm run compile` for detailed errors

2. **React Build Failures**
   - Ensure frontend dependencies are installed
   - Check Vite configuration
   - Verify path aliases are correct

3. **Binary Packaging Issues**
   - Confirm all assets are included in pkg config
   - Check Node.js version compatibility
   - Verify output directory permissions

### Debug Commands
```bash
# Check build status
npm run test:cli

# Verbose TypeScript compilation
npx tsc --noEmit --listFiles

# Analyze bundle size
cd src/webview/react-frontend && npm run build -- --analyze
```

## Continuous Integration

The build process is designed to be CI-friendly:
- Deterministic builds with locked dependencies
- Clear success/failure exit codes
- Comprehensive error reporting
- Platform-specific artifact generation

This architecture enables reliable, fast builds while maintaining code quality and cross-platform compatibility.