import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Modal, Select, Textarea } from '../ui'
import { MetaCNJ, TipoAudiencia, type Processo } from '../../types/core'

const schema = z.object({
  numeroProcesso: z
    .string()
    .min(3, 'Informe o número do processo.')
    .regex(/^[\d.-]+$/, 'Use apenas dígitos, pontos e traços.'),
  cargoMagistrado: z.string().min(1, 'Selecione o cargo do magistrado.'),
  tipoAudiencia: z.nativeEnum(TipoAudiencia),
  naturezaCrime: z.string().optional(),
  metaCNJ: z.nativeEnum(MetaCNJ),
  observacoes: z.string().max(1000, 'Máximo de 1000 caracteres.').optional(),
})

type FormData = z.infer<typeof schema>

const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  [TipoAudiencia.AIJ]: 'Audiência de Instrução e Julgamento',
  [TipoAudiencia.CUSTODIA]: 'Audiência de Custódia',
  [TipoAudiencia.PRELIMINAR]: 'Audiência Preliminar',
  [TipoAudiencia.ANPP]: 'ANPP',
  [TipoAudiencia.HOMOLOGACAO]: 'Homologação',
  [TipoAudiencia.INSTRUCAO]: 'Instrução',
  [TipoAudiencia.OUTRO]: 'Outro',
}

const META_LABELS: Record<MetaCNJ, string> = {
  [MetaCNJ.META_1]: 'Meta CNJ 1',
  [MetaCNJ.META_2]: 'Meta CNJ 2',
  [MetaCNJ.META_4]: 'Meta CNJ 4',
  [MetaCNJ.META_5]: 'Meta CNJ 5',
  [MetaCNJ.META_6]: 'Meta CNJ 6',
  [MetaCNJ.META_30]: 'Meta CNJ 30',
  [MetaCNJ.SEM_META]: 'Sem meta vinculada',
}

export function ModalEditarProcesso({
  processo,
  aberto,
  onFechar,
  onSalvar,
}: {
  processo: Processo
  aberto: boolean
  onFechar: () => void
  onSalvar: (dados: Partial<Processo>) => Promise<void>
}) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      numeroProcesso: processo.numeroProcesso,
      cargoMagistrado: processo.cargoMagistrado,
      tipoAudiencia: processo.tipoAudiencia,
      naturezaCrime: processo.naturezaCrime ?? '',
      metaCNJ: processo.metaCNJ,
      observacoes: processo.observacoes ?? '',
    },
  })

  useEffect(() => {
    if (!aberto) return
    form.reset({
      numeroProcesso: processo.numeroProcesso,
      cargoMagistrado: processo.cargoMagistrado,
      tipoAudiencia: processo.tipoAudiencia,
      naturezaCrime: processo.naturezaCrime ?? '',
      metaCNJ: processo.metaCNJ,
      observacoes: processo.observacoes ?? '',
    })
    setErro(null)
  }, [aberto, form, processo])

  useEffect(() => {
    if (!aberto) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onFechar()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [aberto, onFechar])

  const observacoesAtual = form.watch('observacoes') ?? ''
  const footer = useMemo(() => (
    <>
      <Button variant="ghost" size="sm" onClick={onFechar}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        size="sm"
        loading={salvando}
        onClick={form.handleSubmit(async (values) => {
          setSalvando(true)
          setErro(null)
          try {
            const patch: Partial<Processo> = {}
            if (values.numeroProcesso !== processo.numeroProcesso) patch.numeroProcesso = values.numeroProcesso
            if (values.cargoMagistrado !== processo.cargoMagistrado) patch.cargoMagistrado = values.cargoMagistrado
            if (values.tipoAudiencia !== processo.tipoAudiencia) patch.tipoAudiencia = values.tipoAudiencia
            if ((values.naturezaCrime || undefined) !== processo.naturezaCrime) patch.naturezaCrime = values.naturezaCrime || undefined
            if (values.metaCNJ !== processo.metaCNJ) patch.metaCNJ = values.metaCNJ
            if ((values.observacoes || undefined) !== processo.observacoes) patch.observacoes = values.observacoes || undefined
            await onSalvar(patch)
            onFechar()
          } catch {
            setErro('Não foi possível salvar as alterações. Tente novamente.')
          } finally {
            setSalvando(false)
          }
        })}
      >
        Salvar
      </Button>
    </>
  ), [form, onFechar, onSalvar, processo, salvando])

  return (
    <Modal open={aberto} onClose={onFechar} title="Editar dados do processo" size="md" footer={footer}>
      <div className="space-y-4">
        <Input
          label="Número do processo"
          error={form.formState.errors.numeroProcesso?.message}
          {...form.register('numeroProcesso')}
        />

        <Select
          label="Cargo do magistrado"
          error={form.formState.errors.cargoMagistrado?.message}
          {...form.register('cargoMagistrado')}
        >
          <option value="Juiz Federal">Juiz Federal</option>
          <option value="Juiz Federal Substituto">Juiz Federal Substituto</option>
          <option value="Juiz designado para o ato">Juiz designado para o ato</option>
        </Select>

        <Select
          label="Tipo de audiência"
          error={form.formState.errors.tipoAudiencia?.message}
          {...form.register('tipoAudiencia')}
        >
          {Object.entries(TIPO_AUDIENCIA_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Input label="Natureza do crime" {...form.register('naturezaCrime')} />

        <Select
          label="Meta CNJ"
          error={form.formState.errors.metaCNJ?.message}
          {...form.register('metaCNJ')}
        >
          {Object.entries(META_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <div className="space-y-1">
          <Textarea
            label="Observações gerais"
            rows={5}
            error={form.formState.errors.observacoes?.message}
            {...form.register('observacoes')}
          />
          <div className="text-right text-2xs text-aurora-text-muted">
            {observacoesAtual.length}/1000
          </div>
        </div>

        {erro && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}
      </div>
    </Modal>
  )
}
