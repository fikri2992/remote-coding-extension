import React, { createContext, useContext, useEffect, useState } from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';

interface WebSocketContextType {
  isConnected: boolean;
  connectionCount: number;
  lastActivity: string | null;
  connect: () => void;
  disconnect: () => void;
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
  url = 'ws://localhost:8080'
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [ws, setWs] = useState<ReconnectingWebSocket | null>(null);

  useEffect(() => {
    const websocket = new ReconnectingWebSocket(url, [], {
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
        console.log('Received message:', data);

        if (data.type === 'connection_established') {
          setConnectionCount(prev => prev + 1);
          setLastActivity(new Date().toLocaleTimeString());
        }
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

  const value: WebSocketContextType = {
    isConnected,
    connectionCount,
    lastActivity,
    connect,
    disconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
