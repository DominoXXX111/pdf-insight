import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, storedTheme } from './lib/theme'

// Motyw wybrany wczesniej - przed pierwszym renderem, zeby strona nie mignela innym kolorem.
applyTheme(storedTheme())

const root = document.getElementById('root')
if (!root) throw new Error('Brak elementu #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
