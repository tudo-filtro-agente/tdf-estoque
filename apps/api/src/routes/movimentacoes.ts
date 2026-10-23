import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import {
  listarMovimentacoes,
  criarMovimentacao,
  TIPOS_MOVIMENTACAO,
  TipoMovimentacao,
} from '../services/movimentacoes.js'

export async function movimentacoesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth)

  // Listar movimentações com filtros
  fastify.get('/', async (request) => {
    const { produtoId, tipo, dataInicio, dataFim, pagina = 1, limite = 50 } = request.query as {
      produtoId?: string
      tipo?: TipoMovimentacao
      dataInicio?: string
      dataFim?: string
      pagina?: number
      limite?: number
    }

    const result = await listarMovimentacoes({
      produtoId: produtoId ? parseInt(produtoId) : undefined,
      tipo,
      dataInicio,
      dataFim,
      page: pagina,
      limit: limite,
    })

    return {
      movimentacoes: result.data,
      total: result.total,
      pagina: result.page,
      limite: result.limit,
      total_paginas: result.totalPages,
    }
  })

  // Metadados dos tipos (para montar selects no front)
  fastify.get('/tipos', async () => ({ tipos: TIPOS_MOVIMENTACAO }))

  // Criar movimentação
  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      produto_id?: number
      tipo?: TipoMovimentacao
      quantidade?: number
      documento?: string
      observacao?: string
    }

    if (!body.produto_id || !body.tipo || !body.quantidade) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        message: 'produto_id, tipo e quantidade são obrigatórios',
      })
    }

    const usuario = request.usuario

    try {
      const movimentacao = await criarMovimentacao({
        produto_id: body.produto_id,
        tipo: body.tipo,
        quantidade: Number(body.quantidade),
        documento: body.documento,
        observacao: body.observacao,
        usuario_id: usuario?.id,
      })
      return reply.status(201).send(movimentacao)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar movimentação'
      return reply.status(400).send({ error: 'Erro ao criar movimentação', message })
    }
  })
}