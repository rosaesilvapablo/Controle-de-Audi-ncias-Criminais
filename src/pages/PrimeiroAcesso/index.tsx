import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Calendar, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Button, Input } from '../../components/ui'
import {
  buscarPrimeiroAcessoPorEmail,
  concluirPrimeiroAcesso,
  normalizarEmail,
} from '../../lib/usuarios'

const schema = z.object({
  senha: z.string().min(6, 'Minimo de 6 caracteres'),
  confirmarSenha: z.string().min(6, 'Confirme a senha'),
}).refine((dados) => dados.senha === dados.confirmarSenha, {
  message: 'As senhas precisam ser iguais.',
  path: ['confirmarSenha'],
})

type FormData = z.infer<typeof schema>

export default function PrimeiroAcesso() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const emailState = normalizarEmail(
    ((location.state as { email?: string } | null)?.email) ?? '',
  )
  const emailQuery = normalizarEmail(searchParams.get('email') ?? '')
  const [emailConfirmado, setEmailConfirmado] = useState('')
  const [validando, setValidando] = useState(true)
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmacao, setShowConfirmacao] = useState(false)
  const [erroGlobal, setErroGlobal] = useState('')
  const [carregando, setCarregando] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    let ativo = true

    const validarPlaceholder = async () => {
      const emailCandidato = emailState || emailQuery
      if (!emailCandidato) {
        navigate('/login', { replace: true })
        return
      }

      try {
        const cadastro = await buscarPrimeiroAcessoPorEmail(emailCandidato)
        if (!cadastro?.primeiroAcesso) {
          navigate('/login', { replace: true })
          return
        }

        if (ativo) {
          setEmailConfirmado(emailCandidato)
          setValidando(false)
        }
      } catch {
        navigate('/login', { replace: true })
      }
    }

    void validarPlaceholder()

    return () => {
      ativo = false
    }
  }, [emailQuery, emailState, navigate])

  const onSubmit = async (dados: FormData) => {
    if (!emailConfirmado) {
      setErroGlobal('Nao foi possivel identificar o cadastro pendente.')
      return
    }

    setErroGlobal('')
    setCarregando(true)
    try {
      await concluirPrimeiroAcesso({ email: emailConfirmado, senha: dados.senha })
      navigate('/', { replace: true })
    } catch (err: any) {
      const mensagemPorCodigo: Record<string, string> = {
        'auth/email-already-in-use': 'Ja existe uma conta ativa para este e-mail.',
        'auth/weak-password': 'Escolha uma senha com pelo menos 6 caracteres.',
        'auth/invalid-email': 'E-mail invalido.',
        'usuario-nao-encontrado': 'Cadastro nao encontrado para este e-mail.',
        'primeiro-acesso-invalido': 'Este cadastro ja concluiu o primeiro acesso.',
        'usuario-inativo': 'Este cadastro esta inativo. Fale com a diretoria do sistema.',
        'primeiro-acesso-email-ja-ativado': 'Este e-mail ja possui conta ativa. Enviamos um link de redefinicao de senha; apos criar a senha, entre normalmente na tela de login.',
        'primeiro-acesso-reconciliacao-falhou': 'Nao foi possivel concluir a ativacao com seguranca. Tente novamente ou contate o administrador.',
      }

      const codigo = err?.code ?? err?.message
      setErroGlobal(
        mensagemPorCodigo[codigo] ??
          'Nao foi possivel concluir o primeiro acesso. Tente novamente.',
      )
    } finally {
      setCarregando(false)
    }
  }

  if (validando) return null

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-aurora-bg p-4">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.18), transparent 68%)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(21,128,61,0.12), transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-aurora-primary shadow-glow-purple">
            <Calendar size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-aurora-text-primary">SCAC</h1>
          <p className="mt-1 text-center text-sm text-aurora-text-muted">
            Primeiro acesso ao sistema
          </p>
        </div>

        <div className="aurora-card-elevated border-aurora-border-light p-6 shadow-aurora-lg">
          <div className="mb-5 flex items-center gap-2">
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="text-aurora-text-muted transition-colors hover:text-aurora-primary"
            >
              <ArrowLeft size={16} />
            </button>
            <h2 className="text-lg font-semibold text-aurora-text-primary">Crie sua senha</h2>
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-lg border border-indigo-200 bg-aurora-primary-pale p-3">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-aurora-primary" />
            <p className="text-xs leading-relaxed text-aurora-text-secondary">
              Defina sua senha para concluir o acesso com o e-mail abaixo.
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input label="E-mail" type="email" value={emailConfirmado} readOnly />
            <Input
              label="Senha"
              type={showSenha ? 'text' : 'password'}
              autoComplete="new-password"
              error={form.formState.errors.senha?.message}
              iconRight={(
                <button
                  type="button"
                  onClick={() => setShowSenha((s) => !s)}
                  className="text-aurora-text-muted transition-colors hover:text-aurora-primary"
                >
                  {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
              {...form.register('senha')}
            />
            <Input
              label="Confirmar senha"
              type={showConfirmacao ? 'text' : 'password'}
              autoComplete="new-password"
              error={form.formState.errors.confirmarSenha?.message}
              iconRight={(
                <button
                  type="button"
                  onClick={() => setShowConfirmacao((s) => !s)}
                  className="text-aurora-text-muted transition-colors hover:text-aurora-primary"
                >
                  {showConfirmacao ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
              {...form.register('confirmarSenha')}
            />

            {erroGlobal && (
              <p className="rounded-lg border border-aurora-red/20 bg-aurora-red-muted/30 px-3 py-2 text-xs text-aurora-red">
                {erroGlobal}
              </p>
            )}

            <Button variant="primary" loading={carregando} className="w-full justify-center" type="submit">
              Concluir acesso
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
