import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { login, logout, getUsuarioByToken } from '../services/auth'
import { requireAuth } from '../middleware/auth'

interface LoginBody {
  email: string
  senha: string
}

export async function authRoutes(fastify: FastifyInstance) {

  // POST /api/auth/login
  fastify.post<{ Body: LoginBody }>('/api/auth/login', async (request, reply) => {
    const { email, senha } = request.body || {}

    if (!email || !senha) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        message: 'Email e senha são obrigatórios'
      })
    }

    const result = await login({ email, senha })

    if (!result.success) {
      return reply.status(401).send({
        error: 'Não autorizado',
        message: result.error || 'Credenciais inválidas'
      })
    }

    return reply.send({
      usuario: result.usuario,
      token: result.token
    })
  })

  // POST /api/auth/logout
  fastify.post('/api/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    const token = extractToken(request)

    if (token) {
      await logout(token)
    }

    return reply.send({ success: true })
  })

  // GET /api/auth/me
  fastify.get('/api/auth/me', { preHandler: requireAuth }, async (request, reply) => {
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
