import { useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui'
import { aplicarContexto, contextoDeExemplo, extrairVariaveis } from '../../utils/modelos'

interface EditorModeloProps {
  conteudo: string
  variaveis: string[]
  onChange: (conteudo: string, variaveis: string[]) => void
  somenteLeitura?: boolean
}

interface VariavelFixa {
  nome: string
  descricao: string
}

const VARIAVEIS_FIXAS: VariavelFixa[] = [
  { nome: 'numeroProcesso', descricao: 'Numero do processo' },
  { nome: 'tipoAudiencia', descricao: 'Tipo de audiencia' },
  { nome: 'dataAudiencia', descricao: 'Data da audiencia' },
  { nome: 'horaAudiencia', descricao: 'Hora da audiencia' },
  { nome: 'sala', descricao: 'Sala/local' },
  { nome: 'cargoMagistrado', descricao: 'Cargo do magistrado' },
  { nome: 'naturezaCrime', descricao: 'Natureza do crime' },
  { nome: 'dataHoje', descricao: 'Data atual' },
]

function normalizarNomeVariavel(nome: string): string {
  return nome
    .trim()
    .replace(/[{}]/g, '')
    .replace(/\s+/g, '')
}

function consolidarVariaveis(base: string[], adicionais: string[]): string[] {
  return Array.from(new Set([...base, ...adicionais].filter(Boolean)))
}

export function EditorModelo({
  conteudo,
  variaveis,
  onChange,
  somenteLeitura = false,
}: EditorModeloProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [novaVariavel, setNovaVariavel] = useState('')
  const [erroVariavel, setErroVariavel] = useState<string | null>(null)

  const fixas = useMemo(() => VARIAVEIS_FIXAS.map((item) => item.nome), [])
  const variaveisPersonalizadas = useMemo(
    () => variaveis.filter((item) => !fixas.includes(item)),
    [fixas, variaveis],
  )

  const preview = useMemo(
    () => aplicarContexto(conteudo, contextoDeExemplo()),
    [conteudo],
  )

  function atualizarConteudo(novoConteudo: string) {
    const extraidas = extrairVariaveis(novoConteudo)
    onChange(novoConteudo, consolidarVariaveis(variaveis, extraidas))
  }

  function inserirVariavel(nome: string) {
    if (somenteLeitura) return

    const token = `{{${nome}}}`
    const alvo = textareaRef.current
    if (!alvo) {
      atualizarConteudo(`${conteudo}${token}`)
      return
    }

    const inicio = alvo.selectionStart ?? conteudo.length
    const fim = alvo.selectionEnd ?? conteudo.length
    const proximo = `${conteudo.slice(0, inicio)}${token}${conteudo.slice(fim)}`
    onChange(proximo, consolidarVariaveis(variaveis, [nome]))

    window.requestAnimationFrame(() => {
      alvo.focus()
      const cursor = inicio + token.length
      alvo.setSelectionRange(cursor, cursor)
    })
  }

  function adicionarVariavelPersonalizada() {
    const nome = normalizarNomeVariavel(novaVariavel)
    if (!nome) return

    if (!/^[a-zA-Z0-9_]+$/.test(nome)) {
      setErroVariavel('Use apenas letras, numeros e underscore.')
      return
    }

    setErroVariavel(null)
    setNovaVariavel('')
    inserirVariavel(nome)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          <label className="text-xs font-medium text-aurora-text-secondary">
            Conteudo do modelo
          </label>
          <textarea
            ref={textareaRef}
            className="min-h-[400px] w-full resize-y rounded-2xl border border-aurora-border bg-aurora-elevated px-3 py-3 font-mono text-sm text-aurora-text-primary focus:border-aurora-primary focus:outline-none focus:ring-2 focus:ring-aurora-primary/15 disabled:cursor-not-allowed disabled:opacity-70"
            value={conteudo}
            onChange={(event) => atualizarConteudo(event.target.value)}
            placeholder="Digite o texto do modelo. Use {{numeroProcesso}} e outras variaveis."
            readOnly={somenteLeitura}
          />
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="rounded-2xl border border-aurora-border bg-aurora-elevated p-3">
            <div className="text-sm font-semibold text-aurora-text-primary">
              Variaveis disponiveis
            </div>
            <p className="mt-1 text-xs text-aurora-text-muted">Clique para inserir no cursor.</p>

            <div className="mt-3 space-y-2">
              {VARIAVEIS_FIXAS.map((variavel) => (
                <button
                  key={variavel.nome}
                  type="button"
                  onClick={() => inserirVariavel(variavel.nome)}
                  disabled={somenteLeitura}
                  className="flex w-full items-center justify-between rounded-xl border border-aurora-border px-2 py-1.5 text-left text-xs text-aurora-text-secondary transition hover:border-aurora-primary/40 hover:text-aurora-text-primary disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="font-mono">{`{{${variavel.nome}}}`}</span>
                  <span className="ml-2 text-2xs text-aurora-text-muted">{variavel.descricao}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-aurora-border pt-3">
              <div className="text-xs font-medium text-aurora-text-secondary">Variaveis personalizadas</div>
              <div className="mt-2 flex gap-2">
                <input
                  className="h-8 flex-1 rounded-lg border border-aurora-border bg-aurora-surface px-2 text-xs text-aurora-text-primary focus:border-aurora-primary focus:outline-none"
                  value={novaVariavel}
                  onChange={(event) => setNovaVariavel(event.target.value)}
                  placeholder="ex: nomeServidor"
                  disabled={somenteLeitura}
                />
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  icon={<Plus size={12} />}
                  onClick={adicionarVariavelPersonalizada}
                  disabled={somenteLeitura}
                >
                  Adicionar
                </Button>
              </div>
              {erroVariavel && <p className="mt-1 text-2xs text-aurora-red">{erroVariavel}</p>}
              {variaveisPersonalizadas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {variaveisPersonalizadas.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => inserirVariavel(item)}
                      disabled={somenteLeitura}
                      className="rounded-full border border-aurora-border bg-aurora-surface px-2 py-0.5 font-mono text-2xs text-aurora-text-secondary hover:border-aurora-primary/40 hover:text-aurora-text-primary disabled:cursor-not-allowed"
                    >
                      {`{{${item}}}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-aurora-border bg-aurora-elevated p-3">
            <div className="text-sm font-semibold text-aurora-text-primary">Pre-visualizacao</div>
            <p className="mt-1 text-xs text-aurora-text-muted">Com valores de exemplo.</p>
            <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-aurora-border bg-aurora-surface p-2 text-xs leading-relaxed text-aurora-text-primary">
              <pre className="whitespace-pre-wrap [font-family:inherit]">{preview || 'Sem conteudo.'}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

