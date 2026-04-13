// ──────────────────────────────────────────────────────────
//  Firebase — configuração e inicialização
//  CORREÇÃO: app secundária para criar usuários sem deslogar a sessão principal
// ──────────────────────────────────────────────────────────

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth }     from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// ── App primária (sessão do usuário logado) ────────────────
const app: FirebaseApp =
  getApps().find(a => a.name === '[DEFAULT]') ?? initializeApp(firebaseConfig)

// ── App secundária (exclusiva para criação de usuários) ────
// Permite criar contas sem deslogar a sessão atual.
const SECONDARY_APP_NAME = 'scac-secondary'
const secondaryApp: FirebaseApp =
  getApps().find(a => a.name === SECONDARY_APP_NAME) ??
  initializeApp(firebaseConfig, SECONDARY_APP_NAME)

// ── Exports ────────────────────────────────────────────────
export const auth: Auth              = getAuth(app)
export const secondaryAuth: Auth     = getAuth(secondaryApp)
export const db: Firestore           = getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)

export default app
