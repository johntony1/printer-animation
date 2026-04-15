import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { PrinterAnimation } from './PrinterAnimation'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrinterAnimation />
  </StrictMode>,
)
