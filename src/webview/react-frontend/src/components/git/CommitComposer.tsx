import React from 'react'

export const CommitComposer: React.FC<{ onCommit: (msg: string) => void; disabled?: boolean; className?: string }>
  = ({ onCommit, disabled, className }) => {
  const [msg, setMsg] = React.useState('')
  const submit = () => { if (msg.trim()) onCommit(msg.trim()) }
  return (
    <div className={`rounded-md border border-border p-3 neo:rounded-none neo:border-[3px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)] ${className || ''}`}>
      <label className="block text-sm font-medium mb-2 neo:font-extrabold neo:tracking-wide">Commit message</label>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary neo:rounded-none neo:border-[3px] neo:border-border neo:font-semibold neo:focus:ring-0 neo:focus-visible:outline-4 neo:focus-visible:outline-black dark:neo:focus-visible:outline-white"
        rows={3}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="feat: add X or fix: Y"
      />
      <div className="mt-2 flex items-center justify-end">
        <button
          disabled={disabled || !msg.trim()}
          onClick={submit}
          className="rounded-md bg-primary disabled:opacity-50 px-3 py-2 text-white text-sm hover:bg-primary/90 neo:rounded-none neo:border-[4px] neo:border-border neo:text-primary-foreground neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]"
        >Commit</button>
      </div>
    </div>
  )
}
