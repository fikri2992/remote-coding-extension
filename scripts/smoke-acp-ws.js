#!/usr/bin/env node
// WS-first ACP smoke test
// Usage: BASE_URL=http://localhost:3900 ANTHROPIC_API_KEY=... node scripts/smoke-acp-ws.js

const WebSocket = require('ws');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3900';

function makeWsUrl(base) {
  try {
    const u = new URL(base);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = '/ws';
    u.search = '';
    return u.toString();
  } catch (e) {
    return 'ws://localhost:3900/ws';
  }
}

function waitOpen(ws) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('ws open timeout')), 10000);
    ws.on('open', () => { clearTimeout(to); resolve(); });
    ws.on('error', reject);
  });
}

function waitHello(ws) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('hello timeout')), 10000);
    const onMsg = (data) => {
      try {
        const msg = JSON.parse(String(data));
        if (msg && msg.type === 'connection_established') {
          clearTimeout(to);
          ws.off('message', onMsg);
          resolve(msg);
        }
      } catch {}
    };
    ws.on('message', onMsg);
  });
}

function sendAcp(ws, op, payload = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = `acp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const timer = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error(`acp timeout for op=${op}`));
    }, Math.max(1000, Math.min(60000, timeoutMs)));

    function onMsg(data) {
      try {
        const msg = JSON.parse(String(data));
        if (msg && msg.type === 'acp_response' && String(msg.id) === id) {
          clearTimeout(timer);
          ws.off('message', onMsg);
          if (msg.ok) resolve(msg.result);
          else reject(Object.assign(new Error(msg?.error?.message || 'acp error'), { code: msg?.error?.code, meta: msg?.error?.meta }));
        }
      } catch {}
    }

    ws.on('message', onMsg);
    ws.send(JSON.stringify({ type: 'acp', id, op, payload }));
  });
}

async function main() {
  console.log(`[ws-smoke] BASE_URL=${BASE_URL}`);
  const wsUrl = makeWsUrl(BASE_URL);
  const ws = new WebSocket(wsUrl);

  let printed = 0;
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data));
      if (['agent_connect','agent_initialized','session_update','permission_request','agent_stderr'].includes(msg?.type)) {
        if (printed++ < 10) console.log('[event]', msg.type);
      }
    } catch {}
  });

  await waitOpen(ws);
  await waitHello(ws);

  const env = {};
  if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  console.log('[ws-smoke] connect');
  const connect = await sendAcp(ws, 'connect', { env });
  console.log('[ws-smoke] connected:', !!connect?.init);

  console.log('[ws-smoke] session.new');
  const sess = await sendAcp(ws, 'session.new', {});
  console.log('[ws-smoke] sessionId:', sess.sessionId);

  console.log('[ws-smoke] prompt');
  try {
    await sendAcp(ws, 'prompt', { sessionId: sess.sessionId, prompt: [{ type: 'text', text: 'Hello from WS smoke test!' }] });
  } catch (e) {
    if (e && e.code === 401) {
      console.warn('[ws-smoke] prompt returned 401 (auth required). Provide ANTHROPIC_API_KEY and retry.');
    } else {
      console.warn('[ws-smoke] prompt error:', e.message);
    }
  }

  await new Promise((r) => setTimeout(r, 3000));
  try { ws.close(); } catch {}
}

main().catch((e) => {
  console.error('[ws-smoke] failed:', e.message);
  process.exit(1);
});
