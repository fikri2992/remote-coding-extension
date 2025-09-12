import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';

interface WebSocketContextType {
  isConnected: boolean;
  connectionCount: number;
  lastActivity: string | null;
  supportsAcpRequests: boolean;
  connect: () => void;
  disconnect: () => void;
  // New helpers for sending and subscribing to messages
  sendJson: (message: any) => boolean;
  addMessageListener: (handler: (data: any) => void) => () => void;
  // ACP request/response helper
  sendAcp: (op: string, payload?: any, opts?: { timeoutMs?: number }) => Promise<any>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url
}) => {
  const defaultUrl = (() => {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${window.location.host}/ws`;
      } catch {
        /* ignore */
      }
    }
    return 'ws://localhost:3900/ws';
  })();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [ws, setWs] = useState<ReconnectingWebSocket | null>(null);
  const listenersRef = useRef<Array<(data: any) => void>>([]);
  const supportsAcpRef = useRef<boolean>(false);
  const [supportsAcpRequests, setSupportsAcpRequests] = useState<boolean>(false);
  const pendingAcpRef = useRef<Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer?: any }>>(new Map());

  useEffect(() => {
    // Force-enable debug logging for terminal communication debugging
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('KIRO_DEBUG_WS', '1');
      window.localStorage.setItem('KIRO_DEBUG_TERMINAL_CLIENT', '1');
    }

    const connectUrl = url || defaultUrl;
    const websocket = new ReconnectingWebSocket(connectUrl, [], {
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1.3,
      maxRetries: 50,
    });

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setLastActivity(new Date().toLocaleTimeString());
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setConnectionCount(0);
    };

    websocket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        try {
          const debug = (typeof window !== 'undefined' && (window as any).localStorage?.getItem('KIRO_DEBUG_WS') === '1');
          if (debug) {
            console.log('🔽 WebSocket Received:', data);
            // Track terminal frames specifically
            if (data.type === 'terminal') {
              console.log('📟 Terminal Frame:', {
                op: data.data?.op,
                sessionId: data.data?.sessionId,
                payloadSize: JSON.stringify(data).length
              });
            }
          }
        } catch {}

        if (data.type === 'connection_established') {
          setConnectionCount(prev => prev + 1);
          setLastActivity(new Date().toLocaleTimeString());
          if (data.supportsAcpRequests === true) {
            supportsAcpRef.current = true;
            setSupportsAcpRequests(true);
          }
        }

        // Resolve ACP request/response pairs
        if (data.type === 'acp_response' && data.id) {
          const entry = pendingAcpRef.current.get(String(data.id));
          if (entry) {
            pendingAcpRef.current.delete(String(data.id));
            if (entry.timer) { try { clearTimeout(entry.timer); } catch {} }
            if (data.ok) {
              let result = data.result;
              // Unwrap common { success/ok, data } envelope returned by services
              try {
                if (result && typeof result === 'object' && 'data' in result && (('success' in result) || ('ok' in result))) {
                  result = (result as any).data;
                }
              } catch {}
              entry.resolve(result);
            }
            else entry.reject(Object.assign(new Error(data?.error?.message || 'acp error'), { code: data?.error?.code, meta: data?.error?.meta }));
          }
        }

        // Notify subscribers
        try {
          listenersRef.current.forEach((handler) => handler(data));
        } catch (err) {
          console.error('Error in message listeners:', err);
        }

        // Update last activity on any message
        setLastActivity(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onerror = (event: any) => {
      console.error('WebSocket error:', event);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [url]);

  const connect = () => {
    if (ws && ws.readyState === WebSocket.CLOSED) {
      ws.reconnect();
    }
  };

  const disconnect = () => {
    if (ws) {
      ws.close();
    }
  };

  const sendJson = (message: any): boolean => {
    try {
      if (!ws) return false;
      if (ws.readyState !== WebSocket.OPEN) return false;
      const msg = JSON.stringify(message);
      try {
        const debug = (typeof window !== 'undefined' && ((window as any).localStorage?.getItem('KIRO_DEBUG_WS') === '1' || (window as any).localStorage?.getItem('KIRO_DEBUG_TERMINAL_CLIENT') === '1'));
        if (debug) {
          console.log('🔼 WebSocket Sending:', message);
          // Track terminal frames specifically
          if (message.type === 'terminal') {
            console.log('📟 Terminal Frame Out:', {
              op: message.data?.op,
              sessionId: message.data?.sessionId,
              payloadSize: msg.length
            });
          }
        }
      } catch {}
      ws.send(msg);
      setLastActivity(new Date().toLocaleTimeString());
      return true;
    } catch (e) {
      console.error('Failed to send over WebSocket:', e);
      return false;
    }
  };

  const addMessageListener = (handler: (data: any) => void) => {
    listenersRef.current.push(handler);
    // Return unsubscribe
    return () => {
      listenersRef.current = listenersRef.current.filter((h) => h !== handler);
    };
  };

  // WS-first ACP helper (request/response)
  const sendAcp = (op: string, payload?: any, opts?: { timeoutMs?: number }): Promise<any> => {
    return new Promise((resolve, reject) => {
      try {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          return reject(new Error('WebSocket not connected'));
        }
        const id = `acp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        const msg = { type: 'acp', id, op, payload: payload || {} };
        const timeoutMs = Math.max(1000, Math.min(60000, opts?.timeoutMs ?? 15000));
        const timer = setTimeout(() => {
          pendingAcpRef.current.delete(id);
          reject(new Error(`acp timeout for op=${op}`));
        }, timeoutMs);
        pendingAcpRef.current.set(id, { resolve, reject, timer });
        sendJson(msg);
      } catch (e) {
        reject(e);
      }
    });
  };

  const value: WebSocketContextType = {
    isConnected,
    connectionCount,
    lastActivity,
    supportsAcpRequests,
    connect,
    disconnect,
    sendJson,
    addMessageListener,
    sendAcp,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
