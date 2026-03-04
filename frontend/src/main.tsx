import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssVarsProvider, CssBaseline } from '@mui/joy'
import theme from './theme'
import App from './App.js'
import './App.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CssVarsProvider theme={theme}>
      <CssBaseline />
      <App />
    </CssVarsProvider>
  </StrictMode>,
)
