import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DoorOpen, Plus, Pencil, Trash2, Check, X as XIcon } from 'lucide-react'
import { addDoc, collection, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useSalas } from '../../hooks/index'
import { useToast } from '../../contexts/ToastContext'
import { temPermissao } from '../../lib/permissoes'
import { Button, Badge, Card, Modal, Input, Textarea, StatCard, PageLoader, EmptyState } from '../../components/ui'
import type { Sala } from '../../types'

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  capacidade: z.coerce.number().min(1).optional(),
  descricao: z.string().optional(),
  ativa: z.boolean(),
})
type Form = z.infer<typeof schema>

export default function Salas() {
  const { usuario } = useAuth()
  const toast = useToast()
  const { salas, loading } = useSalas()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Sala | null>(null)
  const [confirmando, setConfirmando] = useState<Sala | null>(null)
  const [salvando, setSalvando] = useState(false)
  const podeGerenciarSalas = temPermissao(usuario?.perfil, 'gerenciar_salas')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { ativa: true },
  })

  const abrirNova = () => { setEditando(null); reset({ ativa: true }); setModalAberto(true) }

  const abrirEditar = (s: Sala) => {
    setEditando(s)
    reset({ nome: s.nome, capacidade: s.capacidade, descricao: s.descricao, ativa: s.ativa })
    setModalAberto(true)
  }

  const onSubmit = async (data: Form) => {
    setSalvando(true)
    try {
      if (editando) {
        await updateDoc(doc(db, 'salas', editando.id), { ...data, atualizadoEm: Timestamp.now() })
        toast.success('Alterações salvas com sucesso.')
      } else {
        await addDoc(collection(db, 'salas'), { ...data, criadoEm: Timestamp.now() })
        toast.success('Sala cadastrada com sucesso.')
      }
      setModalAberto(false)
      reset()
    } catch {
      toast.error('Não foi possível salvar. Verifique os campos e tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    if (!confirmando) return
    try {
      await deleteDoc(doc(db, 'salas', confirmando.id))
      toast.success('Sala excluída com sucesso.')
    } catch {
      toast.error('Não foi possível excluir. Tente novamente.')
    } finally {
      setConfirmando(null)
    }
  }

  const ativas = salas.filter((s) => s.ativa).length
  const inativas = salas.filter((s) => !s.ativa).length

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-aurora-text-primary">Salas</h1>
          <p className="mt-0.5 text-sm text-aurora-text-muted">Locais disponíveis para audiência</p>
        </div>
        {podeGerenciarSalas && (
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={abrirNova}>
            Nova sala
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total" value={salas.length} color="primary" icon={<DoorOpen size={14} />} />
        <StatCard label="Ativas" value={ativas} color="green" />
        <StatCard label="Inativas" value={inativas} color="red" />
      </div>

      {salas.length === 0 ? (
        <EmptyState
          icon={<DoorOpen size={24} />}
          title="Nenhuma sala cadastrada"
          description="Cadastre uma sala para disponibilizá-la no agendamento de audiências."
          action={podeGerenciarSalas ? <Button variant="primary" size="sm" onClick={abrirNova}>Cadastrar sala</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {salas.map((s) => (
            <Card key={s.id} padding="md" className="flex flex-col gap-3 border-l-4 border-l-aurora-primary/50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.ativa ? 'bg-aurora-green-muted' : 'bg-aurora-elevated'}`}>
                    <DoorOpen size={16} className={s.ativa ? 'text-aurora-green' : 'text-aurora-text-muted'} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-aurora-text-primary">{s.nome}</p>
                    {s.capacidade && <p className="text-2xs text-aurora-text-muted">Capacidade para {s.capacidade} pessoas</p>}
                  </div>
                </div>
                <Badge variant={s.ativa ? 'success' : 'muted'}>
                  {s.ativa ? <Check size={10} /> : <XIcon size={10} />}
                  {s.ativa ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>

              {s.descricao && <p className="text-xs text-aurora-text-muted">{s.descricao}</p>}

              {podeGerenciarSalas && (
                <div className="flex gap-2 border-t border-aurora-border pt-1">
                  <Button size="xs" variant="ghost" icon={<Pencil size={11} />} onClick={() => abrirEditar(s)} className="flex-1">
                    Editar
                  </Button>
                  <Button size="xs" variant="ghost" icon={<Trash2 size={11} />} onClick={() => setConfirmando(s)} className="text-aurora-red hover:bg-aurora-red-muted/30">
                    Excluir
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={podeGerenciarSalas && modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? `Editar sala: ${editando.nome}` : 'Nova sala'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" loading={salvando} onClick={handleSubmit(onSubmit)}>
              {editando ? 'Salvar alterações' : 'Cadastrar sala'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Nome da sala" error={errors.nome?.message} {...register('nome')} />
          <Input label="Capacidade (pessoas)" type="number" min={1} {...register('capacidade')} />
          <Textarea label="Descrição (opcional)" rows={2} placeholder="Informe a descrição da sala" {...register('descricao')} />
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded accent-aurora-primary" {...register('ativa')} />
            <span className="text-sm text-aurora-text-secondary">Sala disponível para agendamento</span>
          </label>
        </div>
      </Modal>

      <Modal
        open={podeGerenciarSalas && !!confirmando}
        onClose={() => setConfirmando(null)}
        title="Excluir sala"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmando(null)}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={excluir}>Confirmar exclusão</Button>
          </>
        }
      >
        <p className="text-sm text-aurora-text-secondary">
          Deseja excluir <strong className="text-aurora-text-primary">{confirmando?.nome}</strong>? As audiências já agendadas nessa sala não serão alteradas.
        </p>
      </Modal>
    </div>
  )
}
