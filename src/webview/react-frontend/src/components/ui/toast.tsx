import * as React from 'react'

type Toast = { id: string; title?: string; description?: string; variant?: 'default' | 'success' | 'destructive' | 'info' }

const ToastContext = React.createContext<{ toasts: Toast[]; show: (t: Omit<Toast,'id'>) => void; remove: (id: string) => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const show = (t: Omit<Toast,'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const toast: Toast = { id, ...t }
    setToasts(prev => [...prev, toast])
    setTimeout(() => remove(id), 4500)
  }
  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toasts, show, remove }}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function Toaster() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) return null
  const color = (v?: Toast['variant']) => v === 'success' ? 'bg-green-600' : v === 'destructive' ? 'bg-red-600' : v === 'info' ? 'bg-blue-600' : 'bg-gray-800'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex w-full justify-center px-4">
      <div className="flex w-full max-w-md flex-col gap-2">
        {ctx.toasts.map(t => (
          <div key={t.id} className="pointer-events-auto overflow-hidden rounded-md shadow-lg">
            <div className={`flex items-start gap-3 p-3 text-white ${color(t.variant)}`}>
              <div className="font-medium">{t.title || ''}</div>
              <div className="text-sm opacity-90">{t.description || ''}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

