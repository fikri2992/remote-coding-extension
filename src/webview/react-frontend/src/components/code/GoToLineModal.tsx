import React, { useEffect, useState } from 'react'
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from '../ui/bottom-sheet'

export interface GoToLineModalProps {
  open: boolean
  maxLines?: number
  onClose: () => void
  onSubmit: (opts: { line: number; column?: number }) => void
}

const GoToLineModal: React.FC<GoToLineModalProps> = ({ open, maxLines, onClose, onSubmit }) => {
  const [line, setLine] = useState<string>('')
  const [column, setColumn] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (open) {
      setLine('')
      setColumn('')
      setError('')
    }
  }, [open])

  const submit = () => {
    const l = parseInt(line, 10)
    const c = column ? parseInt(column, 10) : undefined
    if (isNaN(l) || l < 1) {
      setError('Enter a valid line number (>= 1).')
      return
    }
    if (maxLines && l > maxLines) {
      setError(`Max line is ${maxLines}.`)
      return
    }
    if (column && (isNaN(Number(column)) || (c as number) < 1)) {
      setError('Enter a valid column (>= 1).')
      return
    }
    onSubmit({ line: l, column: c })
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Go to line">
      <BottomSheetHeader>
        <BottomSheetTitle>Go to line</BottomSheetTitle>
      </BottomSheetHeader>
      <div className="px-3 py-2 space-y-3">
        <div className="text-xs text-muted-foreground">
          {maxLines ? `Enter a line number between 1 and ${maxLines}.` : 'Enter a line and optional column.'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Line</label>
            <input
              type="number"
              min={1}
              value={line}
              onChange={(e) => setLine(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 neo:rounded-none neo:border-[2px]"
              placeholder="e.g. 1205"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Column (optional)</label>
            <input
              type="number"
              min={1}
              value={column}
              onChange={(e) => setColumn(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 neo:rounded-none neo:border-[2px]"
              placeholder="e.g. 1"
            />
          </div>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
      <BottomSheetFooter>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm neo:rounded-none neo:border-[2px]">Cancel</button>
          <button onClick={submit} className="rounded-md border border-border px-3 py-2 text-sm bg-primary text-primary-foreground neo:rounded-none neo:border-[2px]">Go</button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>
  )
}

export default GoToLineModal
