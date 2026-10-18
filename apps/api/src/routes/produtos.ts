import { FastifyInstance } from 'fastify'
import { produtosService } from '../services/produtos'

export async function produtosRoutes(fastify: FastifyInstance) {
  // Listar produtos
  fastify.get('/', async (request) => {
    const { fonteId, pagina = 1, limite = 50 } = request.query as {
      fonteId?: string
      pagina?: number
      limite?: number
    }

    return await produtosService.listarProdutos({ fonteId, pagina, limite })
  })

  // Buscar produto por ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const produto = await produtosService.buscarProduto(id)
    if (!produto) {
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }

    return produto
  })

  // Criar produto
  fastify.post('/', async (request, reply) => {
    const data = request.body as Record<string, unknown>

    try {
      const produto = await produtosService.criarProduto(data)
      return reply.status(201).send(produto)
    } catch (error) {
      return reply.status(400).send({ error: 'Erro ao criar produto' })
    }
  })

  // Atualizar produto
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = request.body as Record<string, unknown>

    try {
      const produto = await produtosService.atualizarProduto(id, data)
      return produto
    } catch (error) {
      return reply.status(400).send({ error: 'Erro ao atualizar produto' })
    }
  })

  // Deletar produto
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await produtosService.deletarProduto(id)
      return { message: 'Produto deletado com sucesso' }
    } catch (error) {
      return reply.status(400).send({ error: 'Erro ao deletar produto' })
    }
  })
}
