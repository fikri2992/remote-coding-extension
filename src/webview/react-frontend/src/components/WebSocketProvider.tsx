import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';

interface WebSocketContextType {
  isConnected: boolean;
  connectionCount: number;
  lastActivity: string | null;
  connect: () => void;
  disconnect: () => void;
  // New helpers for sending and subscribing to messages
  sendJson: (message: any) => boolean;
  addMessageListener: (handler: (data: any) => void) => () => void;
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

  useEffect(() => {
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
          if (debug) console.log('Received message:', data);
        } catch {}

        if (data.type === 'connection_established') {
          setConnectionCount(prev => prev + 1);
          setLastActivity(new Date().toLocaleTimeString());
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
      ws.send(JSON.stringify(message));
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

  const value: WebSocketContextType = {
    isConnected,
    connectionCount,
    lastActivity,
    connect,
    disconnect,
    sendJson,
    addMessageListener,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
