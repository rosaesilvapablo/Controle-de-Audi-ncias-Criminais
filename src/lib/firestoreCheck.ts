import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from './firebase'

let verificacaoExecutada = false

type ResultadoLinha = {
  mensagem: string
}

const COLECOES = [
  'usuarios',
  'audiencias',
  'procedimentos',
  'procedimento_itens',
  'procedimento_participantes',
  'procedimento_documentos',
  'salas',
  'feriados',
  'disponibilidades',
  'audit_logs',
] as const

export async function verificarEstruturaFirestore() {
  if (verificacaoExecutada) return
  verificacaoExecutada = true

  const relatorio: ResultadoLinha[] = []

  for (const nomeColecao of COLECOES) {
    try {
      const snapshot = await getDocs(collection(db, nomeColecao))
      const quantidade = snapshot.size

      if (quantidade > 0) {
        relatorio.push({
          mensagem: `[SCAC] ✅ ${nomeColecao} — ok (${quantidade} docs)`,
        })
      } else {
        const alerta =
          nomeColecao === 'disponibilidades'
            ? 'vazia (agendamento pode falhar)'
            : 'vazia'

        relatorio.push({
          mensagem: `[SCAC] ⚠️  ${nomeColecao} — ${alerta}`,
        })
      }

      if (nomeColecao === 'usuarios') {
        const existeDiretor = snapshot.docs.some((item) => item.data()?.perfil === 'diretor')

        if (existeDiretor) {
          relatorio.push({
            mensagem: '[SCAC] ✅ usuarios/diretor — ok (ao menos 1 diretor encontrado)',
          })
        } else {
          relatorio.push({
            mensagem: '[SCAC] ❌ usuarios/diretor — nenhum usuário com perfil diretor encontrado',
          })
        }
      }
    } catch (error) {
      relatorio.push({
        mensagem: `[SCAC] ❌ ${nomeColecao} — erro ao consultar`,
      })
      console.error(`[SCAC] Erro ao verificar ${nomeColecao}:`, error)
    }
  }

  try {
    const configuracoesSnap = await getDoc(doc(db, 'configuracoes', 'sistema'))

    if (!configuracoesSnap.exists()) {
      relatorio.push({
        mensagem: '[SCAC] ❌ configuracoes/sistema — não encontrado',
      })
    } else {
      const dados = configuracoesSnap.data()
      const camposObrigatorios = [
        'nomeVara',
        'horarioInicioPauta',
        'horarioFimPauta',
        'diasSemanaAtivos',
      ]
      const camposFaltantes = camposObrigatorios.filter((campo) => !(campo in dados))

      if (camposFaltantes.length === 0) {
        relatorio.push({
          mensagem: '[SCAC] ✅ configuracoes/sistema — ok',
        })
      } else {
        relatorio.push({
          mensagem: `[SCAC] ⚠️  configuracoes/sistema — incompleto (faltando: ${camposFaltantes.join(', ')})`,
        })
      }
    }
  } catch (error) {
    relatorio.push({
      mensagem: '[SCAC] ❌ configuracoes/sistema — erro ao consultar',
    })
    console.error('[SCAC] Erro ao verificar configuracoes/sistema:', error)
  }

  console.groupCollapsed('[SCAC] Relatório de estrutura do Firestore')
  for (const linha of relatorio) {
    console.log(linha.mensagem)
  }
  console.groupEnd()
}
