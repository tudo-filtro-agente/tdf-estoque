import { FastifyInstance } from 'fastify'
import { requireAuth, requirePerfil } from '../middleware/auth.js'
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  redefinirSenha,
  desativarUsuario,
  Usuario,
  PERFIS,
} from '../services/usuarios.js'

export async function usuariosRoutes(fastify: FastifyInstance) {
  // Tudo nesse recurso é restrito a administrador
  fastify.addHook('preHandler', requireAuth)
  fastify.addHook('preHandler', requirePerfil(['administrador']))

  fastify.get('/', async () => ({
    usuarios: await listarUsuarios(),
    perfis: PERFIS,
  }))

  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      nome?: string
      email?: string
      senha?: string
      perfil?: Usuario['perfil']
    }

    if (!body.nome || !body.email || !body.senha || !body.perfil) {
      return reply
        .status(400)
        .send({ error: 'Dados incompletos', message: 'nome, email, senha e perfil são obrigatórios' })
    }

    try {
      const usuario = await criarUsuario({
        nome: body.nome,
        email: body.email,
        senha: body.senha,
        perfil: body.perfil,
      })
      return reply.status(201).send(usuario)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar usuário'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      nome?: string
      perfil?: Usuario['perfil']
      ativo?: boolean
    }

    try {
      return await atualizarUsuario(parseInt(id), body)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar usuário'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.post('/:id/senha', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { senha?: string }

    if (!body.senha) {
      return reply.status(400).send({ error: 'Senha é obrigatória' })
    }

    try {
      await redefinirSenha(parseInt(id), body.senha)
      return { message: 'Senha redefinida' }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao redefinir senha'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await desativarUsuario(parseInt(id))
      return { message: 'Usuário desativado' }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao desativar usuário'
      return reply.status(400).send({ error: message })
    }
  })
}