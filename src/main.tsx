import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { KeybindingsProvider } from './hooks/useKeybindings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KeybindingsProvider>
      <App />
    </KeybindingsProvider>
  </StrictMode>,
)
