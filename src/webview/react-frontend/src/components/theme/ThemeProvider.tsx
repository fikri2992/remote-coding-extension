import * as React from 'react'

type Theme = 'light' | 'dark'

type NeoState = boolean

interface ThemeContextType {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
  neo: NeoState
  setNeo: (n: NeoState) => void
  toggleNeo: () => void
}

const ThemeContext = React.createContext<ThemeContextType | null>(null)

const STORAGE_KEY = 'kiro-theme'
const STORAGE_KEY_NEO = 'kiro-neo'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {}
  // System preference fallback
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }
  return 'light'
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

function getInitialNeo(): NeoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_NEO)
    if (stored === '1') return true
    if (stored === '0') return false
  } catch {}
  return false
}

function applyNeoClass(neo: NeoState) {
  const root = document.documentElement
  if (neo) root.classList.add('neo')
  else root.classList.remove('neo')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => getInitialTheme())
  const [neo, setNeoState] = React.useState<NeoState>(() => getInitialNeo())

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch {}
    applyThemeClass(t)
  }
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const setNeo = (n: NeoState) => {
    setNeoState(n)
    try { localStorage.setItem(STORAGE_KEY_NEO, n ? '1' : '0') } catch {}
    applyNeoClass(n)
  }
  const toggleNeo = () => setNeo(!neo)

  React.useEffect(() => {
    applyThemeClass(theme)
    applyNeoClass(neo)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, neo, setNeo, toggleNeo }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
