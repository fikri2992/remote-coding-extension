import React from 'react';
import { TerminalView } from '../components/terminal/TerminalView';

const TerminalPage: React.FC = () => {
  const [output, setOutput] = React.useState('');
  const onSend = (cmd: string) => {
    // Placeholder: append to output
    setOutput((prev) => prev + `\n$ ${cmd}`);
  };
  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Terminal Sessions</h3>
      <TerminalView output={output} onSend={onSend} />
    </div>
  );
};

export default TerminalPage;
