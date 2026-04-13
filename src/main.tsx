// ──────────────────────────────────────────────────────────
//  main.tsx — entrada da aplicação
//  AuthProvider montado UMA vez aqui (CORREÇÃO DO BUG)
// ──────────────────────────────────────────────────────────

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { verificarEstruturaFirestore } from './lib/firestoreCheck'
import App from './App'
import './styles/globals.css'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root não encontrado no HTML.')

if (import.meta.env.DEV) {
  void verificarEstruturaFirestore()
}

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)
