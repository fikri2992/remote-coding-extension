import React from 'react';
import { X } from 'lucide-react';

export type ContextChipProps = {
  label: string;
  onRemove?: () => void;
};

export const ContextChip: React.FC<ContextChipProps> = ({ label, onRemove }) => {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs bg-muted/40">
      @{label}
      {onRemove && (
        <button className="p-0.5" onClick={onRemove} aria-label={`Remove ${label}`}>
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};

export default ContextChip;

