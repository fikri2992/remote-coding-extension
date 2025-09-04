import React from 'react'

export interface FieldSchema {
  key: string
  type: 'number' | 'string'
  minimum?: number
  maximum?: number
  description?: string
}

export const ConfigForm: React.FC<{
  schema: Record<string, FieldSchema>
  values: Record<string, any>
  onChange: (key: string, value: any) => void
  onSubmit: () => void
  onReset?: () => void
}>
  = ({ schema, values, onChange, onSubmit, onReset }) => {
  const entries = Object.values(schema)
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="space-y-4">
      {entries.map(field => (
        <div key={field.key} className="space-y-1">
          <label className="block text-sm font-medium" htmlFor={field.key}>{field.key}</label>
          {field.type === 'number' ? (
            <input
              id={field.key}
              type="number"
              min={field.minimum}
              max={field.maximum}
              value={Number(values[field.key] ?? '')}
              onChange={(e) => onChange(field.key, Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <input
              id={field.key}
              value={String(values[field.key] ?? '')}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          )}
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-md bg-primary px-3 py-2 text-white text-sm hover:bg-primary/90">Save</button>
        {onReset && (
          <button type="button" onClick={onReset} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Reset</button>
        )}
      </div>
    </form>
  )
}

