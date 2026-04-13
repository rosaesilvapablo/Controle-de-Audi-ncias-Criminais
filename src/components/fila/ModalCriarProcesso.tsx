import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { setDoc } from 'firebase/firestore'
import { Button, Input, Modal, Select, Textarea } from '../ui'
import { BadgeMetaCNJ } from '../shared/BadgeMetaCNJ'
import { BadgePrioridade } from '../shared/BadgePrioridade'
import { ChipEtiqueta } from '../shared/ChipEtiqueta'
import { useProcessos } from '../../hooks/useProcessos'
import { db } from '../../lib/firebase'
import { refFase1 } from '../../services/collections'
import {
  MetaCNJ,
  Prioridade,
  TipoAudiencia,
  type Processo,
} from '../../types/core'
import { verificarAntecedencia } from '../../utils/validacoes'
import { collection, doc, setDoc as setLegacyDoc, Timestamp } from 'firebase/firestore'

const schema = z.object({
  numeroProcesso: z.string().min(5, 'Informe ao menos 5 caracteres.'),
  cargoMagistrado: z.string().min(1, 'Selecione o cargo do magistrado.'),
  tipoAudiencia: z.nativeEnum(TipoAudiencia),
  naturezaCrime: z.string().optional(),
  dataLimiteLegal: z.string().optional(),
  dataPerspectiva: z.string().optional(),
  alertaAtivo: z.boolean(),
  sugestaoData: z.string().optional(),
  sugestaoHorario: z.string().optional(),
  quantidadeReus: z.coerce.number().min(0),
  quantidadeTestemunhas: z.coerce.number().min(0),
  quantidadeOutros: z.coerce.number().min(0),
  observacoes: z.string().max(1000, 'Máximo de 1000 caracteres.').optional(),
})

type FormData = z.infer<typeof schema>

const PRIORIDADES = [
  Prioridade.REU_PRESO,
  Prioridade.CRIANCA,
  Prioridade.IDOSO_70,
  Prioridade.VITIMA,
  Prioridade.JUIZO,
  Prioridade.IDOSO_60,
] as const

const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  [TipoAudiencia.AIJ]: 'Audiência de instrução e julgamento',
  [TipoAudiencia.CUSTODIA]: 'Audiência de custódia',
  [TipoAudiencia.PRELIMINAR]: 'Audiência preliminar',
  [TipoAudiencia.ANPP]: 'ANPP',
  [TipoAudiencia.HOMOLOGACAO]: 'Homologação',
  [TipoAudiencia.INSTRUCAO]: 'Instrução',
  [TipoAudiencia.OUTRO]: 'Outro',
}

export function ModalCriarProcesso({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean
  onFechar: () => void
  onCriado: (id: string) => void
}) {
  const { criarProcesso } = useProcessos()
  const [prioridades, setPrioridades] = useState<Prioridade[]>([])
  const [metaCNJ, setMetaCNJ] = useState<MetaCNJ>(MetaCNJ.SEM_META)
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [novaEtiqueta, setNovaEtiqueta] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      numeroProcesso: '',
      cargoMagistrado: 'Juiz Federal',
      tipoAudiencia: TipoAudiencia.AIJ,
      naturezaCrime: '',
      dataLimiteLegal: '',
      dataPerspectiva: '',
      alertaAtivo: true,
      sugestaoData: '',
      sugestaoHorario: '',
      quantidadeReus: 0,
      quantidadeTestemunhas: 0,
      quantidadeOutros: 0,
      observacoes: '',
    },
  })

  useEffect(() => {
    if (!aberto) return
    form.reset()
    setPrioridades([])
    setMetaCNJ(MetaCNJ.SEM_META)
    setEtiquetas([])
    setNovaEtiqueta('')
    setErro(null)
  }, [aberto, form])

  const dataLimiteLegal = form.watch('dataLimiteLegal')
  const dataPerspectiva = form.watch('dataPerspectiva')
  const sugestaoData = form.watch('sugestaoData')
  const observacoes = form.watch('observacoes') ?? ''

  const avisoPrescricao =
    dataLimiteLegal && dataPerspectiva && dataPerspectiva > dataLimiteLegal
      ? 'A data em perspectiva está posterior à data limite legal.'
      : null

  const avisoAntecedencia = useMemo(() => {
    if (!sugestaoData) return null
    return verificarAntecedencia(new Date(`${sugestaoData}T12:00:00`)).mensagemAviso
  }, [sugestaoData])

  const adicionarEtiqueta = () => {
    const texto = novaEtiqueta.trim()
    if (!texto || etiquetas.includes(texto) || etiquetas.length >= 20) {
      setNovaEtiqueta('')
      return
    }
    setEtiquetas((atual) => [...atual, texto])
    setNovaEtiqueta('')
  }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Novo processo"
      size="lg"
      footer={(
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
                const processoBase: Omit<Processo, 'id' | 'criadoEm' | 'atualizadoEm'> = {
                  numeroProcesso: values.numeroProcesso.trim(),
                  tipoAudiencia: values.tipoAudiencia,
                  naturezaCrime: values.naturezaCrime?.trim() || undefined,
                  metaCNJ,
                  cargoMagistrado: values.cargoMagistrado,
                  prioridades,
                  etiquetas,
                  etiquetasSistemicas: metaCNJ === MetaCNJ.SEM_META ? [] : [metaCNJ],
                  prescricao: {
                    dataLimite: values.dataLimiteLegal ? new Date(`${values.dataLimiteLegal}T12:00:00`) : undefined,
                    dataPerspectiva: values.dataPerspectiva ? new Date(`${values.dataPerspectiva}T12:00:00`) : undefined,
                    alertaAtivo: values.alertaAtivo,
                  },
                  fases: {
                    // será sobrescrito pelo hook
                    fase1: undefined as never,
                    fase2: undefined as never,
                    fase3: undefined as never,
                  },
                  totalParticipantes: 0,
                  totalIntimacoesPendentes: 0,
                  totalCartasPrecatoriasEmAlerta: 0,
                  observacoes: values.observacoes?.trim() || undefined,
                  criadoPor: '',
                }

                const id = await criarProcesso(processoBase)

                await setDoc(refFase1(id), {
                  id: 'fase1',
                  processoId: id,
                  sugestaoData: values.sugestaoData ? new Date(`${values.sugestaoData}T12:00:00`) : undefined,
                  sugestaoHorario: values.sugestaoHorario || undefined,
                  quantidadeReus: values.quantidadeReus,
                  quantidadeTestemunhas: values.quantidadeTestemunhas,
                  quantidadeOutros: values.quantidadeOutros,
                  observacoes: values.observacoes?.trim() || undefined,
                  atualizadoEm: new Date(),
                }, { merge: true })

                // TODO: remover após validação completa da migração
                await setLegacyDoc(doc(collection(db, 'processos_pendentes'), id), {
                  numeroProcesso: values.numeroProcesso.trim(),
                  tipoAudiencia: values.tipoAudiencia,
                  cargoMagistrado: values.cargoMagistrado,
                  dataInclusao: Timestamp.now(),
                  criadoEm: Timestamp.now(),
                  atualizadoEm: Timestamp.now(),
                  criadoPor: id,
                  observacoes: values.observacoes?.trim() || undefined,
                  quantidadeReus: values.quantidadeReus,
                  quantidadeTestemunhas: values.quantidadeTestemunhas,
                  quantidadePeritos: 0,
                  quantidadeOutros: values.quantidadeOutros,
                  minutosEstimados: (values.quantidadeReus + values.quantidadeTestemunhas + values.quantidadeOutros) * 15,
                  diasEstimados: 1,
                  reuPreso: prioridades.includes(Prioridade.REU_PRESO),
                  sigiloso: false,
                  situacao: 'aguardando',
                }, { merge: true })

                onFechar()
                onCriado(id)
              } catch (error) {
                console.error(error)
                setErro('Não foi possível criar o processo. Tente novamente.')
              } finally {
                setSalvando(false)
              }
            })}
          >
            Criar processo
          </Button>
        </>
      )}
    >
      <div className="max-h-[85vh] space-y-6 overflow-y-auto pr-1">
        <section className="space-y-4">
          <div className="text-sm font-semibold text-aurora-text-primary">Identificação</div>
          <Input label="Número do processo" error={form.formState.errors.numeroProcesso?.message} {...form.register('numeroProcesso')} />
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Cargo do magistrado" error={form.formState.errors.cargoMagistrado?.message} {...form.register('cargoMagistrado')}>
              <option value="Juiz Federal">Juiz Federal</option>
              <option value="Juiz Federal Substituto">Juiz Federal Substituto</option>
              <option value="Juiz designado para o ato">Juiz designado para o ato</option>
            </Select>
            <Select label="Tipo de audiência" error={form.formState.errors.tipoAudiencia?.message} {...form.register('tipoAudiencia')}>
              {Object.entries(TIPO_AUDIENCIA_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </Select>
          </div>
          <Input label="Natureza do crime" {...form.register('naturezaCrime')} />
        </section>

        <section className="space-y-4 border-t border-aurora-border pt-5">
          <div className="text-sm font-semibold text-aurora-text-primary">Classificação</div>
          <div className="flex flex-wrap gap-2">
            {PRIORIDADES.map((prioridade) => (
              <label key={prioridade} className="cursor-pointer rounded-2xl border border-aurora-border bg-aurora-elevated px-2 py-2">
                <input
                  className="sr-only"
                  type="checkbox"
                  checked={prioridades.includes(prioridade)}
                  onChange={(event) => {
                    setPrioridades((atual) =>
                      event.target.checked
                        ? [...atual, prioridade]
                        : atual.filter((item) => item !== prioridade),
                    )
                  }}
                />
                <BadgePrioridade prioridade={prioridade} />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 rounded-full border border-aurora-border px-3 py-2 text-sm text-aurora-text-secondary">
              <input type="radio" checked={metaCNJ === MetaCNJ.SEM_META} onChange={() => setMetaCNJ(MetaCNJ.SEM_META)} />
              <span>Sem meta vinculada</span>
            </label>
            {[MetaCNJ.META_1, MetaCNJ.META_2, MetaCNJ.META_4, MetaCNJ.META_5, MetaCNJ.META_6, MetaCNJ.META_30].map((meta) => (
              <label key={meta} className="inline-flex items-center gap-2 rounded-full border border-aurora-border px-3 py-2">
                <input type="radio" checked={metaCNJ === meta} onChange={() => setMetaCNJ(meta)} />
                <BadgeMetaCNJ meta={meta} />
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <Input
              label="Etiquetas livres"
              placeholder="Adicionar etiqueta..."
              value={novaEtiqueta}
              onChange={(event) => setNovaEtiqueta(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault()
                  adicionarEtiqueta()
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              {etiquetas.map((etiqueta) => (
                <ChipEtiqueta key={etiqueta} texto={etiqueta} onRemover={() => setEtiquetas((atual) => atual.filter((item) => item !== etiqueta))} />
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-aurora-border pt-5">
          <div className="text-sm font-semibold text-aurora-text-primary">Prescrição</div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Data limite legal" type="date" {...form.register('dataLimiteLegal')} />
            <Input label="Data em perspectiva" type="date" {...form.register('dataPerspectiva')} />
          </div>
          {avisoPrescricao && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {avisoPrescricao}
            </div>
          )}
          <label className="flex items-start gap-3 rounded-2xl border border-aurora-border bg-aurora-elevated px-3 py-3 text-sm text-aurora-text-secondary">
            <input type="checkbox" {...form.register('alertaAtivo')} />
            <span>Alertas de prescrição ativos</span>
          </label>
        </section>

        <section className="space-y-4 border-t border-aurora-border pt-5">
          <div className="text-sm font-semibold text-aurora-text-primary">Planejamento inicial</div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Sugestão de data" type="date" {...form.register('sugestaoData')} />
            <Input label="Sugestão de horário" type="time" {...form.register('sugestaoHorario')} />
          </div>
          {avisoAntecedencia && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {avisoAntecedencia}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Réus" type="number" min={0} {...form.register('quantidadeReus')} />
            <Input label="Testemunhas" type="number" min={0} {...form.register('quantidadeTestemunhas')} />
            <Input label="Outros" type="number" min={0} {...form.register('quantidadeOutros')} />
          </div>
        </section>

        <section className="space-y-3 border-t border-aurora-border pt-5">
          <div className="text-sm font-semibold text-aurora-text-primary">Observações</div>
          <Textarea rows={5} maxLength={1000} {...form.register('observacoes')} />
          <div className="text-right text-2xs text-aurora-text-muted">{observacoes.length}/1000</div>
        </section>

        {erro && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}
      </div>
    </Modal>
  )
}
