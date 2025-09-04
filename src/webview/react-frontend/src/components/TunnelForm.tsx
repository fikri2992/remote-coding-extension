import React, { useState } from 'react'
import { CreateTunnelRequest } from '../types/tunnel'
import { Play, Loader2, Info } from 'lucide-react'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'

interface TunnelFormProps {
  onCreateTunnel: (request: CreateTunnelRequest) => void
  loading?: boolean
  disabled?: boolean
}

export const TunnelForm: React.FC<TunnelFormProps> = ({ onCreateTunnel, loading = false, disabled = false }) => {
  const [formData, setFormData] = useState<CreateTunnelRequest>({ localPort: 3000, type: 'quick', name: '', token: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof CreateTunnelRequest, string>>>({})

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
    if (validateForm()) onCreateTunnel(formData)
  }

  const handleInputChange = (field: keyof CreateTunnelRequest, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5 text-blue-600" />
          Create New Tunnel
        </CardTitle>
        <CardDescription>Expose a local port securely over Cloudflare.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Tunnel Type</Label>
            <div className="flex flex-wrap gap-2">
              <RadioGroup value={formData.type} onChange={(v) => handleInputChange('type', v as 'quick' | 'named')}>
                <RadioGroupItem value="quick">Quick Tunnel</RadioGroupItem>
                <RadioGroupItem value="named">Named Tunnel</RadioGroupItem>
              </RadioGroup>
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
                <Label htmlFor="token">Tunnel Token</Label>
                <textarea
                  id="token"
                  value={formData.token || ''}
                  onChange={(e) => handleInputChange('token', e.target.value)}
                  className={cn('min-h-[100px] w-full rounded-md border border-gray-300 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500')}
                  placeholder="eyJhbGciOi..."
                  aria-invalid={!!errors.token}
                />
                {errors.token && <p className="text-sm text-red-600">{errors.token}</p>}
              </div>
            </div>
          )}

          <CardFooter className="p-0 flex justify-end">
            <button
              type="submit"
              disabled={disabled || loading}
              className={cn(
                'inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700',
                disabled || loading ? 'opacity-60 cursor-not-allowed hover:bg-blue-600' : ''
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Create Tunnel
                </>
              )}
            </button>
          </CardFooter>
        </form>

        <Alert variant="info" className="mt-6">
          <AlertTitle className="flex items-center gap-2"><Info className="w-4 h-4" /> How it works</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Quick Tunnel</strong> creates a temporary tunnel that expires when stopped.</li>
              <li><strong>Named Tunnel</strong> uses a pre-configured tunnel with a token for persistent access.</li>
              <li>The tunnel exposes your local app running on the specified port.</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

