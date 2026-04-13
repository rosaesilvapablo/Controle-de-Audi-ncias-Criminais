import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Settings } from 'lucide-react'
import { useConfiguracoes } from '../../hooks/index'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Card, Input, PageLoader, Select } from '../../components/ui'
import { isAdmin, type DiaSemana } from '../../types'
import MotivoCancelamentoConfig from './MotivoCancelamentoConfig'
import DuracaoPorTipoConfig from './DuracaoPorTipoConfig'
import RegrasAgendamentoConfig from './RegrasAgendamentoConfig'
import AutorizadosSigilosoConfig from './AutorizadosSigilosoConfig'
import ChecklistTemplateEditor from './ChecklistTemplateEditor'

const schema = z.object({
  nomeVara: z.string().min(3),
  nomeJuizo: z.string().min(3),
  cidade: z.string().min(2),
  uf: z.string().length(2),
  duracaoPadraoMinutos: z.coerce.number().min(15).max(480),
  horarioInicioPauta: z.string(),
  horarioFimPauta: z.string(),
  emailNotificacoes: z.string().email().optional().or(z.literal('')),
  diasSemanaAtivos: z.array(z.coerce.number().int().min(0).max(6)).min(1),
})

type Form = z.infer<typeof schema>

const DIAS_SEMANA: Array<{ value: DiaSemana; label: string }> = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
]

const DIAS_UTEIS_PADRAO: DiaSemana[] = [1, 2, 3, 4, 5]

export default function Configuracoes() {
  const { usuario } = useAuth()
  const { config, loading, salvar } = useConfiguracoes()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      diasSemanaAtivos: DIAS_UTEIS_PADRAO,
    },
  })

  const diasSemanaAtivos = (watch('diasSemanaAtivos') ?? DIAS_UTEIS_PADRAO) as DiaSemana[]

  useEffect(() => {
    if (!config) return

    reset({
      nomeVara: config.nomeVara,
      nomeJuizo: config.nomeJuizo,
      cidade: config.cidade,
      uf: config.uf,
      duracaoPadraoMinutos: config.duracaoPadraoMinutos,
      horarioInicioPauta: config.horarioInicioPauta,
      horarioFimPauta: config.horarioFimPauta,
      emailNotificacoes: config.emailNotificacoes ?? '',
      diasSemanaAtivos: config.diasSemanaAtivos?.length
        ? config.diasSemanaAtivos
        : DIAS_UTEIS_PADRAO,
    })
  }, [config, reset])

  const alternarDiaSemana = (dia: DiaSemana) => {
    const atual = diasSemanaAtivos.includes(dia)
      ? diasSemanaAtivos.filter((item) => item !== dia)
      : [...diasSemanaAtivos, dia].sort((a, b) => a - b)

    setValue('diasSemanaAtivos', atual, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const onSubmit = async (data: Form) => {
    if (!usuario) return

    await salvar(
      {
        ...data,
        diasSemanaAtivos: data.diasSemanaAtivos as DiaSemana[],
      },
      usuario.uid,
    )
  }

  if (loading) return <PageLoader />

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Card padding="lg" className="bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fd_100%)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-aurora-primary">
              Administracao do sistema
            </div>
            <h1 className="text-3xl font-semibold text-aurora-text-primary">
              Configuracoes
            </h1>
            <p className="mt-1 text-sm text-aurora-text-muted">
              Ajuste regras gerais, identidade institucional e parametros operacionais do SCAC.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            loading={isSubmitting}
            disabled={!isDirty}
            onClick={handleSubmit(onSubmit)}
          >
            Salvar alteracoes
          </Button>
        </div>
      </Card>

      <Card padding="md" className="border-aurora-border-light">
        <p className="mb-4 text-sm font-medium text-aurora-text-primary">
          Identificacao da vara
        </p>
        <div className="flex flex-col gap-3">
          <Input
            label="Nome da vara"
            error={errors.nomeVara?.message}
            {...register('nomeVara')}
          />
          <Input
            label="Nome do juizo"
            error={errors.nomeJuizo?.message}
            {...register('nomeJuizo')}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="col-span-2">
              <Input
                label="Cidade"
                error={errors.cidade?.message}
                {...register('cidade')}
              />
            </div>
            <Select label="UF" {...register('uf')}>
              {[
                'AC',
                'AL',
                'AP',
                'AM',
                'BA',
                'CE',
                'DF',
                'ES',
                'GO',
                'MA',
                'MT',
                'MS',
                'MG',
                'PA',
                'PB',
                'PR',
                'PE',
                'PI',
                'RJ',
                'RN',
                'RS',
                'RO',
                'RR',
                'SC',
                'SP',
                'SE',
                'TO',
              ].map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card padding="md" className="border-aurora-border-light">
        <p className="mb-4 text-sm font-medium text-aurora-text-primary">
          Pauta e horarios
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Duracao padrao (min)"
            type="number"
            min={15}
            error={errors.duracaoPadraoMinutos?.message}
            {...register('duracaoPadraoMinutos')}
          />
          <Input
            label="Inicio da pauta"
            type="time"
            {...register('horarioInicioPauta')}
          />
          <Input
            label="Fim da pauta"
            type="time"
            {...register('horarioFimPauta')}
          />
        </div>
      </Card>

      <Card padding="md" className="border-aurora-border-light">
        <p className="mb-2 text-sm font-medium text-aurora-text-primary">
          Dias uteis de audiencia
        </p>
        <p className="mb-4 text-xs text-aurora-text-muted">
          Selecione em quais dias da semana o sistema deve permitir agendamento.
        </p>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map((dia) => {
            const ativo = diasSemanaAtivos.includes(dia.value)

            return (
              <button
                key={dia.value}
                type="button"
                onClick={() => alternarDiaSemana(dia.value)}
                className={`inline-flex h-10 min-w-[56px] items-center justify-center rounded-xl border px-3 text-sm font-medium transition-all ${
                  ativo
                    ? 'border-aurora-primary bg-indigo-50 text-aurora-primary shadow-sm'
                    : 'border-aurora-border bg-white text-aurora-text-secondary hover:border-aurora-border-light hover:bg-aurora-elevated'
                }`}
              >
                {dia.label}
              </button>
            )
          })}
        </div>
        {errors.diasSemanaAtivos?.message && (
          <p className="mt-3 text-2xs text-aurora-red">
            {errors.diasSemanaAtivos.message}
          </p>
        )}
      </Card>

      <Card padding="md" className="border-aurora-border-light">
        <p className="mb-4 text-sm font-medium text-aurora-text-primary">
          Avisos por e-mail
        </p>
        <Input
          label="E-mail para receber avisos (opcional)"
          type="email"
          placeholder="Informe o e-mail institucional"
          error={errors.emailNotificacoes?.message}
          {...register('emailNotificacoes')}
        />
      </Card>

      <MotivoCancelamentoConfig />

      <DuracaoPorTipoConfig />

      <RegrasAgendamentoConfig />

      <ChecklistTemplateEditor />

      {isAdmin(usuario?.perfil) && <AutorizadosSigilosoConfig />}

      <div className="flex items-center gap-2 text-2xs text-aurora-text-muted">
        <Settings size={12} />
        <span>SCAC v2.0 · Tema Aurora · 4a Vara Federal Criminal</span>
      </div>
    </div>
  )
}
