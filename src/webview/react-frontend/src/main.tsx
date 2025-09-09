import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { ThemeProvider } from './components/theme/ThemeProvider'
import { ToastProvider } from './components/ui/toast'
import { WebSocketProvider } from './components/WebSocketProvider'
import { FileCacheProvider } from './contexts/FileCacheContext'
import { ViewStateProvider } from './contexts/ViewStateContext'
import { PendingNavProvider } from './contexts/PendingNavContext'
import { LiveRegionProvider } from './contexts/LiveRegionContext'
import { ReducedMotionProvider } from './contexts/ReducedMotionContext'
import './index.css'

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <ToastProvider>
          <WebSocketProvider>
            <FileCacheProvider>
              <ReducedMotionProvider>
                <PendingNavProvider>
                  <LiveRegionProvider>
                    <ViewStateProvider>
                      <RouterProvider router={router} />
                    </ViewStateProvider>
                  </LiveRegionProvider>
                </PendingNavProvider>
              </ReducedMotionProvider>
            </FileCacheProvider>
          </WebSocketProvider>
        </ToastProvider>
      </ThemeProvider>
    </React.StrictMode>,
  )
}
