import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, db, secondaryAuth } from './firebase'
import type { Usuario } from '../types'

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function gerarUsuarioPlaceholderId(email: string): string {
  return `pending_${encodeURIComponent(normalizarEmail(email))}`
}

export async function buscarUsuarioPorEmail(email: string): Promise<Usuario | null> {
  const emailNormalizado = normalizarEmail(email)
  const snapshot = await getDocs(
    query(collection(db, 'usuarios'), where('email', '==', emailNormalizado), limit(1)),
  )
  if (snapshot.empty) return null

  const documento = snapshot.docs[0]
  return { uid: documento.id, ...documento.data() } as Usuario
}

export async function reconciliarUsuarioAutenticado(params: {
  uid: string
  email: string
  nome?: string | null
}): Promise<Usuario | null> {
  const email = normalizarEmail(params.email)
  const perfilAtualRef = doc(db, 'usuarios', params.uid)
  const perfilAtualSnap = await getDoc(perfilAtualRef)

  if (perfilAtualSnap.exists()) {
    return { uid: perfilAtualSnap.id, ...perfilAtualSnap.data() } as Usuario
  }

  const snapshot = await getDocs(
    query(collection(db, 'usuarios'), where('email', '==', email), limit(10)),
  )

  if (snapshot.empty) return null

  const candidatos = snapshot.docs.map((documento) => ({
    uid: documento.id,
    ...(documento.data() as Omit<Usuario, 'uid'>),
  })) as Usuario[]

  const cadastro =
    candidatos.find((item) => item.uid === params.uid) ??
    candidatos.find((item) => item.primeiroAcesso || item.uid.startsWith('pending_')) ??
    (candidatos.length === 1 ? candidatos[0] : null)

  if (!cadastro) return null

  const { uid: cadastroUid, ...dadosCadastro } = cadastro
  const perfilReconciliado: Omit<Usuario, 'uid'> = {
    ...dadosCadastro,
    nome: params.nome?.trim() || cadastro.nome,
    email,
    primeiroAcesso: false,
    atualizadoEm: Timestamp.now(),
  }

  await setDoc(perfilAtualRef, perfilReconciliado, { merge: true })

  if (cadastroUid !== params.uid) {
    await deleteDoc(doc(db, 'usuarios', cadastroUid))
  }

  return { uid: params.uid, ...perfilReconciliado }
}

export async function buscarPrimeiroAcessoPorEmail(email: string): Promise<Usuario | null> {
  const emailNormalizado = normalizarEmail(email)
  const snapshot = await getDocs(
    query(
      collection(db, 'usuarios'),
      where('email', '==', emailNormalizado),
      where('primeiroAcesso', '==', true),
      limit(1),
    ),
  )
  if (snapshot.empty) return null

  const documento = snapshot.docs[0]
  return { uid: documento.id, ...documento.data() } as Usuario
}

export async function concluirPrimeiroAcesso(params: {
  email: string
  senha: string
}) {
  const email = normalizarEmail(params.email)
  const cadastro = await buscarPrimeiroAcessoPorEmail(email)

  if (!cadastro) {
    throw new Error('usuario-nao-encontrado')
  }
  if (!cadastro.primeiroAcesso) {
    throw new Error('primeiro-acesso-invalido')
  }
  if (cadastro.ativo === false) {
    throw new Error('usuario-inativo')
  }

  const { uid: _placeholderId, ...dadosCadastro } = cadastro
  const persistirCadastro = async (uid: string) => {
    await setDoc(doc(db, 'usuarios', uid), {
      ...dadosCadastro,
      nome: cadastro.nome,
      email,
      primeiroAcesso: false,
      atualizadoEm: Timestamp.now(),
    })
  }

  let uid = ''

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, params.senha)
    uid = cred.user.uid
    await updateProfile(cred.user, { displayName: cadastro.nome })
    await persistirCadastro(uid)
    await deleteDoc(doc(db, 'usuarios', cadastro.uid))
  } catch (err: any) {
    if (err?.code !== 'auth/email-already-in-use') {
      throw err
    }

    try {
      const credExistente = await signInWithEmailAndPassword(secondaryAuth, email, params.senha)
      uid = credExistente.user.uid

      const docExistente = await getDoc(doc(db, 'usuarios', uid))
      if (!docExistente.exists()) {
        await updateProfile(credExistente.user, { displayName: cadastro.nome })
        await persistirCadastro(uid)
      }

      await deleteDoc(doc(db, 'usuarios', cadastro.uid))
    } catch (reconciliacaoErro: any) {
      if (
        reconciliacaoErro?.code === 'auth/invalid-credential' ||
        reconciliacaoErro?.code === 'auth/wrong-password' ||
        reconciliacaoErro?.code === 'auth/invalid-login-credentials'
      ) {
        await sendPasswordResetEmail(auth, email)
        throw new Error('primeiro-acesso-email-ja-ativado')
      }
      throw reconciliacaoErro
    }
  }

  await signOut(secondaryAuth)
  await signInWithEmailAndPassword(auth, email, params.senha)

  return uid
}
