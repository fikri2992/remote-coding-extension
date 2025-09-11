#!/usr/bin/env node
/*
 Simple ACP smoke test
 - Connects to server REST and WS
 - POST /api/connect (agentCmd optional)
 - POST /api/session/new
 - POST /api/prompt with a simple text
 - Prints a few WS events then exits

 Usage:
   BASE_URL=http://localhost:3900 node scripts/smoke-acp.js
   (ANTHROPIC_API_KEY env is used if present)
*/

const http = require('http');
const https = require('https');
const { URL } = require('url');
const WebSocket = require('ws');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3900';

function jsonRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(path, BASE_URL);
      const data = body ? JSON.stringify(body) : undefined;
      const opts = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data ? Buffer.byteLength(data) : 0,
        },
      };
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request(u, opts, (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (buf += chunk));
        res.on('end', () => {
          const contentType = res.headers['content-type'] || '';
          let json = {};
          try {
            json = buf ? (contentType.includes('application/json') ? JSON.parse(buf) : { raw: buf }) : {};
          } catch (e) {
            return reject(new Error(`Invalid JSON (status ${res.statusCode}): ${buf.slice(0, 200)}`));
          }
          if (res.statusCode >= 400) {
            const err = new Error(json.error || json.message || `HTTP ${res.statusCode}`);
            err.status = res.statusCode;
            err.body = json;
            return reject(err);
          }
          resolve(json);
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function main() {
  console.log(`[smoke] BASE_URL=${BASE_URL}`);

  // Open WS first to capture events
  const wsUrl = (() => {
    const u = new URL(BASE_URL);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = '/ws';
    u.search = '';
    return u.toString();
  })();

  const ws = new WebSocket(wsUrl);
  let wsMessages = 0;
  ws.on('open', () => console.log('[smoke] WS open'));
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data));
      wsMessages++;
      // Print a few messages for visibility
      if (wsMessages <= 10) console.log('[ws]', msg.type || msg);
    } catch {}
  });
  ws.on('error', (e) => console.log('[smoke] WS error:', e.message));

  // Connect
  const env = {};
  if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  console.log('[smoke] POST /api/connect');
  const connectResp = await jsonRequest('POST', '/api/connect', { env });
  console.log('[smoke] connected:', !!connectResp?.init);
  if (connectResp?.debug) {
    console.log('[smoke] connect.debug:', connectResp.debug);
  }

  // New session
  console.log('[smoke] POST /api/session/new');
  const newSess = await jsonRequest('POST', '/api/session/new', {});
  console.log('[smoke] sessionId:', newSess.sessionId);

  // Prompt
  console.log('[smoke] POST /api/prompt');
  try {
    await jsonRequest('POST', '/api/prompt', {
      sessionId: newSess.sessionId,
      prompt: [{ type: 'text', text: 'Hello from smoke test!' }],
    });
  } catch (e) {
    if (e.status === 401) {
      console.warn('[smoke] prompt returned 401 (auth required). Provide ANTHROPIC_API_KEY and retry.');
    } else {
      console.warn('[smoke] prompt error:', e.message);
    }
  }

  // Wait a bit for streaming events
  await new Promise((r) => setTimeout(r, 4000));
  console.log('[smoke] done. Closing WS.');
  try { ws.close(); } catch {}
}

main().catch((e) => {
  console.error('[smoke] failed:', e.message);
  process.exit(1);
});
