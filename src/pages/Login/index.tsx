import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Calendar, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Input } from '../../components/ui'
import { buscarPrimeiroAcessoPorEmail, normalizarEmail } from '../../lib/usuarios'

const schemaEmail = z.object({
  email: z.string().email('E-mail inválido'),
})
type FormEmail = z.infer<typeof schemaEmail>

const schemaLogin = z.object({
  senha: z.string().min(6, 'Mínimo de 6 caracteres'),
})
type FormLogin = z.infer<typeof schemaLogin>

const schemaReset = z.object({
  email: z.string().email('E-mail inválido'),
})
type FormReset = z.infer<typeof schemaReset>

type Etapa = 'email' | 'senha' | 'reset'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, resetPassword } = useAuth()
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [showSenha, setShowSenha] = useState(false)
  const [resetOk, setResetOk] = useState(false)
  const [erroGlobal, setErroGlobal] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [emailAtual, setEmailAtual] = useState('')

  const formEmail = useForm<FormEmail>({ resolver: zodResolver(schemaEmail) })
  const formLogin = useForm<FormLogin>({ resolver: zodResolver(schemaLogin) })
  const formReset = useForm<FormReset>({ resolver: zodResolver(schemaReset) })

  const onIdentificar = async (data: FormEmail) => {
    const email = normalizarEmail(data.email)
    setErroGlobal('')
    setCarregando(true)
    try {
      const usuario = await buscarPrimeiroAcessoPorEmail(email)
      if (usuario?.primeiroAcesso) {
        navigate(`/primeiro-acesso?email=${encodeURIComponent(email)}`, {
          state: { email },
        })
        return
      }

      setEmailAtual(email)
      formReset.reset({ email })
      formLogin.reset({ senha: '' })
      setEtapa('senha')
    } catch (error) {
      console.error('[SCAC Login]', error)
      setErroGlobal('Não foi possível verificar o acesso. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const onLogin = async (data: FormLogin) => {
    setErroGlobal('')
    setCarregando(true)
    try {
      await signIn(emailAtual, data.senha)
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/user-not-found': 'E-mail ou senha inválidos. Se é seu primeiro acesso, verifique com o administrador se seu cadastro foi realizado.',
        'auth/wrong-password': 'E-mail ou senha inválidos. Se é seu primeiro acesso, verifique com o administrador se seu cadastro foi realizado.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
        'auth/user-disabled': 'Conta desativada. Fale com a administração do sistema.',
      }
      setErroGlobal(msgs[err.code] ?? 'Não foi possível entrar. Verifique seus dados e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const onReset = async (data: FormReset) => {
    setErroGlobal('')
    setCarregando(true)
    try {
      await resetPassword(normalizarEmail(data.email))
      setResetOk(true)
    } catch {
      setErroGlobal('Não foi possível enviar a redefinição de senha. Verifique o endereço informado e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const voltarParaEmail = () => {
    setEtapa('email')
    setErroGlobal('')
    setResetOk(false)
    setShowSenha(false)
    formLogin.reset({ senha: '' })
  }

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
            Sistema de Controle de Audiências Criminais
            <br />
            <span className="text-2xs">4ª Vara Federal Criminal</span>
          </p>
        </div>

        <div className="aurora-card-elevated border-aurora-border-light p-6 shadow-aurora-lg">
          {etapa === 'email' && (
            <>
              <h2 className="mb-5 text-lg font-semibold text-aurora-text-primary">Acessar o sistema</h2>

              <form onSubmit={formEmail.handleSubmit(onIdentificar)} className="flex flex-col gap-4">
                <Input
                  label="E-mail institucional"
                  type="email"
                  autoComplete="email"
                  error={formEmail.formState.errors.email?.message}
                  {...formEmail.register('email')}
                />

                {erroGlobal && (
                  <p className="rounded-lg border border-aurora-red/20 bg-aurora-red-muted/30 px-3 py-2 text-xs text-aurora-red">
                    {erroGlobal}
                  </p>
                )}

                <Button variant="primary" loading={carregando} className="w-full justify-center" type="submit">
                  Entrar
                </Button>
              </form>
            </>
          )}

          {etapa === 'senha' && (
            <>
              <div className="mb-5 flex items-center gap-2">
                <button
                  onClick={voltarParaEmail}
                  className="text-aurora-text-muted transition-colors hover:text-aurora-primary"
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="text-lg font-semibold text-aurora-text-primary">Informe sua senha</h2>
              </div>

              <form onSubmit={formLogin.handleSubmit(onLogin)} className="flex flex-col gap-4">
                <Input label="E-mail" type="email" value={emailAtual} readOnly />
                <Input
                  label="Senha"
                  type={showSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  error={formLogin.formState.errors.senha?.message}
                  iconRight={(
                    <button
                      type="button"
                      onClick={() => setShowSenha((s) => !s)}
                      className="text-aurora-text-muted transition-colors hover:text-aurora-primary"
                    >
                      {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                  {...formLogin.register('senha')}
                />

                {erroGlobal && (
                  <p className="rounded-lg border border-aurora-red/20 bg-aurora-red-muted/30 px-3 py-2 text-xs text-aurora-red">
                    {erroGlobal}
                  </p>
                )}

                <Button variant="primary" loading={carregando} className="w-full justify-center" type="submit">
                  Entrar no sistema
                </Button>
              </form>

              <button
                onClick={() => {
                  setEtapa('reset')
                  setErroGlobal('')
                  setResetOk(false)
                  formReset.reset({ email: emailAtual })
                }}
                className="mt-4 w-full text-center text-xs font-medium text-aurora-text-muted transition-colors hover:text-aurora-primary"
              >
                Esqueci minha senha
              </button>
            </>
          )}

          {etapa === 'reset' && (
            <>
              <div className="mb-5 flex items-center gap-2">
                <button
                  onClick={() => {
                    setEtapa('senha')
                    setResetOk(false)
                    setErroGlobal('')
                  }}
                  className="text-aurora-text-muted transition-colors hover:text-aurora-primary"
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="text-lg font-semibold text-aurora-text-primary">Recuperar senha</h2>
              </div>

              {resetOk ? (
                <div className="py-4 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-aurora-green-pale">
                    <span className="text-lg text-aurora-green">OK</span>
                  </div>
                  <p className="text-sm text-aurora-text-secondary">
                    Redefinição solicitada. Verifique sua caixa de entrada.
                  </p>
                </div>
              ) : (
                <form onSubmit={formReset.handleSubmit(onReset)} className="flex flex-col gap-4">
                  <p className="text-xs text-aurora-text-muted">
                    Informe o e-mail cadastrado para redefinir sua senha.
                  </p>
                  <Input
                    label="E-mail"
                    type="email"
                    error={formReset.formState.errors.email?.message}
                    {...formReset.register('email')}
                  />
                  {erroGlobal && <p className="text-xs text-aurora-red">{erroGlobal}</p>}
                  <Button variant="primary" loading={carregando} className="w-full justify-center" type="submit">
                    Redefinir senha
                  </Button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-2xs text-aurora-text-muted">
          Acesso restrito a servidores autorizados
        </p>
      </div>
    </div>
  )
}
