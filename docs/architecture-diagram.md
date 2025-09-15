# COTG-CLI System Architecture Diagram

## Complete System Overview

```mermaid
graph TB
    subgraph "User Interface Layer"
        VSC[VS Code Extension]
        WEB[Web Browser Interface]
        CLI[CLI Commands]
    end
    
    subgraph "Frontend Application (React)"
        RL[RootLayout.tsx]
        CP[ChatPage/ACPPage]
        TM[TunnelManager]
        TC[TerminalCommands]
        
        subgraph "Chat Components"
            MB[MessageBubble]
            MD[Markdown Renderer]
            MS[MentionSuggestions]
            CDV[CodeDiffViewer]
        end
        
        subgraph "Context & State"
            WSP[WebSocketProvider]
            CS[Context Store]
            SS[Session Store]
            PS[Process Store]
        end
    end
    
    subgraph "Communication Layer"
        WS[WebSocket Server]
        HTTP[HTTP Server]
        JSONRPC[JSON-RPC Handler]
    end
    
    subgraph "Core Services"
        FS[FileSystem Service]
        GS[Git Service]
        TS[Terminal Service]
        TUN[Tunnel Service]
    end
    
    subgraph "ACP Integration"
        ACP[ACP HTTP Controller]
        ACPC[ACP Connection]
        ACPA[ACP Agent Adapter]
        MCP[MCP Server]
    end
    
    subgraph "External Systems"
        CLAUDE[Claude API]
        CF[Cloudflared]
        SHELL[System Shell]
        REPO[Git Repository]
    end
    
    subgraph "Storage & Config"
        LS[Local Storage]
        CONFIG[.on-the-go/config.json]
        SESSIONS[.on-the-go/acp/sessions]
        KIRO[.kiro/steering/*.md]
    end
    
    %% User Interface Connections
    VSC --> HTTP
    WEB --> HTTP
    CLI --> HTTP
    
    %% Frontend Internal Connections
    RL --> CP
    RL --> TM
    RL --> TC
    CP --> MB
    CP --> MD
    CP --> MS
    CP --> CDV
    CP --> WSP
    WSP --> CS
    WSP --> SS
    TC --> PS
    
    %% Communication Flow
    WSP --> WS
    HTTP --> WS
    WS --> JSONRPC
    JSONRPC --> FS
    JSONRPC --> GS
    JSONRPC --> TS
    JSONRPC --> TUN
    JSONRPC --> ACP
    
    %% ACP Flow
    ACP --> ACPC
    ACPC --> ACPA
    ACPA --> MCP
    MCP --> CLAUDE
    
    %% Service Connections
    FS --> REPO
    GS --> REPO
    TS --> SHELL
    TUN --> CF
    
    %% Storage Connections
    CS --> LS
    SS --> SESSIONS
    PS --> LS
    FS --> CONFIG
    
    %% Styling
    classDef frontend fill:#e1f5fe
    classDef service fill:#f3e5f5
    classDef external fill:#fff3e0
    classDef storage fill:#e8f5e8
    
    class RL,CP,TM,TC,MB,MD,MS,CDV,WSP,CS,SS,PS frontend
    class FS,GS,TS,TUN,ACP,ACPC,ACPA,MCP service
    class CLAUDE,CF,SHELL,REPO external
    class LS,CONFIG,SESSIONS,KIRO storage
```

## Feature-Specific Component Flow

### 1. Chat/ACP Feature Flow
```mermaid
sequenceDiagram
    participant U as User
    participant CP as ChatPage
    participant WSP as WebSocketProvider
    participant ACP as ACP Controller
    participant CLAUDE as Claude API
    
    U->>CP: Type message with @mentions
    CP->>MS: Show mention suggestions
    MS->>FS: Get file list
    FS-->>MS: Return files
    MS-->>CP: Display suggestions
    CP->>WSP: Send message + context
    WSP->>ACP: Forward via WebSocket
    ACP->>CLAUDE: Send to Claude
    CLAUDE-->>ACP: Stream response
    ACP-->>WSP: Stream chunks
    WSP-->>CP: Update UI
    CP->>MB: Render message bubble
    MB->>MD: Render markdown
    MB->>CDV: Render code diffs
```

### 2. Terminal Commands Feature Flow
```mermaid
sequenceDiagram
    participant U as User
    participant TC as TerminalCommands
    participant PS as ProcessStore
    participant TS as TerminalService
    participant SHELL as System Shell
    
    U->>TC: Enter command
    TC->>PS: Create process entry
    PS->>TS: Execute command
    TS->>SHELL: Run process
    SHELL-->>TS: Output stream
    TS-->>PS: Update process status
    PS-->>TC: Notify UI update
    TC->>U: Show live output
    SHELL-->>TS: Process exit
    TS-->>PS: Mark complete
    PS-->>TC: Final status update
```

### 3. Tunnel Management Feature Flow
```mermaid
sequenceDiagram
    participant U as User
    participant TM as TunnelManager
    participant TUN as TunnelService
    participant CF as Cloudflared
    
    U->>TM: Request tunnel creation
    TM->>TUN: Create tunnel
    TUN->>CF: Start cloudflared
    CF-->>TUN: Tunnel URL
    TUN-->>TM: Return tunnel info
    TM->>U: Display tunnel URL + QR
    U->>TM: Copy/Share URL
    TM->>TUN: Stop tunnel (when needed)
    TUN->>CF: Kill process
```

## Data Flow Architecture

### WebSocket Message Flow
```mermaid
graph LR
    subgraph "Frontend"
        UI[UI Component]
        WSP[WebSocketProvider]
    end
    
    subgraph "Backend"
        WS[WebSocket Handler]
        SVC[Service Layer]
    end
    
    subgraph "External"
        EXT[External System]
    end
    
    UI -->|Action| WSP
    WSP -->|JSON Message| WS
    WS -->|Route| SVC
    SVC -->|Execute| EXT
    EXT -->|Response| SVC
    SVC -->|Result| WS
    WS -->|JSON Response| WSP
    WSP -->|Update| UI
```

### File System Integration
```mermaid
graph TB
    subgraph "File Operations"
        READ[Read Files]
        WRITE[Write Files]
        WATCH[Watch Changes]
        DIFF[Generate Diffs]
    end
    
    subgraph "Git Integration"
        STATUS[Git Status]
        COMMIT[Git Commit]
        BRANCH[Branch Ops]
        HISTORY[Git History]
    end
    
    subgraph "Context Management"
        MENTIONS[@file Mentions]
        ATTACH[File Attachments]
        PREVIEW[File Preview]
        SEARCH[File Search]
    end
    
    READ --> MENTIONS
    WATCH --> STATUS
    DIFF --> ATTACH
    STATUS --> PREVIEW
    COMMIT --> HISTORY
    BRANCH --> CONTEXT
    SEARCH --> MENTIONS
```

## Component Hierarchy

### React Component Tree
```mermaid
graph TB
    APP[App.tsx]
    APP --> RL[RootLayout.tsx]
    
    RL --> WSP[WebSocketProvider]
    RL --> ROUTER[Router]
    
    ROUTER --> CP[ChatPage/ACPPage]
    ROUTER --> TM[TunnelManagerPage]
    ROUTER --> TC[TerminalCommandsPage]
    
    CP --> CHAT[Chat Components]
    CHAT --> MB[MessageBubble]
    CHAT --> MS[MentionSuggestions]
    CHAT --> INPUT[ChatInput]
    
    MB --> MD[Markdown]
    MB --> CDV[CodeDiffViewer]
    MB --> TERM[TerminalOutput]
    
    TM --> TF[TunnelForm]
    TM --> TL[TunnelList]
    TM --> TA[TunnelActions]
    
    TC --> CF[CommandForm]
    TC --> PL[ProcessList]
    TC --> OUTPUT[ProcessOutput]
    
    WSP --> STORE[State Stores]
    STORE --> SS[SessionStore]
    STORE --> CS[ContextStore]
    STORE --> PS[ProcessStore]
```

## Service Layer Architecture

### Backend Services
```mermaid
graph TB
    subgraph "HTTP/WebSocket Server"
        SERVER[server.ts]
        ROUTES[Route Handlers]
        WS_HANDLER[WebSocket Handler]
    end
    
    subgraph "Core Services"
        FS_SVC[FileSystemService]
        GIT_SVC[GitService]
        TERM_SVC[TerminalService]
        TUNNEL_SVC[TunnelService]
    end
    
    subgraph "ACP Services"
        ACP_HTTP[ACPHttpController]
        ACP_CONN[ACPConnection]
        ACP_AGENT[ACP Agent Adapter]
    end
    
    subgraph "Safety & Utils"
        TERM_SAFETY[TerminalSafety]
        VALIDATION[Input Validation]
        LOGGING[Logging Utils]
    end
    
    SERVER --> ROUTES
    SERVER --> WS_HANDLER
    ROUTES --> FS_SVC
    ROUTES --> GIT_SVC
    ROUTES --> TERM_SVC
    ROUTES --> TUNNEL_SVC
    ROUTES --> ACP_HTTP
    
    ACP_HTTP --> ACP_CONN
    ACP_CONN --> ACP_AGENT
    
    TERM_SVC --> TERM_SAFETY
    FS_SVC --> VALIDATION
    GIT_SVC --> VALIDATION
    
    FS_SVC --> LOGGING
    GIT_SVC --> LOGGING
    TERM_SVC --> LOGGING
```

## Build & Deployment Flow

### Build Process
```mermaid
graph LR
    subgraph "Source"
        TS[TypeScript Source]
        REACT[React Frontend]
        AGENT[ACP Agent]
    end
    
    subgraph "Build Steps"
        CLEAN[Clean]
        COMPILE[TypeScript Compile]
        BUILD_REACT[Build React]
        BUILD_AGENT[Build Agent]
        PACKAGE[Package CLI]
    end
    
    subgraph "Output"
        DIST[dist/]
        OUT[out/]
        BINARIES[CLI Binaries]
    end
    
    TS --> COMPILE
    REACT --> BUILD_REACT
    AGENT --> BUILD_AGENT
    
    CLEAN --> COMPILE
    COMPILE --> BUILD_REACT
    BUILD_REACT --> BUILD_AGENT
    BUILD_AGENT --> PACKAGE
    
    COMPILE --> DIST
    BUILD_REACT --> OUT
    PACKAGE --> BINARIES
```

This architecture diagram shows how cotg-cli integrates multiple development tools into a cohesive web-based IDE experience, with clear separation between frontend UI, backend services, and external integrations.