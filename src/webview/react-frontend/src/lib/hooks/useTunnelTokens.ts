import { useCallback, useEffect, useMemo, useState } from 'react'

export interface TunnelToken {
  id: string
  label: string
  value: string
  createdAt: string
}

const STORAGE_KEY = 'KIRO_TUNNEL_TOKENS'

function loadTokens(): TunnelToken[] {
  try {
    const raw = (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)) || '[]'
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.filter(Boolean)
  } catch {}
  return []
}

function saveTokens(tokens: TunnelToken[]) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {}
}

export function useTunnelTokens() {
  const [tokens, setTokens] = useState<TunnelToken[]>(() => loadTokens())

  useEffect(() => {
    saveTokens(tokens)
  }, [tokens])

  const addToken = useCallback((label: string, value: string) => {
    const id = `tok_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    const t: TunnelToken = { id, label: label.trim() || 'Token', value: value.trim(), createdAt: new Date().toISOString() }
    setTokens(prev => [t, ...prev])
    return t
  }, [])

  const removeToken = useCallback((id: string) => {
    setTokens(prev => prev.filter(t => t.id !== id))
  }, [])

  const updateToken = useCallback((id: string, patch: Partial<Pick<TunnelToken, 'label' | 'value'>>) => {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  const byId = useCallback((id: string | undefined | null) => tokens.find(t => t.id === id) || null, [tokens])

  const options = useMemo(() => tokens.map(t => ({ id: t.id, label: t.label })), [tokens])

  return { tokens, addToken, removeToken, updateToken, byId, options }
}
