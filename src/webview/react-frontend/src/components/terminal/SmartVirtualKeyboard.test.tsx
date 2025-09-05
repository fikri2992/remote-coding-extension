import React from 'react';
import { SmartVirtualKeyboard } from './SmartVirtualKeyboard';

// Simple test to verify the component renders and basic functionality works
const TestSmartVirtualKeyboard: React.FC = () => {
  const [output, setOutput] = React.useState<string>('');
  const [terminalState, setTerminalState] = React.useState<'idle' | 'active' | 'input' | 'running'>('idle');
  const [commandHistory] = React.useState<string[]>(['ls -la', 'cd /home', 'pwd', 'git status']);

  const handleInput = (data: string) => {
    setOutput(prev => prev + data);
    console.log('Virtual keyboard input:', data);
  };

  const handleClose = () => {
    console.log('Virtual keyboard closed');
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Smart Virtual Keyboard Test</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Terminal State:</label>
        <select 
          value={terminalState} 
          onChange={(e) => setTerminalState(e.target.value as any)}
          className="border rounded px-3 py-2"
        >
          <option value="idle">Idle</option>
          <option value="active">Active</option>
          <option value="input">Input</option>
          <option value="running">Running</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Output:</label>
        <div className="bg-black text-green-400 p-3 rounded font-mono text-sm min-h-[100px] whitespace-pre-wrap">
          {output || 'Type using the virtual keyboard below...'}
        </div>
        <button 
          onClick={() => setOutput('')}
          className="mt-2 px-3 py-1 bg-gray-500 text-white rounded text-sm"
        >
          Clear Output
        </button>
      </div>

      <SmartVirtualKeyboard
        onInput={handleInput}
        onClose={handleClose}
        terminalState={terminalState}
        currentDirectory="/home/user/projects"
        commandHistory={commandHistory}
        autoHide={false} // Disable auto-hide for testing
        predictiveText={true}
      />
    </div>
  );
};

export default TestSmartVirtualKeyboard;