import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWebSocket } from '../../components/WebSocketProvider'

export interface TunnelToken {
  id: string
  label: string
  value: string
  createdAt: string
}

export function useTunnelTokens() {
  const [tokens, setTokens] = useState<TunnelToken[]>([])
  const { isConnected, sendRpc } = useWebSocket()
  const loadedOnceRef = useRef(false)

  useEffect(() => {
    if (!isConnected || loadedOnceRef.current) return
    let mounted = true
    ;(async () => {
      try {
        const res = await sendRpc('tunnels', 'tokens.list')
        const arr = res?.data || res
        if (mounted && Array.isArray(arr)) {
          setTokens(arr)
          loadedOnceRef.current = true
        }
      } catch (e: any) {
        // Suppress noisy toast during initial connection; log to console for debugging
        try { console.warn('Load tokens failed:', e?.message || e) } catch {}
      }
    })()
    return () => { mounted = false }
  }, [isConnected, sendRpc])

  const addToken = useCallback(async (label: string, value: string) => {
    if (!isConnected) throw new Error('WebSocket not connected')
    const res = await sendRpc('tunnels', 'tokens.add', { label, value })
    const t = res?.data || res
    if (t?.id) setTokens(prev => [t, ...prev])
    return t as TunnelToken
  }, [isConnected, sendRpc])

  const removeToken = useCallback(async (id: string) => {
    if (!isConnected) throw new Error('WebSocket not connected')
    await sendRpc('tunnels', 'tokens.remove', { id })
    setTokens(prev => prev.filter(t => t.id !== id))
  }, [isConnected, sendRpc])

  const updateToken = useCallback(async (id: string, patch: Partial<Pick<TunnelToken, 'label' | 'value'>>) => {
    if (!isConnected) throw new Error('WebSocket not connected')
    const res = await sendRpc('tunnels', 'tokens.update', { id, ...patch })
    const t = res?.data || res
    if (t?.id) setTokens(prev => prev.map(x => x.id === t.id ? t : x))
    return t as TunnelToken
  }, [isConnected, sendRpc])

  const byId = useCallback((id: string | undefined | null) => tokens.find(t => t.id === id) || null, [tokens])

  const options = useMemo(() => tokens.map(t => ({ id: t.id, label: t.label })), [tokens])

  return { tokens, addToken, removeToken, updateToken, byId, options }
}
