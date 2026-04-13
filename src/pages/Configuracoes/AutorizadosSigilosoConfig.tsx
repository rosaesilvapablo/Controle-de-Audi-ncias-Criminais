import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useAutorizadosSigiloso, useUsuarios } from '../../hooks'
import { Badge, Button, Card, PageLoader } from '../../components/ui'
import { isAdmin } from '../../types'

const PERFIL_LABELS: Record<string, string> = {
  diretor: 'Diretor',
  supervisor: 'Supervisor',
  servidor: 'Servidor',
  estagiario: 'Estagiario',
  convidado: 'Convidado',
}

export default function AutorizadosSigilosoConfig() {
  const { usuario } = useAuth()
  const toast = useToast()
  const { usuarios, loading: loadingUsuarios } = useUsuarios()
  const {
    uids,
    loading: loadingAutorizados,
    salvando,
    salvarAutorizados,
  } = useAutorizadosSigiloso()
  const [selecionados, setSelecionados] = useState<string[]>([])

  useEffect(() => {
    setSelecionados(uids)
  }, [uids])

  const usuariosGerenciaveis = useMemo(() => {
    return usuarios.filter((item) => {
      if (item.perfil === 'magistrado') return false
      if (item.uid === usuario?.uid) return false
      return true
    })
  }, [usuario?.uid, usuarios])

  if (!isAdmin(usuario?.perfil)) return null
  if (loadingUsuarios || loadingAutorizados) return <PageLoader />

  const alternarUsuario = (uid: string) => {
    setSelecionados((atual) =>
      atual.includes(uid)
        ? atual.filter((item) => item !== uid)
        : [...atual, uid],
    )
  }

  const salvar = async () => {
    try {
      await salvarAutorizados(selecionados)
      toast.success('Lista de autorizados atualizada.')
    } catch {
      toast.error('Nao foi possivel salvar a lista de autorizados.')
    }
  }

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-aurora-text-primary">
            Acesso a Processos Sigilosos
          </p>
          <p className="mt-1 text-sm text-aurora-text-muted">
            Magistrados têm acesso por padrão. Defina aqui quais outros usuários podem visualizar processos sigilosos.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          loading={salvando}
          onClick={() => void salvar()}
        >
          Salvar alteracoes
        </Button>
      </div>

      {usuariosGerenciaveis.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-5 text-sm text-aurora-text-muted">
          Nenhum usuário cadastrado além dos magistrados.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {usuariosGerenciaveis.map((item) => {
            const autorizado = selecionados.includes(item.uid)

            return (
              <div
                key={item.uid}
                className="flex items-center justify-between gap-3 rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-3"
              >
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={autorizado}
                    onChange={() => alternarUsuario(item.uid)}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-aurora-text-primary">
                      {item.nome}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="muted">
                        {PERFIL_LABELS[item.perfil] ?? item.perfil}
                      </Badge>
                      {autorizado && (
                        <Badge variant="success">
                          <ShieldCheck size={10} />
                          Autorizado
                        </Badge>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
