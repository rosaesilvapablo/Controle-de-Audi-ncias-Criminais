import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { useRegrasAgendamento } from '../../hooks'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button, Card, Input } from '../../components/ui'

export default function RegrasAgendamentoConfig() {
  const { usuario } = useAuth()
  const toast = useToast()
  const { regras, loading, salvando, salvarRegras } = useRegrasAgendamento()
  const [draft, setDraft] = useState(regras)

  useEffect(() => {
    setDraft(regras)
  }, [regras])

  const isDiretor = usuario?.perfil === 'diretor'
  const houveAlteracoes = useMemo(
    () =>
      draft.prazoMinimoUteis !== regras.prazoMinimoUteis ||
      draft.expedienteInicio !== regras.expedienteInicio ||
      draft.expedienteFim !== regras.expedienteFim,
    [draft, regras],
  )

  const salvar = async () => {
    toast.info('Salvando regras de agendamento...')

    try {
      await salvarRegras(draft)
      toast.success('Regras de agendamento salvas com sucesso.')
    } catch {
      toast.error('Nao foi possivel salvar as regras de agendamento. Tente novamente.')
    }
  }

  return (
    <Card padding="md">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-aurora-text-primary">
              Regras de Agendamento
            </p>
            <p className="mt-1 text-xs text-aurora-text-muted">
              Slots dentro deste prazo ficam bloqueados para Supervisores, Servidores, Estagiarios e Convidados.
              Diretor e Magistrado podem agendar com confirmacao.
            </p>
          </div>
          {isDiretor && (
            <Button
              variant="primary"
              size="sm"
              icon={<Save size={14} />}
              loading={salvando}
              disabled={loading || !houveAlteracoes}
              onClick={() => void salvar()}
            >
              Salvar
            </Button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Prazo minimo de antecedencia"
            type="number"
            min={1}
            max={60}
            disabled={!isDiretor || loading}
            value={String(draft.prazoMinimoUteis)}
            onChange={(event) =>
              setDraft((atual) => ({
                ...atual,
                prazoMinimoUteis: Math.min(60, Math.max(1, Number(event.target.value || 1))),
              }))
            }
            hint="dias uteis"
          />
          <Input
            label="Inicio do expediente"
            type="time"
            disabled={!isDiretor || loading}
            value={draft.expedienteInicio}
            onChange={(event) =>
              setDraft((atual) => ({
                ...atual,
                expedienteInicio: event.target.value,
              }))
            }
          />
          <Input
            label="Fim do expediente"
            type="time"
            disabled={!isDiretor || loading}
            value={draft.expedienteFim}
            onChange={(event) =>
              setDraft((atual) => ({
                ...atual,
                expedienteFim: event.target.value,
              }))
            }
          />
        </div>

        <div className="rounded-2xl border border-aurora-border bg-aurora-elevated/40 p-4 text-xs text-aurora-text-muted">
          Slots dentro deste prazo ficam bloqueados para Supervisores, Servidores, Estagiarios e Convidados.
          Diretor e Magistrado podem agendar com confirmacao.
        </div>
      </div>
    </Card>
  )
}
