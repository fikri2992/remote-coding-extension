import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { cn } from './lib/utils';

const App: React.FC = () => {
  const [activeItem, setActiveItem] = useState('home');

  const renderContent = () => {
    switch (activeItem) {
      case 'home':
        return <div>Welcome to Web Automation Tunnel</div>;
      case 'server':
        return <div>Server Controls</div>;
      case 'files':
        return <div>File Explorer</div>;
      case 'git':
        return <div>Git Operations</div>;
      case 'terminal':
        return <div>Terminal Sessions</div>;
      case 'chat':
        return <div>Chat & Messaging</div>;
      default:
        return <div>Select an option from the menu</div>;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />
      <main className={cn('flex-1 p-6 overflow-auto')}>
        <h2 className="text-2xl font-bold mb-4 capitalize">{activeItem}</h2>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
