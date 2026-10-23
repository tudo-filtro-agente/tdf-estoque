import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { UserPlus, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export default function RegistroPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const emailValido = email.toLowerCase().endsWith('@tudodefiltro.com.br')
  const senhaValida = senha.length >= 6
  const senhasBatem = senha === confirmarSenha && senha.length > 0
  const podeEnviar =
    nome.trim().length >= 3 && emailValido && senhaValida && senhasBatem

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (!podeEnviar) {
      setErro('Preencha todos os campos corretamente')
      return
    }

    setLoading(true)
    try {
      await register(nome, email, senha)
      navigate('/produtos')
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-marca px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy shadow-lg">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Criar Conta</CardTitle>
          <CardDescription>
            Cadastre-se com seu email corporativo da TDF
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="nome" className="text-sm font-medium">
                Nome completo
              </label>
              <Input
                id="nome"
                type="text"
                placeholder="João da Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email corporativo
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu.nome@tudodefiltro.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              {email && !emailValido && (
                <p className="text-xs text-amber-600">
                  Use um email @tudodefiltro.com.br
                </p>
              )}
              {emailValido && (
                <p className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" /> Email válido
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="senha" className="text-sm font-medium">
                Senha
              </label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {mostrarSenha ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {senha && !senhaValida && (
                <p className="text-xs text-amber-600">Mínimo 6 caracteres</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmar" className="text-sm font-medium">
                Confirmar senha
              </label>
              <Input
                id="confirmar"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Digite a senha novamente"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                autoComplete="new-password"
              />
              {confirmarSenha && !senhasBatem && (
                <p className="text-xs text-red-600">As senhas não coincidem</p>
              )}
              {senhasBatem && (
                <p className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" /> Senhas coincidem
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || !podeEnviar}>
              {loading ? (
                'Criando conta...'
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Criar conta
                </>
              )}
            </Button>

            <p className="text-center text-sm text-slate-500">
              Já tem conta?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Fazer login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
