import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { dashboardKpis, alertasEstoqueMinimo, resumoPorCategoria } from '../services/dashboard.js'
import { listarMovimentacoes, movimentacoesPorDia, resumoMovimentacoes } from '../services/movimentacoes.js'

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth)

  // KPIs principais
  fastify.get('/kpis', async () => dashboardKpis(1))

  // Gráfico entrada/saída por dia ( últimos N dias)
  fastify.get('/graficos', async (request) => {
    const { dias = 30 } = request.query as { dias?: number }
    const [porDia, resumo] = await Promise.all([
      movimentacoesPorDia(1, dias),
      resumoMovimentacoes(1, dias),
    ])
    return { por_dia: porDia, resumo }
  })

  // Produtos abaixo do estoque mínimo
  fastify.get('/alertas', async (request) => {
    const { limite = 50 } = request.query as { limite?: number }
    return { alertas: await alertasEstoqueMinimo(1, limite) }
  })

  // Inventário agrupado por categoria
  fastify.get('/por-categoria', async () => ({ categorias: await resumoPorCategoria(1) }))

  // Últimas movimentações (para o card de atividade recente)
  fastify.get('/recentes', async (request) => {
    const { limite = 10 } = request.query as { limite?: number }
    const result = await listarMovimentacoes({ limit: limite })
    return { movimentacoes: result.data }
  })
}