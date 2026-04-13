import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Landmark, Plus, Trash2, RepeatIcon, InfoIcon } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { useFeriados } from '../../hooks/index'
import { temPermissao } from '../../lib/permissoes'
import { Button, Badge, Card, Modal, Input, Select, PageLoader, EmptyState, StatCard } from '../../components/ui'
import type { TipoFeriado } from '../../types'

const TIPO_LABELS: Record<TipoFeriado, string> = {
  nacional: 'Nacional',
  estadual: 'Estadual',
  municipal: 'Municipal',
  recesso: 'Recesso judiciário',
  ponto_facultativo: 'Ponto facultativo',
}

const TIPO_COR: Record<TipoFeriado, string> = {
  nacional: 'danger',
  estadual: 'warning',
  municipal: 'info',
  recesso: 'primary',
  ponto_facultativo: 'muted',
} as const

const schema = z.object({
  descricao: z.string().min(3, 'Descrição obrigatória'),
  data: z.string().min(1, 'Data obrigatória'),
  tipo: z.string().min(1),
  recorrente: z.boolean(),
})
type Form = z.infer<typeof schema>

export default function Feriados() {
  const { usuario } = useAuth()
  const { feriados, loading, criar, excluir } = useFeriados()
  const [modal, setModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const podeGerenciarFeriados = temPermissao(usuario?.perfil, 'gerenciar_feriados')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'nacional', recorrente: true },
  })

  const onSubmit = async (data: Form) => {
    setSalvando(true)
    const [y, m, d] = data.data.split('-').map(Number)
    await criar({
      descricao: data.descricao,
      data: Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0)),
      tipo: data.tipo as TipoFeriado,
      recorrente: data.recorrente,
    })
    setSalvando(false)
    reset()
    setModal(false)
  }

  const nacionais = feriados.filter((f) => f.tipo === 'nacional').length
  const recessos = feriados.filter((f) => f.tipo === 'recesso').length

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-5">
      <Card padding="lg" className="bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fd_100%)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-aurora-primary">
              Datas bloqueadas
            </div>
            <h1 className="text-3xl font-semibold text-aurora-text-primary">Feriados e recessos</h1>
            <p className="mt-1 text-sm text-aurora-text-muted">Gerencie as datas que impedem agendamentos no sistema.</p>
          </div>
          {podeGerenciarFeriados && (
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setModal(true)}>
              Adicionar data
            </Button>
          )}
        </div>
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-aurora-border-light bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-4">
        <InfoIcon size={14} className="mt-0.5 shrink-0 text-aurora-green" />
        <p className="text-xs leading-relaxed text-aurora-text-secondary">
          As datas cadastradas aqui são verificadas automaticamente no agendamento. Se houver tentativa de marcar audiência nessas datas, o sistema bloqueará a ação.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total" value={feriados.length} color="primary" icon={<Landmark size={14} />} />
        <StatCard label="Nacionais" value={nacionais} color="red" />
        <StatCard label="Recessos" value={recessos} color="amber" />
      </div>

      {feriados.length === 0 ? (
        <EmptyState
          icon={<Landmark size={24} />}
          title="Nenhuma data cadastrada"
          description="Cadastre feriados e recessos para bloquear o agendamento nessas datas."
          action={podeGerenciarFeriados ? <Button variant="primary" size="sm" onClick={() => setModal(true)}>Adicionar data</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {feriados.map((f) => (
            <Card key={f.id} padding="sm" className="flex items-center gap-4 border-l-4 border-l-aurora-primary/50">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-aurora-border bg-aurora-elevated">
                <span className="text-xs font-medium leading-none text-aurora-text-primary">{format(f.data.toDate(), 'dd')}</span>
                <span className="text-2xs uppercase leading-none text-aurora-text-muted">{format(f.data.toDate(), 'MMM', { locale: ptBR })}</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-aurora-text-primary">{f.descricao}</p>
                  {f.recorrente && (
                    <span title="Repete anualmente">
                      <RepeatIcon size={11} className="text-aurora-text-muted" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={TIPO_COR[f.tipo] as any}>{TIPO_LABELS[f.tipo]}</Badge>
                  {f.recorrente && <span className="text-2xs text-aurora-text-muted">Repete todo ano</span>}
                </div>
              </div>

              <span className="hidden text-xs text-aurora-text-muted sm:block">{format(f.data.toDate(), 'yyyy', { locale: ptBR })}</span>

              {podeGerenciarFeriados && (
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<Trash2 size={12} />}
                  className="shrink-0 text-aurora-red hover:bg-aurora-red-muted/30"
                  onClick={() => excluir(f.id)}
                >
                  Excluir
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={podeGerenciarFeriados && modal}
        onClose={() => { setModal(false); reset() }}
        title="Adicionar data bloqueada"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setModal(false); reset() }}>Cancelar</Button>
            <Button variant="primary" size="sm" loading={salvando} onClick={handleSubmit(onSubmit)}>Salvar alterações</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Descrição" placeholder="Informe a descrição do feriado" error={errors.descricao?.message} {...register('descricao')} />
          <Input label="Data" type="date" error={errors.data?.message} {...register('data')} />
          <Select label="Tipo" {...register('tipo')}>
            {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded accent-aurora-primary" {...register('recorrente')} />
            <span className="text-sm text-aurora-text-secondary">Repetir todos os anos</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}
