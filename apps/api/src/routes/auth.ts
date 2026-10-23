import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
  login,
  logout,
  getUsuarioByToken,
  register,
  requestPasswordReset,
  resetPassword,
} from '../services/auth.js'
import { requireAuth } from '../middleware/auth.js'

interface LoginBody {
  email: string
  senha: string
}

interface RegisterBody {
  nome: string
  email: string
  senha: string
}

interface ForgotBody {
  email: string
}

interface ResetBody {
  token: string
  senha: string
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post<{ Body: LoginBody }>('/login', async (request, reply) => {
    const { email, senha } = request.body || {}

    if (!email || !senha) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        message: 'Email e senha são obrigatórios',
      })
    }

    const result = await login({ email, senha })

    if (!result.success) {
      // Cota do Supabase estourada: 503 com Retry-After, para o frontend
      // avisar que é o servidor. 401 seria lido como senha errada.
      if (result.erroCota) {
        return reply.status(503).send({
          error: 'Serviço temporariamente indisponível',
          message: result.error || 'Muitas tentativas de login. Tente novamente em alguns minutos.',
          erroCota: true,
        })
      }

      return reply.status(401).send({
        error: 'Não autorizado',
        message: result.error || 'Credenciais inválidas',
      })
    }

    return reply.send({
      usuario: result.usuario,
      token: result.token,
    })
  })

  // POST /api/auth/register - Apenas para emails @tudodefiltro.com.br
  fastify.post<{ Body: RegisterBody }>('/register', async (request, reply) => {
    const { nome, email, senha } = request.body || {}

    if (!nome || !email || !senha) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        message: 'Nome, email e senha são obrigatórios',
      })
    }

    const result = await register({ nome, email, senha })

    if (!result.success) {
      return reply.status(400).send({
        error: 'Erro no cadastro',
        message: result.error,
      })
    }

    return reply.status(201).send({
      usuario: result.usuario,
      token: result.token,
      message: 'Cadastro realizado com sucesso!',
    })
  })

  // POST /api/auth/forgot - Solicitar redefinição de senha
  fastify.post<{ Body: ForgotBody }>('/forgot', async (request, reply) => {
    const { email } = request.body || {}

    if (!email) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        message: 'Email é obrigatório',
      })
    }

    const result = await requestPasswordReset(email)

    return reply.send({
      success: result.success,
      message: result.message || 'Se o email estiver cadastrado, você receberá as instruções.',
      // Em produção, NÃO retornar o token - apenas em dev
      ...(result.resetToken && { devToken: result.resetToken }),
    })
  })

  // POST /api/auth/reset - Redefinir senha com token
  fastify.post<{ Body: ResetBody }>('/reset', async (request, reply) => {
    const { token, senha } = request.body || {}

    if (!token || !senha) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        message: 'Token e nova senha são obrigatórios',
      })
    }

    const result = await resetPassword(token, senha)

    if (!result.success) {
      return reply.status(400).send({
        error: 'Erro ao redefinir senha',
        message: result.error,
      })
    }

    return reply.send({
      success: true,
      message: 'Senha redefinida com sucesso! Você já pode fazer login.',
    })
  })

  // POST /api/auth/logout
  fastify.post('/logout', { preHandler: requireAuth }, async (request, reply) => {
    const token = extractToken(request)

    if (token) {
      await logout(token)
    }

    return reply.send({ success: true })
  })

  // GET /api/auth/me
  fastify.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ usuario: request.usuario })
  })
}

function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}
