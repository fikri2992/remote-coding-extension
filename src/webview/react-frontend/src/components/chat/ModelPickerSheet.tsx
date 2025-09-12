import React from 'react';
import { Button } from '@/components/ui/button';

export type ModelPickerSheetProps = {
  open: boolean;
  onClose: () => void;
  models: string[];
  current?: string | null;
  onSelect: (modelId: string) => void;
};

export const ModelPickerSheet: React.FC<ModelPickerSheetProps> = ({ open, onClose, models, current, onSelect }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-lg md:rounded-lg w-full md:w-[520px] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Select Model</div>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
        <div className="space-y-1 max-h-[50vh] overflow-auto">
          {!models.length && (
            <div className="text-xs text-muted-foreground">No models available</div>
          )}
          {models.map((m) => (
            <button
              key={m}
              className="w-full text-left border border-input rounded px-2 py-1 hover:bg-muted text-sm"
              onClick={() => onSelect(m)}
            >
              {m}{current === m ? ' (current)' : ''}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModelPickerSheet;

