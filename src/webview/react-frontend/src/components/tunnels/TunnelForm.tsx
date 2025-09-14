import React, { useEffect, useState } from 'react'
import { CreateTunnelRequest } from '../../types/tunnel'
import { Play, Loader2, Info } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
// Segmented control implemented inline; radio group not used anymore
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { TokenManagerDialog } from './TokenManagerDialog'
import { useTunnelTokens } from '../../lib/hooks/useTunnelTokens'

interface TunnelFormProps {
  onCreateTunnel: (request: CreateTunnelRequest) => void
  loading?: boolean
  disabled?: boolean
}

export const TunnelForm: React.FC<TunnelFormProps> = ({ onCreateTunnel, loading = false, disabled = false }) => {
  const [formData, setFormData] = useState<CreateTunnelRequest>({ localPort: 3000, type: 'quick', name: '', token: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof CreateTunnelRequest, string>>>({})
  const { tokens } = useTunnelTokens()
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    try {
      const saved = (typeof window !== 'undefined' && window.localStorage.getItem('KIRO_LAST_TUNNEL_PORT')) || ''
      const n = parseInt(saved, 10)
      if (!Number.isNaN(n) && n >= 1 && n <= 65535) {
        setFormData(prev => ({ ...prev, localPort: n }))
      }
    } catch {}
  }, [])

  // When switching to Named and there are no saved tokens, auto-open token manager
  useEffect(() => {
    if (formData.type === 'named' && tokens.length === 0) {
      setTokenDialogOpen(true)
    }
  }, [formData.type, tokens.length])

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateTunnelRequest, string>> = {}
    if (!formData.localPort || formData.localPort < 1 || formData.localPort > 65535) newErrors.localPort = 'Port must be between 1 and 65535'
    if (formData.type === 'named') {
      if (!formData.name?.trim()) newErrors.name = 'Tunnel name is required for named tunnels'
      if (!formData.token?.trim()) newErrors.token = 'Token is required for named tunnels'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      try { if (typeof window !== 'undefined') window.localStorage.setItem('KIRO_LAST_TUNNEL_PORT', String(formData.localPort)) } catch {}
      onCreateTunnel(formData)
    }
  }

  const handleInputChange = (field: keyof CreateTunnelRequest, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" strokeWidth={2.5} />
            Create New Tunnel
          </CardTitle>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={showInfo ? 'Hide info' : 'Show info'}
            onClick={() => setShowInfo(v => !v)}
            title={showInfo ? 'Hide info' : 'How it works'}
          >
            <Info className="w-4 h-4" />
          </Button>
        </div>
        <CardDescription>Expose a local port securely over Cloudflare.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <Label className="mr-4">Tunnel Type</Label>
            <div className="inline-flex items-center bg-muted/40 border border-border rounded-md overflow-hidden neo:rounded-none neo:border-[3px]">
              <button
                type="button"
                onClick={() => handleInputChange('type', 'quick')}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors',
                  formData.type === 'quick' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                )}
                aria-pressed={formData.type === 'quick'}
              >
                Quick
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('type', 'named')}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors border-l border-border',
                  formData.type === 'named' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                )}
                aria-pressed={formData.type === 'named'}
              >
                Named
              </button>
            </div>
            <div className="text-xs text-muted-foreground">
              {formData.type === 'quick'
                ? 'Temporary sharable URL that stops when you stop it.'
                : 'Persistent tunnel using your token.'}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="localPort">Local Port</Label>
            <Input
              id="localPort"
              type="number"
              inputMode="numeric"
              value={formData.localPort}
              onChange={(e) => handleInputChange('localPort', parseInt(e.target.value) || 0)}
              placeholder="3000"
              min={1}
              max={65535}
              aria-invalid={!!errors.localPort}
              aria-describedby={errors.localPort ? 'localPort-error' : undefined}
              disabled={disabled}
            />
            {errors.localPort && (
              <p id="localPort-error" className="text-sm text-red-600">{errors.localPort}</p>
            )}
          </div>

          {formData.type === 'named' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Tunnel Name</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="my-tunnel"
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="token">Tunnel Token</Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setTokenDialogOpen(true)}>
                      {tokens.length > 0 ? `Use Saved (${tokens.length})` : 'Add Token'}
                    </Button>
                  </div>
                </div>
                <textarea
                  id="token"
                  value={formData.token || ''}
                  onChange={(e) => handleInputChange('token', e.target.value)}
                  className={cn('min-h-[100px] w-full rounded-md border border-gray-300 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', 'neo:rounded-none neo:border-[3px] neo:border-border neo:focus-visible:ring-0 neo:focus-visible:outline-4 neo:focus-visible:outline-black')}
                  placeholder="eyJhbGciOi..."
                  aria-invalid={!!errors.token}
                />
                {errors.token && <p className="text-sm text-red-600">{errors.token}</p>}
              </div>
            </div>
          )}

          <TokenManagerDialog
            open={tokenDialogOpen}
            onClose={() => setTokenDialogOpen(false)}
            onSelectToken={(t) => {
              setFormData(prev => ({ ...prev, token: t.value }))
              setTokenDialogOpen(false)
            }}
          />

          <CardFooter className="p-0 hidden sm:flex justify-end">
            <Button
              type="submit"
              disabled={disabled || loading}
              aria-label="Create Tunnel"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" strokeWidth={2.5} />
                  Create Tunnel
                </>
              )}
            </Button>
          </CardFooter>

          <div className="sm:hidden">
            <div className="fixed inset-x-0 bottom-4 px-4 pointer-events-none">
              <Button
                type="submit"
                size="lg"
                className="pointer-events-auto w-full"
                disabled={disabled || loading}
                aria-label="Create Tunnel"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" strokeWidth={2.5} />
                    Create Tunnel
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {showInfo && (
          <Alert variant="info" className="mt-6">
            <AlertTitle className="flex items-center gap-2"><Info className="w-4 h-4" strokeWidth={2.5} /> How it works</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>Quick Tunnel</strong> creates a temporary tunnel that expires when stopped.</li>
                <li><strong>Named Tunnel</strong> uses a pre-configured tunnel with a token for persistent access.</li>
                <li>The tunnel exposes your local app running on the specified port.</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
