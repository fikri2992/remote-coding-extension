import * as React from 'react'

type Serializer<T> = (value: T) => string
type Deserializer<T> = (raw: string) => T

const defaultSerialize = <T,>(v: T) => {
  try { return JSON.stringify(v) } catch { return '' }
}

const defaultDeserialize = <T,>(raw: string) => {
  try { return JSON.parse(raw) as T } catch { return undefined as unknown as T }
}

export function usePersistentState<T>(key: string, initial: T, opts?: {
  version?: string
  serialize?: Serializer<T>
  deserialize?: Deserializer<T>
}): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { version = 'v1', serialize = defaultSerialize, deserialize = defaultDeserialize } = opts || {}
  const storageKey = React.useMemo(() => `kiro:codeviewer:${version}:${key}`, [key, version])

  const read = React.useCallback((): T => {
    if (typeof window === 'undefined') return initial
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return initial
      const v = deserialize(raw)
      return (v as T) ?? initial
    } catch {
      return initial
    }
  }, [deserialize, initial, storageKey])

  const [state, setState] = React.useState<T>(read)

  React.useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, serialize(state))
    } catch { /* ignore quota errors */ }
  }, [serialize, state, storageKey])

  return [state, setState]
}

