import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const DEFAULT_API_ORIGIN = 'https://courteous-beauty-production.up.railway.app'

const API_ORIGIN =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? DEFAULT_API_ORIGIN : '')

if (typeof document !== 'undefined') {
  document.title = 'Enterprise GRC Tool'
}

if (typeof window !== 'undefined' && API_ORIGIN) {
  const originalFetch = window.fetch.bind(window)
  const localApiPrefix = `${window.location.origin}/api/`

  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return originalFetch(`${API_ORIGIN}${input}`, init)
    }

    if (typeof input === 'string' && input.startsWith(localApiPrefix)) {
      return originalFetch(`${API_ORIGIN}${input.slice(window.location.origin.length)}`, init)
    }

    if (input instanceof Request && input.url.startsWith(`${window.location.origin}/api/`)) {
      const url = new URL(input.url)
      return originalFetch(new Request(`${API_ORIGIN}${url.pathname}${url.search}`, input), init)
    }

    return originalFetch(input, init)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
