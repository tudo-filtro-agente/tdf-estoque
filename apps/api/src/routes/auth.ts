import { FastifyInstance } from 'fastify'
import { authService } from '../services/auth'

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email e senha são obrigatórios' })
    }

    try {
      const result = await authService.login(email, password)
      return result
    } catch (error) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }
  })

  // Logout
  fastify.post('/logout', async () => {
    return { message: 'Logout realizado com sucesso' }
  })

  // Refresh token
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }

    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token é obrigatório' })
    }

    try {
      const result = await authService.refreshToken(refreshToken)
      return result
    } catch (error) {
      return reply.status(401).send({ error: 'Token inválido' })
    }
  })
}
