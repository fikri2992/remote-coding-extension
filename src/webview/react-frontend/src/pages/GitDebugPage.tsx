import React, { useState } from 'react';
import { useWebSocket } from '../components/WebSocketProvider';

const GitDebugPage: React.FC = () => {
  const { sendJson, addMessageListener } = useWebSocket();
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const runDebugCommand = async (operation: string, debugOperation?: string) => {
    const id = `debug_${Date.now()}`;
    setLoading(operation);
    
    const unsub = addMessageListener((msg) => {
      if (msg?.type === 'git' && msg.id === id) {
        setLoading(null);
        if (msg.data?.ok) {
          setResults(prev => [...prev, `✅ ${operation}: ${JSON.stringify(msg.data.gitData.result, null, 2)}`]);
        } else {
          setResults(prev => [...prev, `❌ ${operation}: ${msg.data?.error || 'Unknown error'}`]);
        }
        unsub();
      }
    });

    sendJson({ 
      type: 'git', 
      id, 
      data: { 
        gitData: { 
          operation, 
          options: debugOperation ? { debugOperation } : {} 
        } 
      } 
    });
  };

  const clearResults = () => setResults([]);

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Git Debug Console</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => runDebugCommand('debug', 'simple-log')}
          disabled={!!loading}
          className="p-3 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Test Simple Log
        </button>
        
        <button 
          onClick={() => runDebugCommand('debug', 'log-with-format')}
          disabled={!!loading}
          className="p-3 bg-green-500 text-white rounded disabled:opacity-50"
        >
          Test Formatted Log
        </button>
        
        <button 
          onClick={() => runDebugCommand('debug', 'status')}
          disabled={!!loading}
          className="p-3 bg-yellow-500 text-white rounded disabled:opacity-50"
        >
          Test Status
        </button>
        
        <button 
          onClick={() => runDebugCommand('debug', 'branch')}
          disabled={!!loading}
          className="p-3 bg-purple-500 text-white rounded disabled:opacity-50"
        >
          Test Branch
        </button>
        
        <button 
          onClick={() => runDebugCommand('log')}
          disabled={!!loading}
          className="p-3 bg-red-500 text-white rounded disabled:opacity-50"
        >
          Test Full Log (Original)
        </button>
        
        <button 
          onClick={clearResults}
          disabled={!!loading}
          className="p-3 bg-gray-500 text-white rounded disabled:opacity-50"
        >
          Clear Results
        </button>
      </div>

      {loading && (
        <div className="p-4 bg-blue-100 rounded">
          Running: {loading}...
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">Results:</h3>
        <div className="bg-gray-100 p-4 rounded max-h-96 overflow-auto">
          {results.length === 0 ? (
            <p className="text-gray-500">No results yet. Click a test button above.</p>
          ) : (
            results.map((result, i) => (
              <pre key={i} className="text-sm mb-2 whitespace-pre-wrap">
                {result}
              </pre>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GitDebugPage;