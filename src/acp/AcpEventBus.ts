import { EventEmitter } from 'events';

// Global event bus to bridge ACP events to WebSocket broadcast
// HttpServer emits on this bus; ServerManager subscribes and forwards to WebSocketServer
export const AcpEventBus = new EventEmitter();
