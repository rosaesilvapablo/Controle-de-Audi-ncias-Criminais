// ──────────────────────────────────────────────────────────
//  AuthContext — CORRIGIDO
//  Bugs resolvidos:
//  1. Busca usuarios/{firebaseUser.uid} (uid real, não doc aleatório)
//  2. Provider montado UMA vez, apenas em main.tsx
// ──────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { registrarAcao } from '../lib/auditoria'
import { reconciliarUsuarioAutenticado } from '../lib/usuarios'
import type { Usuario } from '../types'

// ── Tipos do contexto ──────────────────────────────────────
interface AuthContextValue {
  firebaseUser: FirebaseUser | null
  usuario: Usuario | null
  contaDesativada: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Hook público ───────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

// ── Provider ───────────────────────────────────────────────
interface AuthProviderProps { children: ReactNode }

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [usuario, setUsuario]           = useState<Usuario | null>(null)
  const [contaDesativada, setContaDesativada] = useState(false)
  const [loading, setLoading]           = useState(true)
  const ultimoLoginRegistradoRef = useRef<string | null>(null)

  // Subscrição ao perfil Firestore em tempo real
  useEffect(() => {
    let unsubProfile: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)

      // Limpar subscrição anterior
      unsubProfile?.()
      unsubProfile = undefined

      if (!fbUser) {
        setUsuario(null)
        setFirebaseUser(null)
        ultimoLoginRegistradoRef.current = null
        setLoading(false)
        return
      }

      // CORREÇÃO: busca pelo uid real do Firebase Auth
      const userDocRef = doc(db, 'usuarios', fbUser.uid)

      // Verificar se documento existe antes de subscrever
      let snap = await getDoc(userDocRef)
      if (!snap.exists() && fbUser.email) {
        await reconciliarUsuarioAutenticado({
          uid: fbUser.uid,
          email: fbUser.email,
          nome: fbUser.displayName,
        })
        snap = await getDoc(userDocRef)
      }

      if (!snap.exists()) {
        // Usuário autenticado mas sem perfil cadastrado
        console.warn(`Perfil não encontrado para uid: ${fbUser.uid}`)
        setUsuario(null)
        await firebaseSignOut(auth)
        setLoading(false)
        return
      }

      // Subscrição em tempo real ao perfil do usuário
      unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const usuarioData = { uid: docSnap.id, ...docSnap.data() } as Usuario

          if (usuarioData.ativo === false) {
            setContaDesativada(true)
            setUsuario(null)
            setFirebaseUser(null)
            setLoading(false)
            unsubProfile?.()
            unsubProfile = undefined
            await firebaseSignOut(auth)
            return
          }

          setContaDesativada(false)
          setUsuario(usuarioData)

          if (ultimoLoginRegistradoRef.current !== usuarioData.uid) {
            ultimoLoginRegistradoRef.current = usuarioData.uid
            await registrarAcao({
              tipo: 'login',
              dados: {},
              usuarioUid: usuarioData.uid,
              usuarioNome: usuarioData.nome,
            })
          }
        } else {
          setUsuario(null)
        }
        setLoading(false)
      })
    })

    return () => {
      unsubAuth()
      unsubProfile?.()
    }
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setContaDesativada(false)
      await signInWithEmailAndPassword(auth, email, password)
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (usuario) {
      await registrarAcao({
        tipo: 'logout',
        dados: {},
        usuarioUid: usuario.uid,
        usuarioNome: usuario.nome,
      })
    }

    setContaDesativada(false)
    ultimoLoginRegistradoRef.current = null
    await firebaseSignOut(auth)
  }, [usuario])

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }, [])

  return (
    <AuthContext.Provider
      value={{ firebaseUser, usuario, contaDesativada, loading, signIn, signOut, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}
