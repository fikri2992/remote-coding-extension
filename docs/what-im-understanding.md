# What I Understand About Kiro Remote

## Project Overview

**Kiro Remote** is a VS Code extension that provides remote development capabilities through web automation tunnels. Despite the package.json showing "Basic VSCode Extension", this is actually a sophisticated remote control system designed with mobile-first principles for managing VS Code workspaces remotely.

## Core Purpose

The extension enables developers to:
- Control VS Code remotely through a web interface
- Access file systems, terminals, and Git operations from mobile devices
- Collaborate in real-time through chat and state synchronization
- Expose local development servers through secure tunnels (Cloudflare)

## Architecture Overview

### 1. VS Code Extension Layer
- **Entry Point**: `src/extension.ts` - Activates the extension and registers commands
- **Webview Provider**: `src/webview/provider.ts` - Manages the VS Code panel interface
- **Commands**: `src/commands/` - Button commands and VS Code integrations

### 2. Server Infrastructure (`src/server/`)
- **ServerManager**: Central orchestrator managing HTTP, WebSocket, and tunnel servers
- **HttpServer**: REST API endpoints for automation
- **WebSocketServer**: Real-time bidirectional communication
- **WebServer**: Hosts the React frontend application
- **LocalTunnel**: Manages Cloudflare tunnel integration for public access
- **CloudflaredManager**: Handles cloudflared binary management and platform detection

### 3. Frontend Interfaces

#### Simple VS Code Panel
- Basic HTML interface embedded in VS Code activity bar
- Server controls and status monitoring
- No CSP restrictions

#### Full React Web Interface
- Modern React application with TypeScript
- Runs on separate port (typically 5173 for dev, served by WebServer in production)
- Features:
  - File management with syntax highlighting (CodeMirror)
  - Terminal interface (xterm.js)
  - Git operations and repository management
  - Real-time chat and messaging
  - Settings configuration
  - Mobile-optimized UI with neobrutalist design

## Key Features

### 1. Mobile-First Design
- Large touch targets for mobile interaction
- One-hand workflow optimization
- Responsive design with mobile viewport considerations
- Progressive Web App (PWA) capabilities

### 2. Real-Time Communication
- WebSocket protocol for instant updates
- State synchronization between multiple clients
- Connection recovery with exponential backoff
- Broadcast messaging system

### 3. File System Operations
- Browse workspace file tree
- Open, edit, and save files
- File watching and live refresh
- CRUD operations (create, read, update, delete)
- Syntax highlighting for multiple languages

### 4. Terminal Integration
- Multiple terminal sessions
- Command execution with output capture
- Full TTY support via node-pty (planned)
- Mobile keyboard helpers

### 5. Git Integration
- Repository status monitoring
- Commit history and diffs
- Stage/unstage operations
- Branch management
- Push/pull operations

### 6. Tunnel & Remote Access
- Cloudflare tunnel integration for secure public access
- Quick tunnels (temporary) and named tunnels (persistent)
- Automatic binary management for different platforms
- QR code generation for easy mobile access

### 7. Configuration Management
- VS Code settings integration
- `.remoterc` folder for project-specific settings
- Prompt history and categorization
- Auto-save and configuration persistence

## Technical Stack

### Backend
- **TypeScript** - Full type safety
- **Node.js** - Runtime environment
- **VS Code Extension API** - Integration with editor
- **WebSocket** - Real-time communication
- **HTTP Server** - REST API and static serving

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **TanStack Router** - Client-side routing
- **Tailwind CSS** - Styling with neobrutalist theme
- **Radix UI** - Accessible component primitives
- **CodeMirror 6** - Code editor with syntax highlighting
- **xterm.js** - Terminal emulator
- **Lucide React** - Icon system

### Development Tools
- **Vite** - Build tool and dev server
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Tailwind** - Utility-first CSS

## Project Structure

```
src/
├── extension.ts              # Main extension entry point
├── commands/                 # VS Code command implementations
├── server/                   # Backend server infrastructure
│   ├── ServerManager.ts      # Central server orchestrator
│   ├── HttpServer.ts         # HTTP/REST API server
│   ├── WebSocketServer.ts    # WebSocket communication
│   ├── WebServer.ts          # Static file serving
│   ├── LocalTunnel.ts        # Cloudflare tunnel management
│   ├── CloudflaredManager.ts # Binary management
│   ├── FileSystemService.ts  # File operations
│   ├── GitService.ts         # Git integration
│   ├── TerminalService.ts    # Terminal management
│   ├── RemoteRCService.ts    # Configuration persistence
│   └── interfaces.ts         # TypeScript interfaces
└── webview/                  # Frontend interfaces
    ├── provider.ts           # VS Code webview provider
    ├── panel.html           # Simple HTML interface
    ├── script.js            # Basic JavaScript
    └── react-frontend/      # Full React application
        ├── src/
        │   ├── main.tsx      # React entry point
        │   ├── router.tsx    # Route configuration
        │   ├── components/   # React components
        │   └── pages/        # Page components
        └── package.json      # Frontend dependencies
```

## Development Workflow

### Build Process
1. **TypeScript Compilation**: `tsc` compiles server-side code
2. **React Build**: Vite builds the frontend application
3. **Asset Copying**: Static assets are copied to output directory
4. **Extension Packaging**: Creates `.vsix` file for distribution

### Development Commands
- `npm run dev` - Development build with watching
- `npm run build` - Production build
- `npm run start:vue` - Start Vue development server (legacy)
- `npm run package` - Create extension package

## Security Considerations

- **Workspace-scoped access** - Operations limited to current workspace
- **Origin validation** - CORS and origin checking
- **Token-based authentication** - Optional for WebSocket connections
- **Audit trail** - Logging of operations
- **CSP compliance** - Content Security Policy adherence

## Roadmap & Vision

The project follows a phased approach:

1. **MVP**: Core remote control (files, chat, git status, settings)
2. **Productivity**: Interactive workflows (editing, terminal, git operations)
3. **Power Features**: Team collaboration and automation
4. **Polish**: Access control, performance optimization, comprehensive testing

## Current State

The project appears to be in active development with:
- ✅ Core server infrastructure complete
- ✅ Basic VS Code extension functionality
- ✅ React frontend with routing and components
- ✅ Cloudflare tunnel integration
- ✅ File system and Git services
- 🚧 Terminal integration (partial)
- 🚧 Mobile optimization (in progress)
- 🚧 Advanced collaboration features (planned)

## Key Insights

1. **Dual Interface Strategy**: Provides both simple (VS Code panel) and advanced (React web) interfaces
2. **Mobile-Centric**: Designed specifically for mobile remote development workflows
3. **Real-Time Focus**: Heavy emphasis on live updates and state synchronization
4. **Security-First**: Multiple layers of security and access control
5. **Extensible Architecture**: Well-structured for adding new features and capabilities

This is a sophisticated remote development tool that bridges the gap between desktop VS Code and mobile accessibility, enabling developers to manage their code from anywhere with a modern, touch-friendly interface.

## Extension Limitations & Text Extraction Insights

### VS Code Extension Security Model

During development discussions, several important limitations were discovered regarding cross-extension interaction:

#### What Extensions **Cannot** Do:
- **No direct access to other extensions' UI elements** - VS Code's security model prevents extensions from reading other extensions' sidebar content, webviews, or custom UI components
- **No programmatic screenshot API** - Extensions cannot capture screenshots of VS Code UI components through official APIs
- **No cross-extension DOM access** - Each extension runs in isolation with sandboxed execution
- **No sidebar dimension reading** - Cannot programmatically determine primary or secondary sidebar widths

#### What Extensions **Can** Do:
- **Access shared VS Code state** - Documents, diagnostics, workspace files, Git repositories
- **Read extension marketplace info** - List installed extensions and their metadata
- **Execute public extension commands** - If other extensions expose commands publicly
- **Access extension settings** - If they use VS Code's configuration system
- **Measure own webview dimensions** - Using DOM APIs within their own webview context

### Text Extraction Strategies

#### 1. **VS Code API Text Access (Recommended)**
Instead of OCR on screenshots, leverage VS Code's Extension API for direct text access:

```typescript
// Editor content access
const activeEditor = vscode.window.activeTextEditor;
const documentText = activeEditor?.document.getText();

// Workspace file access
const files = await vscode.workspace.findFiles('**/*');
const fileContents = await Promise.all(
  files.map(f => vscode.workspace.openTextDocument(f))
);

// Problems/diagnostics access
const diagnostics = vscode.languages.getDiagnostics();

// Terminal information (limited)
const terminals = vscode.window.terminals.map(t => ({
  name: t.name,
  processId: t.processId
}));
```

**Advantages:**
- 100% accuracy (no OCR errors)
- Faster performance (no image processing)
- Rich metadata (language, line numbers, file paths)
- Real-time updates via VS Code events
- Structured, searchable data

#### 2. **System-Level Screenshot + OCR (Fallback)**
For visual-only content that can't be accessed via APIs:

```typescript
class ScreenshotOCRService {
  async captureAndParseRegion(region: 'sidebar' | 'panel' | 'editor') {
    // 1. Capture full VS Code window (OS APIs)
    const screenshot = await this.captureVSCodeWindow();
    
    // 2. Detect UI regions using image processing
    const regions = await this.detectUIRegions(screenshot);
    
    // 3. Crop to target region
    const targetImage = await this.cropToRegion(screenshot, regions[region]);
    
    // 4. Run Tesseract OCR
    const text = await this.runOCR(targetImage);
    
    return text;
  }
}
```

#### 3. **Accessibility API Integration**
Use OS-level accessibility APIs for text extraction:
- **Windows**: UI Automation API
- **macOS**: Accessibility API
- **Linux**: AT-SPI

More reliable than OCR for actual text content, but requires native modules and OS permissions.

### Implementation Recommendations for Kiro Remote

1. **Primary Strategy**: Use VS Code APIs for direct text access from editors, workspace files, diagnostics, and Git state
2. **Secondary Strategy**: Implement system-level screenshot + OCR for visual-only content
3. **Integration**: Extend the existing WebSocket protocol to support text extraction requests
4. **Mobile Interface**: Add text extraction controls to the React frontend

#### Proposed WebSocket Message Extension:
```typescript
interface TextExtractionMessage extends WebSocketMessage {
  type: 'textExtraction';
  data: {
    source: 'editor' | 'workspace' | 'problems' | 'terminal' | 'explorer';
    options?: {
      includeSelection?: boolean;
      filePattern?: string;
      maxFiles?: number;
      includeMetadata?: boolean;
    };
  };
}
```

This approach provides comprehensive text access while working within VS Code's security constraints and leveraging Kiro Remote's existing remote infrastructure.

### Key Takeaways

1. **Security First**: VS Code's extension isolation is intentional and prevents malicious cross-extension access
2. **API Over OCR**: Direct API access is superior to OCR for accuracy, performance, and functionality
3. **Shared Data Focus**: Most useful content is accessible through VS Code's shared state APIs
4. **Hybrid Approach**: Combine API access with system-level OCR for comprehensive coverage
5. **Mobile Integration**: Text extraction fits naturally into Kiro Remote's mobile-first remote control architecture