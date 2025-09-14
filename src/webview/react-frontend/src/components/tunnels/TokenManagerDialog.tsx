import * as React from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useTunnelTokens, type TunnelToken } from '../../lib/hooks/useTunnelTokens'
import { useToast } from '../ui/toast'

interface TokenManagerDialogProps {
  open: boolean
  onClose: () => void
  onSelectToken?: (token: TunnelToken) => void
}

export const TokenManagerDialog: React.FC<TokenManagerDialogProps> = ({ open, onClose, onSelectToken }) => {
  const { tokens, addToken, removeToken } = useTunnelTokens()
  const { show } = useToast()
  const [label, setLabel] = React.useState('')
  const [value, setValue] = React.useState('')
  const [error, setError] = React.useState<string>('')

  const handleAdd = async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Token value is required')
      return
    }
    try {
      const t = await addToken(label.trim() || 'Token', trimmed)
      setLabel('')
      setValue('')
      setError('')
      if (onSelectToken && t) onSelectToken(t)
      show({ variant: 'success', title: 'Token added' })
    } catch (e: any) {
      show({ variant: 'destructive', title: 'Add token failed', description: e?.message })
    }
  }

  const masked = (v: string) => {
    const s = v.trim()
    if (s.length <= 12) return s.replace(/./g, '•')
    return `${s.slice(0, 6)}••••${s.slice(-4)}`
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Manage Tokens</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium mb-2">Add New Token</div>
          <div className="grid grid-cols-1 gap-2">
            <Input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <textarea
              className="min-h-[100px] w-full rounded-md border border-gray-300 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              placeholder="Paste token value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!!error}
            />
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={!value.trim()}>Add Token</Button>
              <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="text-sm font-medium mb-2">Saved Tokens</div>
          {tokens.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tokens saved yet.</div>
          ) : (
            <ul className="space-y-2">
              {tokens.map(t => (
                <li key={t.id} className="flex items-center justify-between gap-2 p-2 border border-border rounded">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{masked(t.value)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onSelectToken && (
                      <Button size="sm" variant="secondary" onClick={() => onSelectToken(t)}>Use</Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={async () => {
                      try { await removeToken(t.id); show({ variant: 'default', title: 'Token deleted' }) } catch (e: any) { show({ variant: 'destructive', title: 'Delete failed', description: e?.message }) }
                    }}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DialogFooter />
    </Dialog>
  )
}
