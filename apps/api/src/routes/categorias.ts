import { FastifyInstance } from 'fastify'
import { requireAuth, requirePerfil } from '../middleware/auth.js'
import {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  desativarCategoria,
} from '../services/categorias.js'

export async function categoriasRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth)

  fastify.get('/', async () => ({ categorias: await listarCategorias(1) }))

  // Escrita restrita a administrador
  fastify.post('/', { preHandler: requirePerfil(['administrador']) }, async (request, reply) => {
    const body = request.body as { nome?: string; descricao?: string }

    if (!body.nome?.trim()) {
      return reply.status(400).send({ error: 'Nome é obrigatório' })
    }

    try {
      const categoria = await criarCategoria({ nome: body.nome.trim(), descricao: body.descricao })
      return reply.status(201).send(categoria)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar categoria'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.put('/:id', { preHandler: requirePerfil(['administrador']) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { nome?: string; descricao?: string; ativa?: boolean }

    try {
      return await atualizarCategoria(parseInt(id), body)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar categoria'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.delete('/:id', { preHandler: requirePerfil(['administrador']) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await desativarCategoria(parseInt(id))
      return { message: 'Categoria desativada' }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao desativar categoria'
      return reply.status(400).send({ error: message })
    }
  })
}