import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

export type JsonValue = any;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: JsonValue;
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: JsonValue;
}

interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: number | string;
  result: JsonValue;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: JsonValue;
}

interface JsonRpcFailure {
  jsonrpc: '2.0';
  id: number | string | null;
  error: JsonRpcError;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export type FramingMode = 'lsp' | 'ndjson';

function encodeMessage(obj: object, mode: FramingMode): Buffer {
  const json = JSON.stringify(obj);
  if (mode === 'ndjson') {
    return Buffer.from(json + '\n', 'utf8');
  }
  const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, 'ascii'), Buffer.from(json, 'utf8')]);
}

export class JsonRpcStdioClient extends EventEmitter {
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private incomingBuffer: Buffer = Buffer.alloc(0);
  private contentLength: number | null = null;
  private mode: FramingMode;

  constructor(private outgoing: Writable, private incoming: Readable, mode: FramingMode = 'lsp') {
    super();
    this.mode = mode;
    this.incoming.on('data', (chunk: Buffer) => this.onData(chunk));
    this.incoming.on('error', (err) => this.emit('error', err));
  }

  request<T = any>(method: string, params?: JsonValue): Promise<T> {
    const id = this.nextId++;
    const message: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    const buf = encodeMessage(message, this.mode);
    this.outgoing.write(buf);
    // Emit debug event for outgoing request
    try { this.emit('outgoing_request', { id, method, params }); } catch {}
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method: string, params?: JsonValue): void {
    const message: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    const buf = encodeMessage(message, this.mode);
    this.outgoing.write(buf);
    // Emit debug event for outgoing notification
    try { this.emit('outgoing_notification', { method, params }); } catch {}
  }

  respond(id: number | string | null, result?: JsonValue, error?: JsonRpcError) {
    const response: JsonRpcResponse = error
      ? { jsonrpc: '2.0', id, error }
      : { jsonrpc: '2.0', id: id as number, result };
    const buf = encodeMessage(response, this.mode);
    this.outgoing.write(buf);
  }

  onNotification(method: string, handler: (params: any) => void) {
    this.on('notification', (m: { method: string; params: any }) => {
      if (m.method === method) handler(m.params);
    });
  }

  onRequest(handler: (req: { id: number; method: string; params: any }) => void) {
    this.on('request', handler);
  }

  private onData(chunk: Buffer) {
    this.incomingBuffer = Buffer.concat([this.incomingBuffer, chunk]);
    while (true) {
      // Try LSP framing first
      const headerEnd = this.incomingBuffer.indexOf(Buffer.from('\r\n\r\n'));
      if (headerEnd !== -1) {
        const headerBuf = this.incomingBuffer.subarray(0, headerEnd).toString('ascii');
        const match = /Content-Length:\s*(\d+)/i.exec(headerBuf);
        if (match) {
          const len = parseInt(match[1]!, 10);
          if (this.incomingBuffer.length < headerEnd + 4 + len) return; // wait
          const body = this.incomingBuffer.subarray(headerEnd + 4, headerEnd + 4 + len);
          this.incomingBuffer = this.incomingBuffer.subarray(headerEnd + 4 + len);
          try {
            const msg = JSON.parse(body.toString('utf8')) as any;
            this.emit('raw', msg);
            this.routeMessage(msg);
          } catch (err) {
            this.emit('error', err);
          }
          continue;
        }
        // If header block exists but no content-length, drop it and continue
        this.incomingBuffer = this.incomingBuffer.subarray(headerEnd + 4);
        continue;
      }

      // Try NDJSON line framing
      const nl = this.incomingBuffer.indexOf(Buffer.from('\n'));
      if (nl === -1) return; // need more data
      const line = this.incomingBuffer.subarray(0, nl).toString('utf8').trim();
      this.incomingBuffer = this.incomingBuffer.subarray(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as any;
        this.emit('raw', msg);
        this.routeMessage(msg);
      } catch (err) {
        // Not JSON — skip this line to avoid stalling
        this.emit('error', new Error(`jsonrpc: failed to parse line as JSON: ${line.slice(0, 80)}`));
      }
    }
  }

  private routeMessage(msg: any) {
    if (typeof msg.id !== 'undefined' && (msg.result !== undefined || msg.error !== undefined)) {
      // Emit debug for incoming response
      try { this.emit('incoming_response', { id: msg.id, result: (msg as any).result, error: (msg as any).error }); } catch {}
      const entry = this.pending.get(msg.id);
      if (entry) {
        this.pending.delete(msg.id);
        if (msg.error) entry.reject(Object.assign(new Error(msg.error.message), { code: msg.error.code, data: msg.error.data }));
        else entry.resolve(msg.result);
      }
      return;
    }
    if (typeof msg.id !== 'undefined' && typeof msg.method === 'string') {
      this.emit('request', { id: msg.id, method: msg.method, params: msg.params });
      return;
    }
    if (typeof msg.method === 'string' && msg.id === undefined) {
      this.emit('notification', { method: msg.method, params: msg.params });
      return;
    }
  }
}
