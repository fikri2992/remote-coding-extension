# Claude Code ACP Integration Guide

## Overview

This guide explains how Claude Code integrates with the Agent Client Protocol (ACP) through the `@claude-code-acp` adapter, enabling Claude Code to function as an external AI agent within ACP-compatible applications like Zed.

## Table of Contents

- [What is Claude Code ACP?](#what-is-claude-code-acp)
- [Architecture Overview](#architecture-overview)
- [The @claude-code-acp Adapter](#the-claude-code-acp-adapter)
- [Communication Flow](#communication-flow)
- [ACP Protocol Implementation](#acp-protocol-implementation)
- [MCP Server Integration](#mcp-server-integration)
- [Tool Translation](#tool-translation)
- [Session Management](#session-management)
- [Permission System](#permission-system)
- [Practical Usage](#practical-usage)
- [Configuration](#configuration)
- [Advanced Features](#advanced-features)

---

## What is Claude Code ACP?

**Claude Code ACP** is an adapter that enables Claude Code to communicate with ACP-compatible clients through the Agent Client Protocol. Unlike Gemini CLI's built-in ACP mode, Claude Code uses the `@claude-code-acp` package as a bridge between ACP clients and Claude Code's native capabilities.

### Key Difference from Gemini CLI

| Feature | Gemini CLI | Claude Code with ACP |
|---------|-------------|----------------------|
| **ACP Implementation** | Built-in | Via `@claude-code-acp` adapter |
| **Process Model** | Direct ACP process | Bridge adapter process |
| **Tool Access** | Native ACP tools | Translated Claude Code tools |
| **Communication** | Direct JSON-RPC | Bridged JSON-RPC via adapter |

---

## Architecture Overview

### Complete Architecture

```
┌─────────────────┐    ACP Protocol    ┌──────────────────────────────┐
│   ACP Client    │ ◄────────────────► │   @claude-code-acp Adapter   │
│   (Zed/Web App) │                    │      (Bridge Process)        │
│                 │                    │                              │
│ ┌─────────────┐ │                    │ ┌──────────────────────────┐ │
│ |  ACP        │ │                    │ |  ClaudeAcpAgent Class    │ │
│ |  Engine     │ │                    │ |  - Session Management    │ │
│ └─────────────┘ │                    │ |  - Tool Translation      │ │
│                 │                    │ |  - MCP Server Setup      │ │
│ ┌─────────────┐ │                    │ └──────────────────────────┘ │
│ |  Session    │ │                    │ ┌──────────────────────────┐ │
│ |  Manager    │ │                    │ |  MCP HTTP Server         │ │
│ └─────────────┘ │                    │ |  - Custom Tools          │ │
│                 │                    │ |  - File Operations       │ │
└─────────────────┘                    │ |  - Command Execution     │ │
       JSON-RPC 2.0                    | └──────────────────────────┘ │
                                       | ┌──────────────────────────┐ │
                                       | │   Claude Code SDK        │ │
                                       | │   - Native Tools         │ │
                                       | │   - LLM Communication    │ │
                                       | │   - Context Management   │ │
                                       | └──────────────────────────┘ │
                                       |             │                |
                                       |             ▼                |
                                       | ┌──────────────────────────┐ │
                                       | │   Anthropic API          │ │
                                       | │   - Claude LLM           │ │
                                       | │   - Tool Execution       │ │
                                       | └──────────────────────────┘ │
                                       └──────────────────────────────┘
```

### Key Components

1. **ACP Client**: Applications like Zed that speak ACP protocol
2. **@claude-code-acp Adapter**: Bridge process that translates between ACP and Claude Code
3. **MCP Server**: Local HTTP server providing custom tools via MCP
4. **Claude Code SDK**: Native Claude Code capabilities
5. **Anthropic API**: Underlying LLM and tool execution

---

## The @claude-code-acp Adapter

### Core Implementation

The adapter is implemented in the `claude-code-acp` package with the main class `ClaudeAcpAgent`:

```typescript
export class ClaudeAcpAgent implements Agent {
    sessions: { [key: string]: Session };
    client: AgentSideConnection;
    toolUseCache: ToolUseCache;
    fileContentCache: { [key: string]: string };
    backgroundTerminals: { [key: string]: BackgroundTerminal } = {};
    clientCapabilities?: ClientCapabilities;
}
```

### Key Responsibilities

1. **Protocol Translation**: Converts ACP messages to Claude Code SDK calls
2. **Tool Mapping**: Translates ACP tool requests to Claude Code tools
3. **Session Management**: Handles ACP session lifecycle
4. **Stream Processing**: Converts Claude Code responses to ACP streaming updates
5. **MCP Integration**: Creates and manages MCP servers for custom tools

### Process Spawning

ACP clients spawn the adapter as a child process:

```typescript
const child = spawn(command.path, command.args ?? [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...(command.env ?? {}) },
    cwd: command.cwd ?? process.cwd(),
    shell: process.platform === 'win32',
    windowsHide: true,
});
```

---

## Communication Flow

### Message Processing Pipeline

```
1. ACP Client Request
   ↓
2. JSON-RPC Message to Adapter
   ↓
3. Protocol Detection (Claude Code ACP vs Generic)
   ↓
4. ClaudeAcpAgent.processMessage()
   ↓
5. Tool Translation & Execution
   ↓
6. Claude Code SDK Call
   ↓
7. Anthropic API Request
   ↓
8. LLM Response & Tool Execution
   ↓
9. Response Translation Back to ACP
   ↓
10. Streaming Updates to Client
```

### Framing Modes

The adapter supports two framing modes:

- **NDJSON (Newline Delimited JSON)**: Used by Claude Code ACP
- **LSP (Language Server Protocol)**: Used by generic agents

### Message Types

#### Client → Adapter (ACP Requests)
- `initialize`: Protocol negotiation
- `session/new`: Create new session
- `session/prompt`: Send user prompt
- `session/cancel`: Cancel request
- `session/set_mode`: Change permission mode

#### Adapter → Client (ACP Responses)
- `session/update`: Streaming updates (thoughts, messages, tool calls)
- `session/request_permission`: Permission requests
- `tool/*`: MCP tool responses

---

## ACP Protocol Implementation

### Initialize Method

```typescript
async initialize(params: InitializeParams): Promise<InitializeResult> {
    // Protocol negotiation
    // Capability exchange
    // Setup MCP servers
    return {
        protocolVersion: 1,
        authMethods: [],
        agentCapabilities: {
            loadSession: false,
            promptCapabilities: {
                image: true,
                audio: true,
                embeddedContext: true,
            },
        },
    };
}
```

### Session Creation

```typescript
async newSession(params: NewSessionParams): Promise<NewSessionResult> {
    const sessionId = generateUUID();

    // Create MCP server for this session
    const server = await createMcpServer(this, sessionId, this.clientCapabilities);
    const address = server.address() as AddressInfo;

    // Setup session configuration
    this.sessions[sessionId] = {
        id: sessionId,
        server,
        permissionMode: params.mode || 'default',
        // ... other session state
    };

    return { sessionId };
}
```

### Prompt Handling

```typescript
async prompt(params: PromptParams): Promise<PromptResult> {
    const { sessionId, prompt } = params;

    // Convert ACP prompt to Claude Code format
    const messages = this.convertPrompt(prompt);

    // Send to Claude Code with streaming
    const response = await this.claudeCode.chat({
        messages,
        stream: true,
        tools: ['*'], // All tools available
    });

    // Process streaming response
    for await (const chunk of response) {
        this.sendUpdate(sessionId, chunk);
    }

    return { stopReason: 'end_turn' };
}
```

---

## MCP Server Integration

### Custom MCP Tools

The adapter creates an MCP server for each session with these custom tools:

#### File Operations
- `mcp__acp__read`: Read files via client
- `mcp__acp__write`: Write files via client
- `mcp__acp__edit`: Edit files with diff support
- `mcp__acp__multi-edit`: Multi-file editing

#### Command Execution
- `mcp__acp__bash`: Execute shell commands
- `mcp__acp__bashOutput`: Monitor background processes
- `mcp__acp__killBash`: Kill background processes

#### System Operations
- `mcp__acp__permission`: Permission management
- `mcp__acp__glob`: File pattern matching

### MCP Server Setup

```typescript
async function createMcpServer(agent: ClaudeAcpAgent, sessionId: string) {
    const app = express();

    // Enable CORS for ACP client
    app.use(cors());

    // MCP endpoint
    app.post('/mcp', async (req, res) => {
        const mcpRequest = req.body;
        const result = await handleMcpRequest(agent, sessionId, mcpRequest);
        res.json(result);
    });

    const server = app.listen(0, '127.0.0.1');
    return server;
}
```

---

## Tool Translation

### Claude Code → ACP Tool Mapping

| Claude Code Tool | ACP Equivalent | Parameters |
|-----------------|----------------|------------|
| `readFile` | `mcp__acp__read` | `path`, `offset`, `limit` |
| `writeFile` | `mcp__acp__write` | `path`, `content` |
| `editFile` | `mcp__acp__edit` | `path`, `old_string`, `new_string` |
| `bash` | `mcp__acp__bash` | `command`, `cwd`, `timeout` |
| `glob` | `mcp__acp__glob` | `pattern`, `path` |

### Tool Call Translation

```typescript
function translateToolCall(toolCall: ToolCall): MCPToolCall {
    const { name, input } = toolCall;

    switch (name) {
        case 'readFile':
            return {
                method: 'tools/call',
                params: {
                    name: 'mcp__acp__read',
                    arguments: {
                        path: input.path,
                        offset: input.offset,
                        limit: input.limit
                    }
                }
            };

        case 'bash':
            return {
                method: 'tools/call',
                params: {
                    name: 'mcp__acp__bash',
                    arguments: {
                        command: input.command,
                        cwd: input.cwd,
                        timeout: input.timeout
                    }
                }
            };

        // ... other tool mappings
    }
}
```

### Response Translation

```typescript
function translateToolResponse(response: MCPToolResponse): ToolResult {
    return {
        type: 'tool_result',
        tool_use_id: response.toolCallId,
        content: [{
            type: 'text',
            text: response.result.output || response.result.error
        }]
    };
}
```

---

## Session Management

### Session Lifecycle

```
1. Session Creation (session/new)
   ↓
2. MCP Server Setup
   ↓
3. Permission Mode Configuration
   ↓
4. Active Communication (session/prompt)
   ↓
5. Background Process Management
   ↓
6. Session Cleanup (session/cancel or exit)
```

### Session State

```typescript
interface Session {
    id: string;
    server: http.Server;
    permissionMode: PermissionMode;
    backgroundTerminals: { [key: string]: BackgroundTerminal };
    toolUseCache: ToolUseCache;
    fileContentCache: { [key: string]: string };
    createdAt: Date;
    lastActivity: Date;
}
```

### Permission Modes

- `default`: Always ask for permissions
- `acceptEdits`: Auto-accept file edit permissions
- `bypassPermissions`: Skip all permission prompts
- `plan`: Analysis mode without modifications

---

## Permission System

### Permission Request Flow

```
1. Tool Execution Request
   ↓
2. Check Permission Mode
   ↓
3. If Approval Needed → Send Permission Request
   ↓
4. User Decision (Proceed/Cancel)
   ↓
5. Execute or Skip Tool
```

### Permission Request Example

```typescript
function requestPermission(toolCall: ToolCall, sessionId: string) {
    const permissionRequest = {
        jsonrpc: '2.0',
        method: 'session/request_permission',
        params: {
            sessionId,
            toolCall: {
                title: toolCall.name,
                description: getToolDescription(toolCall),
                toolCallId: generateId()
            },
            options: [
                { name: 'proceed_once', description: 'Allow this execution' },
                { name: 'proceed_always', description: 'Always allow this tool' },
                { name: 'cancel', description: 'Don\'t allow' }
            ]
        }
    };

    this.client.sendNotification(permissionRequest);
}
```

---

## Practical Usage

### Using Claude Code with Zed

1. **Install Claude Code**:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Configure Zed**:
   Zed automatically detects and uses Claude Code when available.

3. **Start ACP Session**:
   ```typescript
   // Zed spawns the adapter
   const child = spawn('claude-code-acp', ['--stdio'], {
       stdio: ['pipe', 'pipe', 'pipe']
   });
   ```

4. **Send Prompts**:
   ```typescript
   await client.sendRequest({
       jsonrpc: '2.0',
       method: 'session/prompt',
       params: {
           sessionId: 'session-id',
           prompt: [{ type: 'text', text: 'Help me refactor this code' }]
       }
   });
   ```

### Custom Tool Integration

```typescript
// Add custom tools to the MCP server
app.post('/mcp', async (req, res) => {
    const { method, params } = req.body;

    if (method === 'tools/list') {
        res.json({
            tools: [
                {
                    name: 'custom_database_query',
                    description: 'Query custom database',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string' }
                        }
                    }
                }
            ]
        });
    }
});
```

---

## Configuration

### Environment Variables

```bash
# Required for Claude Code authentication
ANTHROPIC_API_KEY=your-api-key-here

# Optional configuration
CLAUDE_CODE_ACP_PORT=3000
CLAUDE_CODE_ACP_MODE=default
```

### ACP Client Configuration

```json
{
    "command": {
        "path": "claude-code-acp",
        "args": ["--stdio"],
        "env": {
            "ANTHROPIC_API_KEY": "${env:ANTHROPIC_API_KEY}"
        }
    },
    "capabilities": {
        "fs": {
            "readTextFile": true,
            "writeTextFile": true
        },
        "terminal": true
    }
}
```

---

## Advanced Features

### Background Process Management

```typescript
class BackgroundTerminal {
    id: string;
    process: ChildProcess;
    outputBuffer: string[];
    lastActivity: Date;

    async start(command: string, cwd: string) {
        this.process = spawn(command, [], {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.on('data', (data) => {
            this.outputBuffer.push(data.toString());
        });
    }

    async getOutput(): Promise<string> {
        return this.outputBuffer.join('\n');
    }
}
```

### Context @-mentions

```typescript
function parseContextMentions(text: string): ContextItem[] {
    const mentions = text.match(/@(\w+)/g) || [];

    return mentions.map(mention => {
        const name = mention.substring(1);
        return {
            type: 'file',
            name,
            path: resolveFilePath(name)
        };
    });
}
```

### Streaming Updates

```typescript
async function sendStreamingUpdate(sessionId: string, chunk: StreamChunk) {
    const update = {
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
            sessionId,
            update: {
                sessionUpdate: chunk.type,
                content: chunk.content
            }
        }
    };

    this.client.sendNotification(update);
}
```

---

## Conclusion

Claude Code's ACP integration through the `@claude-code-acp` adapter provides a powerful bridge between ACP-compatible applications and Claude Code's native capabilities. This architecture enables:

1. **Seamless Integration**: Claude Code can be used as an external AI agent in ACP-compatible editors
2. **Full Tool Support**: All Claude Code tools are available through ACP protocol
3. **Advanced Features**: Streaming updates, permission management, background processes
4. **Extensibility**: Custom MCP tools can be added for domain-specific functionality

The adapter successfully translates between the ACP protocol and Claude Code's native API, making Claude Code a first-class citizen in the ACP ecosystem alongside other AI agents like Gemini CLI.

---

## Quick Reference

### Key Components
- `@claude-code-acp`: Main adapter package
- `ClaudeAcpAgent`: Core ACP implementation class
- MCP Server: Local HTTP server for custom tools
- Session Management: UUID-based session handling

### Tool Mappings
- `readFile` → `mcp__acp__read`
- `writeFile` → `mcp__acp__write`
- `editFile` → `mcp__acp__edit`
- `bash` → `mcp__acp__bash`

### Permission Modes
- `default`: Always ask
- `acceptEdits`: Auto-accept edits
- `bypassPermissions`: Skip all prompts
- `plan`: Analysis mode

### Configuration
- `ANTHROPIC_API_KEY`: Required authentication
- `CLAUDE_CODE_ACP_PORT`: Optional port configuration
- Command: `claude-code-acp --stdio`