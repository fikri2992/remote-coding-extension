import React from 'react';
import { GitStatusList, GitStatusItem } from '../components/git/GitStatusList';
import { CommitComposer } from '../components/git/CommitComposer';

const mockStatus: GitStatusItem[] = [
  { path: 'src/foo.ts', state: 'unstaged' },
  { path: 'README.md', state: 'staged' },
  { path: 'package.json', state: 'untracked' },
];

const GitPage: React.FC = () => {
  const [items] = React.useState<GitStatusItem[]>(mockStatus);
  const onCommit = (msg: string) => {
    // Placeholder: real implementation via WS later
    console.log('Commit:', msg);
  };
  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Git Operations</h3>
      <GitStatusList items={items} className="mb-4" />
      <CommitComposer onCommit={onCommit} />
    </div>
  );
};

export default GitPage;
