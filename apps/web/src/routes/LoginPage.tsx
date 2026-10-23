import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { LogIn, AlertCircle, Eye, EyeOff, UserPlus, ServerCrash } from 'lucide-react'
import { ApiError } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  // Falha por excesso de requisições é problema do servidor, não da senha.
  const [erroCota, setErroCota] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setErroCota(false)
    setLoading(true)

    try {
      await login(email, senha)
      navigate('/produtos')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.porCota) {
        setErroCota(true)
        setErro(err.message)
      } else {
        setErro(err instanceof Error ? err.message : 'Email ou senha incorretos')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-marca px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy shadow-lg">
            <span className="text-2xl font-bold text-white">TDF</span>
          </div>
          <CardTitle className="text-2xl">TDF Estoque</CardTitle>
          <CardDescription>
            Sistema de Controle de Estoque da Tudo de Filtro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && (
              <div
                role="alert"
                className={
                  erroCota
                    ? 'flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700'
                    : 'flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600'
                }
              >
                {erroCota ? (
                  <ServerCrash className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                )}
                <span>
                  {erro}
                  {erroCota && ' Sua senha está correta; o problema é o servidor.'}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@tudodefiltro.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="senha" className="text-sm font-medium">
                  Senha
                </label>
                <Link
                  to="/esqueci-senha"
                  className="text-xs text-primary hover:underline"
                >
                  Esqueceu?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 focus:outline-none"
                  tabIndex={-1}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                'Entrando...'
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </>
              )}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">ou</span>
              </div>
            </div>

            <Link to="/registro" className="block">
              <Button type="button" variant="outline" className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                Criar conta (TDF)
              </Button>
            </Link>

            <p className="text-center text-xs text-slate-500">
              Apenas emails do domínio{' '}
              <span className="font-medium text-navy">@tudodefiltro.com.br</span>{' '}
              podem se cadastrar.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
