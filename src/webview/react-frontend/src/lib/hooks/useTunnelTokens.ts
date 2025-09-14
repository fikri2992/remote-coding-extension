import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWebSocket } from '../../components/WebSocketProvider'
import { useToast } from '../../components/ui/toast'

export interface TunnelToken {
  id: string
  label: string
  value: string
  createdAt: string
}

export function useTunnelTokens() {
  const [tokens, setTokens] = useState<TunnelToken[]>([])
  const ws = useWebSocket()
  const { show } = useToast()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!ws) throw new Error('WebSocket not connected')
        const res = await ws.sendRpc('tunnels', 'tokens.list')
        const arr = res?.data || res
        if (mounted && Array.isArray(arr)) setTokens(arr)
      } catch (e: any) {
        show({ variant: 'destructive', title: 'Load tokens failed', description: e?.message })
      }
    })()
    return () => { mounted = false }
  }, [ws])

  const addToken = useCallback(async (label: string, value: string) => {
    if (!ws) throw new Error('WebSocket not connected')
    const res = await ws.sendRpc('tunnels', 'tokens.add', { label, value })
    const t = res?.data || res
    if (t?.id) setTokens(prev => [t, ...prev])
    return t as TunnelToken
  }, [ws])

  const removeToken = useCallback(async (id: string) => {
    if (!ws) throw new Error('WebSocket not connected')
    await ws.sendRpc('tunnels', 'tokens.remove', { id })
    setTokens(prev => prev.filter(t => t.id !== id))
  }, [ws])

  const updateToken = useCallback(async (id: string, patch: Partial<Pick<TunnelToken, 'label' | 'value'>>) => {
    if (!ws) throw new Error('WebSocket not connected')
    const res = await ws.sendRpc('tunnels', 'tokens.update', { id, ...patch })
    const t = res?.data || res
    if (t?.id) setTokens(prev => prev.map(x => x.id === t.id ? t : x))
    return t as TunnelToken
  }, [ws])

  const byId = useCallback((id: string | undefined | null) => tokens.find(t => t.id === id) || null, [tokens])

  const options = useMemo(() => tokens.map(t => ({ id: t.id, label: t.label })), [tokens])

  return { tokens, addToken, removeToken, updateToken, byId, options }
}
