import React from 'react'

export const CommitComposer: React.FC<{ onCommit: (msg: string) => void; disabled?: boolean; className?: string }>
  = ({ onCommit, disabled, className }) => {
  const [msg, setMsg] = React.useState('')
  const submit = () => { if (msg.trim()) onCommit(msg.trim()) }
  return (
    <div className={`rounded-md border border-border p-3 ${className || ''}`}>
      <label className="block text-sm font-medium mb-2">Commit message</label>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        rows={3}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="feat: add X or fix: Y"
      />
      <div className="mt-2 flex items-center justify-end">
        <button
          disabled={disabled || !msg.trim()}
          onClick={submit}
          className="rounded-md bg-primary disabled:opacity-50 px-3 py-2 text-white text-sm hover:bg-primary/90"
        >Commit</button>
      </div>
    </div>
  )
}

