/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WS_BASE_URL: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Global error reporter interface
interface ErrorReporter {
  captureException(error: Error, context?: {
    tags?: Record<string, string>
    extra?: Record<string, any>
  }): void
}

// Extend Window interface
declare global {
  interface Window {
    errorReporter?: ErrorReporter
  }
}