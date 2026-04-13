import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, ShieldCheck, UserX, Users } from 'lucide-react'
import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCriarUsuario, useEditarUsuario, useUsuarios } from '../../hooks'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageLoader,
  Select,
  StatCard,
} from '../../components/ui'
import type { UserRole, Usuario } from '../../types'

const ROLE_LABELS: Record<UserRole, string> = {
  diretor: 'Diretor',
  magistrado: 'Magistrado',
  supervisor: 'Supervisor',
  servidor: 'Servidor',
  estagiario: 'Estagiario',
  convidado: 'Convidado',
}

const ROLE_OPTIONS = [
  'diretor',
  'magistrado',
  'supervisor',
  'servidor',
  'estagiario',
  'convidado',
] as const

const schemaNovo = z.object({
  nome: z.string().min(3, 'Nome obrigatorio'),
  email: z.string().email('E-mail invalido'),
  perfil: z.enum(ROLE_OPTIONS),
})

const schemaEditar = z.object({
  nome: z.string().min(3),
  perfil: z.enum(ROLE_OPTIONS),
  ativo: z.boolean(),
})

type FormNovo = z.infer<typeof schemaNovo>
type FormEditar = z.infer<typeof schemaEditar>

export default function Usuarios() {
  const { usuario: me } = useAuth()
  const toast = useToast()
  const { usuarios, loading } = useUsuarios()
  const { criar, salvando } = useCriarUsuario()
  const { editar } = useEditarUsuario()

  const [modalNovo, setModalNovo] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [confirmarExcluir, setConfirmarExcluir] = useState<Usuario | null>(null)
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null)

  const formNovo = useForm<FormNovo>({
    resolver: zodResolver(schemaNovo),
    defaultValues: { perfil: 'supervisor' },
  })

  const formEditar = useForm<FormEditar>({
    resolver: zodResolver(schemaEditar),
  })

  const onCriar = async (data: FormNovo) => {
    const uid = await criar(data)
    if (uid) {
      formNovo.reset({ perfil: 'supervisor' })
      setModalNovo(false)
    }
  }

  const abrirEditar = (alvo: Usuario) => {
    setEditandoUsuario(alvo)
    formEditar.reset({ nome: alvo.nome, perfil: alvo.perfil, ativo: alvo.ativo })
    setModalEditar(true)
  }

  const onEditar = async (data: FormEditar) => {
    if (!editandoUsuario) return
    await editar(editandoUsuario.uid, data)
    setModalEditar(false)
    setEditandoUsuario(null)
  }

  const onExcluir = async () => {
    if (!confirmarExcluir) return
    try {
      await updateDoc(doc(db, 'usuarios', confirmarExcluir.uid), {
        ativo: false,
        atualizadoEm: Timestamp.now(),
      })
      toast.success('Cadastro desativado com sucesso.')
    } catch {
      toast.error('Nao foi possivel desativar o usuario. Tente novamente.')
    } finally {
      setConfirmarExcluir(null)
    }
  }

  const onReativar = async (alvo: Usuario) => {
    try {
      await updateDoc(doc(db, 'usuarios', alvo.uid), {
        ativo: true,
        atualizadoEm: Timestamp.now(),
      })
      toast.success('Cadastro reativado com sucesso.')
    } catch {
      toast.error('Nao foi possivel reativar o usuario. Tente novamente.')
    }
  }

  const usuariosAtivos = usuarios.filter((item) => item.ativo)
  const usuariosInativos = usuarios.filter((item) => !item.ativo)
  const usuariosVisiveis = mostrarInativos ? usuarios : usuariosAtivos

  const stats = {
    total: usuarios.length,
    ativos: usuariosAtivos.length,
    inativos: usuariosInativos.length,
    magistrados: usuariosAtivos.filter((item) => item.perfil === 'magistrado').length,
    diretores: usuariosAtivos.filter((item) => item.perfil === 'diretor').length,
  }

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl border border-aurora-border-light bg-[linear-gradient(135deg,#ffffff_0%,#f5f9ff_100%)] px-5 py-5 shadow-aurora-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-aurora-primary">
              Administracao de acesso
            </div>
            <h1 className="text-2xl font-semibold text-aurora-text-primary">Usuarios</h1>
            <p className="mt-1 text-sm text-aurora-text-muted">
              Cadastre, desative e revise perfis sem deixar usuarios de teste misturados na listagem principal.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={mostrarInativos ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setMostrarInativos((valor) => !valor)}
            >
              {mostrarInativos ? 'Ocultar inativos' : `Mostrar inativos (${stats.inativos})`}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setModalNovo(true)}
            >
              Novo usuario
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Total" value={stats.total} color="primary" />
        <StatCard label="Ativos" value={stats.ativos} color="green" />
        <StatCard label="Inativos" value={stats.inativos} color="red" />
        <StatCard label="Magistrados" value={stats.magistrados} color="amber" />
        <StatCard label="Diretores" value={stats.diretores} color="primary" />
      </div>

      {usuarios.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title="Nenhum usuario cadastrado"
          description="Cadastre um novo usuario para liberar acesso ao sistema."
        />
      ) : usuariosVisiveis.length === 0 ? (
        <EmptyState
          icon={<UserX size={24} />}
          title="Nenhum usuario ativo para exibir"
          description="Os cadastros desativados ficam ocultos por padrao para manter a tela mais limpa."
          action={(
            <Button size="sm" variant="secondary" onClick={() => setMostrarInativos(true)}>
              Mostrar inativos
            </Button>
          )}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {usuariosVisiveis.map((usuario) => (
            <Card
              key={usuario.uid}
              padding="sm"
              hover
              className={`flex flex-col gap-3 border-l-4 sm:flex-row sm:items-center sm:gap-4 ${
                usuario.ativo
                  ? 'border-l-aurora-primary/70'
                  : 'border-l-aurora-red/50 bg-slate-50/90'
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-aurora-primary/30 bg-aurora-primary-muted">
                <span className="text-xs font-medium text-aurora-primary-light">
                  {usuario.nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-aurora-text-primary">
                    {usuario.nome}
                  </p>
                  {!usuario.ativo && <Badge variant="muted">Inativo</Badge>}
                  {usuario.primeiroAcesso && <Badge variant="primary">Primeiro acesso</Badge>}
                  {usuario.uid === me?.uid && <Badge variant="primary">Voce</Badge>}
                </div>
                <p className="truncate text-xs text-aurora-text-muted">{usuario.email}</p>
              </div>

              <Badge variant={usuario.perfil === 'diretor' ? 'warning' : 'muted'}>
                {usuario.perfil === 'diretor' && <ShieldCheck size={10} />}
                {ROLE_LABELS[usuario.perfil]}
              </Badge>

              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<Pencil size={12} />}
                  onClick={() => abrirEditar(usuario)}
                />

                {usuario.uid !== me?.uid && usuario.ativo && (
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<UserX size={12} />}
                    className="text-aurora-red hover:bg-aurora-red-muted/40"
                    onClick={() => setConfirmarExcluir(usuario)}
                  >
                    Desativar
                  </Button>
                )}

                {usuario.uid !== me?.uid && !usuario.ativo && (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-aurora-primary hover:bg-aurora-primary/10"
                    onClick={() => void onReativar(usuario)}
                  >
                    Reativar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalNovo}
        onClose={() => {
          formNovo.reset({ perfil: 'supervisor' })
          setModalNovo(false)
        }}
        title="Novo usuario"
        size="sm"
        footer={(
          <>
            <Button variant="ghost" size="sm" onClick={() => setModalNovo(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={salvando}
              onClick={formNovo.handleSubmit(onCriar)}
            >
              Cadastrar usuario
            </Button>
          </>
        )}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border border-aurora-primary/20 bg-aurora-primary-muted/30 p-3">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-aurora-primary-light" />
            <p className="text-xs leading-relaxed text-aurora-text-secondary">
              O cadastro fica pendente no SCAC. No primeiro acesso, o proprio usuario
              informara a senha e concluira a ativacao da conta.
            </p>
          </div>

          <Input
            label="Nome completo"
            error={formNovo.formState.errors.nome?.message}
            {...formNovo.register('nome')}
          />
          <Input
            label="E-mail"
            type="email"
            error={formNovo.formState.errors.email?.message}
            {...formNovo.register('email')}
          />
          <Select
            label="Perfil de acesso"
            error={formNovo.formState.errors.perfil?.message}
            {...formNovo.register('perfil')}
          >
            {Object.entries(ROLE_LABELS).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        open={modalEditar}
        onClose={() => setModalEditar(false)}
        title={`Editar usuario: ${editandoUsuario?.nome}`}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" size="sm" onClick={() => setModalEditar(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={formEditar.handleSubmit(onEditar)}>
              Salvar alteracoes
            </Button>
          </>
        )}
      >
        <div className="flex flex-col gap-3">
          <Input label="Nome completo" {...formEditar.register('nome')} />
          <Select label="Perfil de acesso" {...formEditar.register('perfil')}>
            {Object.entries(ROLE_LABELS).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </Select>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-aurora-primary"
              {...formEditar.register('ativo')}
            />
            <span className="text-sm text-aurora-text-secondary">Usuario ativo</span>
          </label>
        </div>
      </Modal>

      <Modal
        open={!!confirmarExcluir}
        onClose={() => setConfirmarExcluir(null)}
        title="Desativar usuario"
        size="sm"
        footer={(
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmarExcluir(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={onExcluir}>
              Confirmar desativacao
            </Button>
          </>
        )}
      >
        <p className="text-sm text-aurora-text-secondary">
          Tem certeza que deseja desativar{' '}
          <strong className="text-aurora-text-primary">{confirmarExcluir?.nome}</strong>?
          O acesso ao sistema sera bloqueado.
        </p>
      </Modal>
    </div>
  )
}
