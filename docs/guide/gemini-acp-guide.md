# Gemini CLI ACP Integration Guide

## Overview

This guide provides a comprehensive walkthrough of how to integrate with Gemini CLI using the Agent Client Protocol (ACP), based on the working implementation in `quick-gemini-test.js`. This document covers everything from basic setup to advanced usage patterns.

## Table of Contents

- [What is ACP?](#what-is-acp)
- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Step-by-Step Implementation](#step-by-step-implementation)
- [Protocol Details](#protocol-details)
- [Message Types](#message-types)
- [Advanced Usage](#advanced-usage)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Complete Implementation](#complete-implementation)

---

## What is ACP?

**Agent Client Protocol (ACP)** is a JSON-RPC 2.0 based communication protocol that enables bidirectional communication between a client application and the Gemini CLI agent. It provides:

- **Real-time streaming** of agent thoughts and responses
- **Tool execution** with permission management
- **Session management** for persistent conversations
- **Authentication** support for multiple methods
- **File system integration** through client capabilities

---

## Prerequisites

### System Requirements
- **Node.js** (v14 or higher)
- **Gemini CLI** installed globally: `npm install -g @google/gemini-cli`
- **API Key**: Set `GEMINI_API_KEY` environment variable (optional but recommended)

### Environment Setup

```bash
# Install Gemini CLI globally
npm install -g @google/gemini-cli

# Set API key (optional)
export GEMINI_API_KEY="your-api-key-here"
```

---

## Architecture Overview

### Communication Flow

```
┌─────────────────┐    JSON-RPC 2.0    ┌─────────────────┐
│   Your App      │ ◄────────────────► │  Gemini CLI     │
│   (Client)      │                    │  (Agent)        │
│                 │                    │                 │
│ ┌─────────────┐ │                    │ ┌─────────────┐ │
│ │   Process   │ │                    │ │   ACP       │ │
│ │ Management  │ │                    │ │   Engine    │ │
│ └─────────────┘ │                    │ └─────────────┘ │
│ ┌─────────────┐ │                    │ ┌─────────────┐ │
│ │  Request    │ │                    │ │   Session   │ │
│ │  Handler    │ │                    │ │   Manager   │ │
│ └─────────────┘ │                    │ └─────────────┘ │
│ ┌─────────────┐ │                    │ ┌─────────────┐ │
│ │ Response    │ │                    │ │   Tool      │ │
│ │ Processor   │ │                    │ │   Registry  │ │
│ └─────────────┘ │                    │ └─────────────┘ │
└─────────────────┘                    └─────────────────┘
       Stdin/Stdout Pipes                     --experimental-acp
```

### Key Components

1. **Process Management**: Spawning and managing Gemini CLI process
2. **Request/Response Handling**: JSON-RPC 2.0 message processing
3. **Stream Processing**: Real-time updates and responses
4. **Session Management**: Creating and maintaining conversation sessions
5. **Error Handling**: Robust error management and recovery

---

## Step-by-Step Implementation

### 1. Process Spawning

The first step is to spawn the Gemini CLI process with the `--experimental-acp` flag:

```javascript
const { spawn } = require('child_process');

// Path to globally installed Gemini CLI
const geminiPath = 'C:/Program Files/nodejs/node_modules/@google/gemini-cli/dist/index.js';

// Spawn the process with stdio pipes
const childProcess = spawn('node', [geminiPath, '--experimental-acp'], {
    stdio: 'pipe',  // Crucial for bidirectional communication
    env: {
        ...process.env,
        // Pass API key if available
        ...(process.env.GEMINI_API_KEY && { GEMINI_API_KEY: process.env.GEMINI_API_KEY })
    }
});
```

**Key Points:**
- Use `stdio: 'pipe'` for bidirectional communication
- Pass environment variables including API key
- Handle process errors and exit events

### 2. Setting Up Communication

#### Stdout Processing (Responses from Gemini)

```javascript
const { createInterface } = require('readline');

// Set up stdout line-by-line processing
const stdoutLineInterface = createInterface({
    input: childProcess.stdout,
    crlfDelay: Infinity
});

stdoutLineInterface.on('line', (line) => {
    if (line.trim()) {
        try {
            const response = JSON.parse(line);
            handleResponse(response);
        } catch (e) {
            // Handle non-JSON responses (rare)
        }
    }
});
```

#### Stderr Processing (Logs and Debug Info)

```javascript
const stderrLineInterface = createInterface({
    input: childProcess.stderr,
    crlfDelay: Infinity
});

stderrLineInterface.on('line', (line) => {
    if (line.trim() && !line.includes('DeprecationWarning')) {
        console.log('📝', line);  // Log important messages
    }
});
```

### 3. Request Management

Create a system to send requests and track responses:

```javascript
const pendingRequests = new Map();
let requestId = 1;

function sendRequest(request) {
    return new Promise((resolve, reject) => {
        const id = request.id || requestId++;

        // Set up request tracking
        pendingRequests.set(id, { resolve, reject });

        // Send the request
        childProcess.stdin.write(JSON.stringify({...request, id}) + '\n');

        // Set up timeout
        setTimeout(() => {
            if (pendingRequests.has(id)) {
                pendingRequests.delete(id);
                reject(new Error('Request timeout'));
            }
        }, 10000);  // 10 second timeout
    });
}
```

### 4. Response Handling

Process different types of responses:

```javascript
function handleResponse(response) {
    // Handle responses to our requests
    if (response.id && pendingRequests.has(response.id)) {
        const { resolve } = pendingRequests.get(response.id);
        pendingRequests.delete(response.id);

        if (response.error) {
            // Handle error responses
            console.error('❌ Error:', response.error.message);
            resolve(response);  // Still resolve to handle the error
        } else {
            resolve(response);
        }
    }

    // Handle streaming updates
    if (response.method === 'session/update') {
        handleStreamingUpdate(response.params);
    }
}

function handleStreamingUpdate(params) {
    const { update } = params;

    switch (update.sessionUpdate) {
        case 'agent_thought_chunk':
            console.log(`\n💭 ${update.content.text}`);
            break;
        case 'agent_message_chunk':
            console.log(`\n🤖 ${update.content.text}`);
            break;
        case 'tool_call':
            console.log(`\n🔧 Tool: ${update.title} (${update.status})`);
            break;
        case 'tool_call_update':
            console.log(`\n🔧 Tool Update: ${update.title} (${update.status})`);
            break;
        default:
            console.log(`\n📄 Update: ${update.sessionUpdate}`);
    }
}
```

### 5. Complete Communication Flow

```javascript
async function runTest() {
    try {
        // Step 1: Initialize ACP connection
        console.log('📡 Step 1: Initialize...');
        const initResponse = await sendRequest({
            jsonrpc: '2.0',
            id: requestId++,
            method: 'initialize',
            params: {
                protocolVersion: 1,
                clientCapabilities: {
                    fs: { readTextFile: true, writeTextFile: true },
                    terminal: true
                }
            }
        });

        console.log('✅ Initialized:', initResponse.result.protocolVersion);

        // Step 2: Create session
        console.log('\n📡 Step 2: Create session...');
        const sessionResponse = await sendRequest({
            jsonrpc: '2.0',
            id: requestId++,
            method: 'session/new',
            params: {
                cwd: process.cwd(),
                mcpServers: []  // No additional MCP servers
            }
        });

        const sessionId = sessionResponse.result.sessionId;
        console.log('✅ Session created:', sessionId);

        // Step 3: Send prompt
        console.log('\n📡 Step 3: Send prompt...');
        await sendRequest({
            jsonrpc: '2.0',
            id: requestId++,
            method: 'session/prompt',
            params: {
                sessionId: sessionId,
                prompt: [
                    {
                        type: 'text',
                        text: 'Who are you? Respond in 1-2 sentences.'
                    }
                ]
            }
        });

        // Wait for streaming responses
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('\n✅ Test completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        // Clean up
        childProcess.kill('SIGTERM');
    }
}
```

---

## Protocol Details

### JSON-RPC 2.0 Structure

All messages follow the JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": { /* method-specific parameters */ }
}
```

### Available Methods

#### Client → Agent (Requests)

| Method | Description | Required Parameters |
|--------|-------------|-------------------|
| `initialize` | Initialize ACP connection | `protocolVersion`, `clientCapabilities` |
| `authenticate` | Authenticate with agent | `methodId` |
| `session/new` | Create new session | `cwd`, `mcpServers` |
| `session/prompt` | Send prompt to agent | `sessionId`, `prompt` |
| `session/request_permission` | Respond to permission request | `sessionId`, `outcome` |

#### Agent → Client (Responses)

| Method | Description | Parameters |
|--------|-------------|------------|
| `session/update` | Streaming updates | `sessionId`, `update` |
| `session/request_permission` | Permission request | `sessionId`, `toolCall`, `options` |

### Initialization Parameters

```javascript
{
  protocolVersion: 1,
  clientCapabilities: {
    fs: {
      readTextFile: true,      // Can read files
      writeTextFile: true,     // Can write files
    },
    terminal: true            // Can run terminal commands
  }
}
```

### Session Creation Parameters

```javascript
{
  cwd: '/path/to/working/directory',
  mcpServers: {
    // MCP server configurations
    'my-server': {
      command: 'node',
      args: ['./mcp-server.js'],
      env: { /* environment variables */ }
    }
  }
}
```

### Prompt Format

```javascript
{
  sessionId: 'session-id-here',
  prompt: [
    {
      type: 'text',
      text: 'Your message here'
    },
    {
      type: 'image',
      data: 'base64-encoded-image-data',
      mimeType: 'image/png'
    },
    {
      type: 'audio',
      data: 'base64-encoded-audio-data',
      mimeType: 'audio/wav'
    }
  ]
}
```

---

## Message Types

### 1. Session Updates

#### Agent Thought Chunks
```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "session-id",
    "update": {
      "sessionUpdate": "agent_thought_chunk",
      "content": {
        "type": "text",
        "text": "**Thinking about the solution**\n\nI'm considering how to approach this problem..."
      }
    }
  }
}
```

#### Agent Message Chunks
```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "session-id",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {
        "type": "text",
        "text": "Here's the solution to your problem..."
      }
    }
  }
}
```

#### Tool Call Updates
```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "session-id",
    "update": {
      "sessionUpdate": "tool_call",
      "title": "Read File",
      "status": "pending",
      "toolCallId": "tool-call-id"
    }
  }
}
```

### 2. Permission Requests

```json
{
  "jsonrpc": "2.0",
  "method": "session/request_permission",
  "params": {
    "sessionId": "session-id",
    "toolCall": {
      "title": "Execute Command",
      "description": "Run 'npm test' in the project directory",
      "toolCallId": "tool-call-id"
    },
    "options": [
      {
        "name": "proceed_once",
        "description": "Allow this execution"
      },
      {
        "name": "proceed_always",
        "description": "Always allow this command"
      },
      {
        "name": "cancel",
        "description": "Don't allow"
      }
    ]
  }
}
```

### 3. Error Responses

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": {
      "details": "The requested method does not exist"
    }
  }
}
```

---

## Advanced Usage

### 1. Handling Multiple Sessions

```javascript
const sessions = new Map();

async function createSession(name, cwd) {
    const response = await sendRequest({
        jsonrpc: '2.0',
        method: 'session/new',
        params: {
            cwd: cwd || process.cwd(),
            mcpServers: []
        }
    });

    sessions.set(name, response.result.sessionId);
    return response.result.sessionId;
}

async function switchSession(name) {
    const sessionId = sessions.get(name);
    if (!sessionId) {
        throw new Error(`Session '${name}' not found`);
    }
    return sessionId;
}
```

### 2. Authentication Handling

```javascript
async function authenticate() {
    // Try API key authentication first
    if (process.env.GEMINI_API_KEY) {
        try {
            const authResponse = await sendRequest({
                jsonrpc: '2.0',
                method: 'authenticate',
                params: {
                    methodId: 'gemini-api-key'
                }
            });

            console.log('✅ Authenticated with API key');
            return true;
        } catch (error) {
            console.log('⚠️ API key auth failed, trying other methods...');
        }
    }

    // Try OAuth if available
    const initResponse = await sendRequest({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
            protocolVersion: 1,
            clientCapabilities: {
                fs: { readTextFile: true, writeTextFile: true },
                terminal: true
            }
        }
    });

    if (initResponse.result.authMethods) {
        const oauthMethod = initResponse.result.authMethods.find(m => m.id === 'oauth-personal');
        if (oauthMethod) {
            console.log('🔐 OAuth authentication required');
            console.log('Please visit the URL shown in Gemini CLI to authenticate');
        }
    }

    return false;
}
```

### 3. Advanced Prompt Handling

```javascript
async function sendComplexPrompt(sessionId, messages, context = []) {
    const prompt = [
        ...context.map(item => ({
            type: item.type,
            [item.type === 'text' ? 'text' : 'data']: item.content
        })),
        ...messages.map(msg => ({
            type: 'text',
            text: msg
        }))
    ];

    return await sendRequest({
        jsonrpc: '2.0',
        method: 'session/prompt',
        params: {
            sessionId,
            prompt
        }
    });
}

// Usage example:
await sendComplexPrompt(sessionId, [
    'What does this code do?'
], [
    {
        type: 'text',
        content: '// File: app.js\nconsole.log("Hello World");'
    }
]);
```

### 4. Streaming Response Collector

```javascript
class ResponseCollector {
    constructor() {
        this.responses = [];
        this.thoughts = [];
        this.messages = [];
        this.toolCalls = [];
    }

    collectUpdate(params) {
        const { update } = params;

        switch (update.sessionUpdate) {
            case 'agent_thought_chunk':
                this.thoughts.push(update.content.text);
                break;
            case 'agent_message_chunk':
                this.messages.push(update.content.text);
                break;
            case 'tool_call':
                this.toolCalls.push({
                    title: update.title,
                    status: update.status,
                    toolCallId: update.toolCallId
                });
                break;
        }

        this.responses.push(update);
    }

    getFullResponse() {
        return {
            thoughts: this.thoughts.join('\n'),
            message: this.messages.join('\n'),
            toolCalls: this.toolCalls,
            raw: this.responses
        };
    }
}
```

---

## Error Handling

### Common Errors and Solutions

#### 1. Process Spawning Errors
```javascript
childProcess.on('error', (error) => {
    if (error.code === 'ENOENT') {
        console.error('❌ Gemini CLI not found. Install with: npm install -g @google/gemini-cli');
    } else {
        console.error('❌ Process error:', error.message);
    }
});
```

#### 2. Request Timeouts
```javascript
// Increase timeout for long operations
setTimeout(() => {
    if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout after 30 seconds'));
    }
}, 30000);
```

#### 3. Protocol Errors
```javascript
if (response.error) {
    switch (response.error.code) {
        case -32601:
            console.error('❌ Method not found:', response.error.message);
            break;
        case -32602:
            console.error('❌ Invalid params:', response.error.message);
            break;
        case -32603:
            console.error('❌ Internal error:', response.error.message);
            break;
        default:
            console.error('❌ Error:', response.error.message);
    }
}
```

#### 4. Session Errors
```javascript
try {
    const sessionResponse = await sendRequest({
        jsonrpc: '2.0',
        method: 'session/new',
        params: {
            cwd: process.cwd(),
            mcpServers: []
        }
    });
} catch (error) {
    if (error.message.includes('authentication')) {
        console.error('❌ Authentication required. Please set GEMINI_API_KEY');
    } else {
        console.error('❌ Session creation failed:', error.message);
    }
}
```

---

## Best Practices

### 1. Resource Management
```javascript
// Proper cleanup
function cleanup() {
    if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM');
    }
    pendingRequests.clear();
    sessions.clear();
}

// Handle process exit
process.on('SIGINT', () => {
    console.log('\n🛑 Cleaning up...');
    cleanup();
    process.exit(0);
});
```

### 2. Request Tracking
```javascript
// Enhanced request tracking with metadata
class RequestTracker {
    constructor() {
        this.requests = new Map();
        this.idCounter = 1;
    }

    createRequest(method, params, timeout = 10000) {
        const id = this.idCounter++;
        const request = {
            id,
            method,
            params,
            timestamp: Date.now(),
            timeout
        };

        this.requests.set(id, request);
        return request;
    }

    completeRequest(id, result) {
        const request = this.requests.get(id);
        if (request) {
            request.duration = Date.now() - request.timestamp;
            request.result = result;
            this.requests.delete(id);
        }
    }

    getActiveRequests() {
        return Array.from(this.requests.values());
    }
}
```

### 3. Performance Optimization
```javascript
// Reuse readline interfaces
const readlineInterfaces = new Map();

function getReadlineInterface(stream) {
    if (!readlineInterfaces.has(stream)) {
        const interface = createInterface({
            input: stream,
            crlfDelay: Infinity
        });
        readlineInterfaces.set(stream, interface);
    }
    return readlineInterfaces.get(stream);
}
```

### 4. Security Considerations
```javascript
// Validate file paths
function validateFilePath(path) {
    const resolved = path.resolve(path);
    const cwd = process.cwd();

    // Prevent directory traversal attacks
    if (!resolved.startsWith(cwd)) {
        throw new Error('Invalid file path');
    }

    return resolved;
}

// Sanitize user input
function sanitizeInput(input) {
    return input.replace(/[<>\"']/g, '');
}
```

---

## Complete Implementation

Here's a production-ready implementation based on `quick-gemini-test.js`:

```javascript
#!/usr/bin/env node

const { spawn } = require('child_process');
const { createInterface } = require('readline');
const EventEmitter = require('events');

class GeminiACPClient extends EventEmitter {
    constructor(options = {}) {
        super();

        this.geminiPath = options.geminiPath || this.findGeminiPath();
        this.requestId = 1;
        this.pendingRequests = new Map();
        this.sessions = new Map();
        this.childProcess = null;
        this.timeout = options.timeout || 30000;

        // Setup event handlers
        this.setupProcessHandlers();
    }

    findGeminiPath() {
        const possiblePaths = [
            'C:/Program Files/nodejs/node_modules/@google/gemini-cli/dist/index.js',
            process.env.APPDATA + '/npm/node_modules/@google/gemini-cli/dist/index.js',
            './node_modules/@google/gemini-cli/dist/index.js'
        ];

        for (const path of possiblePaths) {
            const fs = require('fs');
            if (fs.existsSync(path)) {
                return path;
            }
        }

        throw new Error('Gemini CLI not found. Install with: npm install -g @google/gemini-cli');
    }

    async connect() {
        console.log('🔌 Connecting to Gemini CLI...');

        // Spawn process
        this.childProcess = spawn('node', [this.geminiPath, '--experimental-acp'], {
            stdio: 'pipe',
            env: {
                ...process.env,
                ...(process.env.GEMINI_API_KEY && { GEMINI_API_KEY: process.env.GEMINI_API_KEY })
            }
        });

        this.setupCommunication();
        await this.initialize();

        console.log('✅ Connected to Gemini CLI');
        return this;
    }

    setupCommunication() {
        // Setup stdout handling
        const stdoutInterface = createInterface({
            input: this.childProcess.stdout,
            crlfDelay: Infinity
        });

        stdoutInterface.on('line', (line) => {
            if (line.trim()) {
                this.handleMessage(line);
            }
        });

        // Setup stderr handling
        const stderrInterface = createInterface({
            input: this.childProcess.stderr,
            crlfDelay: Infinity
        });

        stderrInterface.on('line', (line) => {
            if (line.trim() && !line.includes('DeprecationWarning')) {
                this.emit('log', line);
            }
        });
    }

    handleMessage(line) {
        try {
            const message = JSON.parse(line);

            // Handle request responses
            if (message.id && this.pendingRequests.has(message.id)) {
                const { resolve, reject } = this.pendingRequests.get(message.id);
                this.pendingRequests.delete(message.id);

                if (message.error) {
                    reject(new Error(message.error.message));
                } else {
                    resolve(message);
                }
            }

            // Handle streaming updates
            if (message.method === 'session/update') {
                this.emit('update', message.params);
            }

            // Handle permission requests
            if (message.method === 'session/request_permission') {
                this.emit('permission', message.params);
            }

        } catch (error) {
            this.emit('error', new Error(`Failed to parse message: ${line}`));
        }
    }

    async initialize() {
        const response = await this.sendRequest({
            jsonrpc: '2.0',
            method: 'initialize',
            params: {
                protocolVersion: 1,
                clientCapabilities: {
                    fs: { readTextFile: true, writeTextFile: true },
                    terminal: true
                }
            }
        });

        this.emit('initialized', response.result);
        return response.result;
    }

    async createSession(name, options = {}) {
        const response = await this.sendRequest({
            jsonrpc: '2.0',
            method: 'session/new',
            params: {
                cwd: options.cwd || process.cwd(),
                mcpServers: options.mcpServers || []
            }
        });

        const sessionId = response.result.sessionId;
        this.sessions.set(name, sessionId);

        this.emit('sessionCreated', { name, sessionId });
        return sessionId;
    }

    async sendPrompt(sessionName, prompt, options = {}) {
        const sessionId = this.sessions.get(sessionName);
        if (!sessionId) {
            throw new Error(`Session '${sessionName}' not found`);
        }

        const response = await this.sendRequest({
            jsonrpc: '2.0',
            method: 'session/prompt',
            params: {
                sessionId,
                prompt: Array.isArray(prompt) ? prompt : [{ type: 'text', text: prompt }]
            }
        });

        this.emit('promptSent', { sessionName, prompt, response });
        return response.result;
    }

    sendRequest(request) {
        return new Promise((resolve, reject) => {
            const id = request.id || this.requestId++;

            this.pendingRequests.set(id, { resolve, reject });

            this.childProcess.stdin.write(JSON.stringify({ ...request, id }) + '\n');

            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, this.timeout);
        });
    }

    setupProcessHandlers() {
        process.on('SIGINT', () => this.disconnect());
        process.on('SIGTERM', () => this.disconnect());
    }

    disconnect() {
        console.log('🔌 Disconnecting from Gemini CLI...');

        if (this.childProcess && !this.childProcess.killed) {
            this.childProcess.kill('SIGTERM');
        }

        this.pendingRequests.clear();
        this.sessions.clear();

        this.emit('disconnected');
    }
}

// Usage Example
async function main() {
    const client = new GeminiACPClient();

    // Set up event handlers
    client.on('update', (params) => {
        const { update } = params;

        switch (update.sessionUpdate) {
            case 'agent_thought_chunk':
                console.log(`\n💭 ${update.content.text}`);
                break;
            case 'agent_message_chunk':
                console.log(`\n🤖 ${update.content.text}`);
                break;
            case 'tool_call':
                console.log(`\n🔧 ${update.title} (${update.status})`);
                break;
        }
    });

    client.on('log', (message) => {
        console.log('📝', message);
    });

    client.on('error', (error) => {
        console.error('❌ Error:', error.message);
    });

    try {
        // Connect and initialize
        await client.connect();

        // Create session
        const sessionId = await client.createSession('default');

        // Send prompt
        await client.sendPrompt('default', 'Hello! Who are you and what can you help me with?');

        // Wait for responses
        await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
        console.error('❌ Failed:', error.message);
    } finally {
        client.disconnect();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = GeminiACPClient;
```

---

## Summary

This guide provides a complete implementation for integrating with Gemini CLI using the Agent Client Protocol. The key takeaways are:

1. **Process Management**: Properly spawn and manage the Gemini CLI process
2. **JSON-RPC Communication**: Implement bidirectional JSON-RPC 2.0 communication
3. **Session Management**: Create and manage conversation sessions
4. **Streaming Updates**: Handle real-time agent thoughts and responses
5. **Error Handling**: Implement robust error handling and recovery
6. **Resource Management**: Properly clean up resources and handle process exit

The working implementation in `quick-gemini-test.js` demonstrates all these concepts and can be extended for production use cases.