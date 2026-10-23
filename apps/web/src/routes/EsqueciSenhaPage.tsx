import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react'

type Etapa = 'email' | 'reset' | 'sucesso'

export default function EsqueciSenhaPage() {
  const { requestPasswordReset, resetPassword } = useAuth()
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)

  const emailValido = email.toLowerCase().endsWith('@tudodefiltro.com.br')
  const senhasBatem = novaSenha === confirmarSenha && novaSenha.length >= 6

  const handleSolicitar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setMensagem('')
    setLoading(true)
    try {
      const result = await requestPasswordReset(email)
      if (result.success) {
        setMensagem(result.message || 'Solicitação enviada!')
        // Em dev, preenche o token automaticamente
        if (result.devToken) {
          setToken(result.devToken)
        }
        setEtapa('reset')
      } else {
        setErro('Erro ao processar solicitação')
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao processar solicitação')
    } finally {
      setLoading(false)
    }
  }

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!senhasBatem) {
      setErro('As senhas não coincidem ou têm menos de 6 caracteres')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token, novaSenha)
      setEtapa('sucesso')
    } catch (err: any) {
      setErro(err.message || 'Erro ao redefinir senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-marca px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy shadow-lg">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">
            {etapa === 'sucesso' ? 'Senha redefinida!' : 'Recuperar senha'}
          </CardTitle>
          <CardDescription>
            {etapa === 'email' && 'Informe seu email para receber o link de redefinição'}
            {etapa === 'reset' && 'Defina uma nova senha para sua conta'}
            {etapa === 'sucesso' && 'Sua senha foi alterada com sucesso'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {erro && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {mensagem && etapa === 'email' && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>{mensagem}</span>
            </div>
          )}

          {etapa === 'email' && (
            <form onSubmit={handleSolicitar} className="space-y-4">
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
                />
                {email && !emailValido && (
                  <p className="text-xs text-amber-600">
                    Use um email @tudodefiltro.com.br
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading || !emailValido}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>

              <Link to="/login" className="block">
                <Button type="button" variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para o login
                </Button>
              </Link>
            </form>
          )}

          {etapa === 'reset' && (
            <form onSubmit={handleRedefinir} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="token" className="text-sm font-medium">
                  Token de redefinição
                </label>
                <Input
                  id="token"
                  type="text"
                  placeholder="Cole o token aqui"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-500">
                  Token gerado (em desenvolvimento). Em produção, viria por email.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="novaSenha" className="text-sm font-medium">
                  Nova senha
                </label>
                <div className="relative">
                  <Input
                    id="novaSenha"
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                    tabIndex={-1}
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmar" className="text-sm font-medium">
                  Confirmar nova senha
                </label>
                <Input
                  id="confirmar"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Digite novamente"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  required
                />
                {confirmarSenha && !senhasBatem && (
                  <p className="text-xs text-red-600">As senhas não coincidem</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !senhasBatem || !token}
              >
                {loading ? 'Redefinindo...' : 'Redefinir senha'}
              </Button>
            </form>
          )}

          {etapa === 'sucesso' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-slate-600">
                Sua senha foi alterada. Você já pode fazer login com a nova senha.
              </p>
              <Link to="/login">
                <Button className="w-full">Ir para o login</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
