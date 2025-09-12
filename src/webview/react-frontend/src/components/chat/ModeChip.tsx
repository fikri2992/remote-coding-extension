import React from 'react';

export type ModeChipProps = {
  modeId?: string | null;
  onClick?: () => void;
  hidden?: boolean;
};

export const ModeChip: React.FC<ModeChipProps> = ({ modeId, onClick, hidden }) => {
  if (hidden) return null;
  const label = modeId ? `Mode: ${modeId}` : 'Mode';
  return (
    <button
      type="button"
      className="text-xs px-2 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted"
      onClick={onClick}
      aria-label="Select mode"
    >
      {label}
    </button>
  );
};

export default ModeChip;

