import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { produtosService } from '../services/produtos.js'

export async function produtosRoutes(fastify: FastifyInstance) {
  // Toda rota de produtos exige sessão. A API usa service_role (bypassa RLS),
  // então a autenticação precisa acontecer aqui — não no banco.
  fastify.addHook('preHandler', requireAuth)

  // Listar produtos
  fastify.get('/', async (request) => {
    const { fonteId, pagina = 1, limite = 50, busca, categoria } = request.query as {
      fonteId?: string
      pagina?: number
      limite?: number
      busca?: string
      categoria?: string
    }

    return await produtosService.listarProdutos({ fonteId, pagina, limite, busca, categoria })
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
    } catch (error: any) {
      console.error('[POST /produtos]', error)
      return reply.status(400).send({ error: error?.message || 'Erro ao criar produto' })
    }
  })

  // Atualizar produto
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = request.body as Record<string, unknown>

    try {
      const produto = await produtosService.atualizarProduto(id, data)
      return produto
    } catch (error: any) {
      console.error('[PUT /produtos/:id]', error)
      return reply.status(400).send({ error: error?.message || 'Erro ao atualizar produto' })
    }
  })

  // Deletar produto
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await produtosService.deletarProduto(id)
      return { message: 'Produto deletado com sucesso' }
    } catch (error) {
      console.error('[DELETE /produtos/:id]', error)
      return reply.status(400).send({ error: 'Erro ao deletar produto' })
    }
  })
}
