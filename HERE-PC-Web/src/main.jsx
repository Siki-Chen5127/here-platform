import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWorkspace from './AppWorkspace.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWorkspace />
  </StrictMode>,
)
