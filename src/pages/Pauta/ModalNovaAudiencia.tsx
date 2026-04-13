// ──────────────────────────────────────────────────────────
//  Modal Nova Audiência — React Hook Form + Zod
// ──────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addMinutes } from 'date-fns'
import { useCriarAudiencia } from '../../hooks/useAudiencias'
import { useSalas, useUsuarios } from '../../hooks/index'
import { Modal, Button, Input, Select, Textarea } from '../../components/ui'
import type { TipoAudiencia } from '../../types'
import { TIPO_AUDIENCIA_LABELS } from '../../types'

// ── Schema de validação ────────────────────────────────────
const schema = z.object({
  numeroProcesso: z.string().min(3, 'Informe o número do processo'),
  tipo:           z.string().min(1, 'Selecione o tipo'),
  data:           z.string().min(1, 'Informe a data'),
  horaInicio:     z.string().min(1, 'Informe o horário de início'),
  horaFim:        z.string().min(1, 'Informe o horário de término'),
  salaId:         z.string().min(1, 'Selecione uma sala'),
  magistradoId:   z.string().min(1, 'Selecione o magistrado'),
  partes:         z.string().optional(),
  observacoes:    z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  initialDate?: Date | null
}

export function ModalNovaAudiencia({ open, onClose, initialDate }: Props) {
  const { criar, salvando } = useCriarAudiencia()
  const { salas }           = useSalas(true)
  const { usuarios }        = useUsuarios()

  const magistrados = usuarios.filter((u) => u.perfil === 'magistrado' && u.ativo)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: 'instrucao',
    },
  })

  // Preencher data/hora quando aberto via clique no slot
  useEffect(() => {
    if (initialDate && open) {
      setValue('data', format(initialDate, 'yyyy-MM-dd'))
      setValue('horaInicio', format(initialDate, 'HH:mm'))
      setValue('horaFim', format(addMinutes(initialDate, 60), 'HH:mm'))
    }
  }, [initialDate, open, setValue])

  const onSubmit = async (data: FormData) => {
    const [ano, mes, dia]       = data.data.split('-').map(Number)
    const [hIni, mIni]          = data.horaInicio.split(':').map(Number)
    const [hFim, mFim]          = data.horaFim.split(':').map(Number)
    const dataHoraInicio        = new Date(ano, mes - 1, dia, hIni, mIni)
    const dataHoraFim           = new Date(ano, mes - 1, dia, hFim, mFim)

    const sala       = salas.find((s) => s.id === data.salaId)
    const magistrado = magistrados.find((u) => u.uid === data.magistradoId)

    const id = await criar({
      numeroProcesso: data.numeroProcesso.trim().toUpperCase(),
      tipo:           data.tipo as TipoAudiencia,
      dataHoraInicio,
      dataHoraFim,
      salaId:         data.salaId,
      salaNome:       sala?.nome ?? '',
      magistradoId:   data.magistradoId,
      magistradoNome: magistrado?.nome ?? '',
      partes:         data.partes?.trim(),
      observacoes:    data.observacoes?.trim(),
    })

    if (id) {
      reset()
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Nova audiência"
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => { reset(); onClose() }}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={salvando}
            onClick={handleSubmit(onSubmit)}
          >
            Agendar audiência
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Número do processo"
          placeholder="0000000-00.0000.0.00.0000"
          error={errors.numeroProcesso?.message}
          {...register('numeroProcesso')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo" error={errors.tipo?.message} {...register('tipo')}>
            {Object.entries(TIPO_AUDIENCIA_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input
            label="Data"
            type="date"
            error={errors.data?.message}
            {...register('data')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Início"
            type="time"
            error={errors.horaInicio?.message}
            {...register('horaInicio')}
          />
          <Input
            label="Término"
            type="time"
            error={errors.horaFim?.message}
            {...register('horaFim')}
          />
        </div>

        <Select label="Magistrado" error={errors.magistradoId?.message} {...register('magistradoId')}>
          <option value="">Selecione…</option>
          {magistrados.map((m) => (
            <option key={m.uid} value={m.uid}>{m.nome}</option>
          ))}
        </Select>

        <Select label="Sala" error={errors.salaId?.message} {...register('salaId')}>
          <option value="">Selecione…</option>
          {salas.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </Select>

        <Input
          label="Partes (opcional)"
          placeholder="Nome das partes envolvidas"
          {...register('partes')}
        />

        <Textarea
          label="Observações (opcional)"
          placeholder="Anotações adicionais…"
          rows={2}
          {...register('observacoes')}
        />
      </form>
    </Modal>
  )
}
