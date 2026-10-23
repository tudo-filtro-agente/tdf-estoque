import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../db.js'
import { alertasEstoqueMinimo, resumoPorCategoria } from '../services/dashboard.js'
import { listarMovimentacoes, TipoMovimentacao } from '../services/movimentacoes.js'

export async function relatoriosRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth)

  // Relatório 1: estoque abaixo do mínimo
  fastify.get('/estoque-minimo', async (request) => {
    const { limite = 100 } = request.query as { limite?: number }
    return { alertas: await alertasEstoqueMinimo(1, limite) }
  })

  // Relatório 2: inventário por categoria
  fastify.get('/por-categoria', async () => ({ categorias: await resumoPorCategoria(1) }))

  // Relatório 2b: inventário por localização
  fastify.get('/por-localizacao', async () => {
    const { data, error } = await supabaseAdmin
      .from('produtos')
      .select('localizacao, saldo_atual, preco_custo')
      .eq('empresa_id', 1)
      .eq('ativo', true)

    if (error) throw error

    const map: Record<string, { localizacao: string; total_produtos: number; total_estoque: number; valor_total: number }> = {}
    for (const p of data || []) {
      const loc = p.localizacao || '(sem localização)'
      if (!map[loc]) {
        map[loc] = { localizacao: loc, total_produtos: 0, total_estoque: 0, valor_total: 0 }
      }
      map[loc].total_produtos += 1
      map[loc].total_estoque += Number(p.saldo_atual || 0)
      map[loc].valor_total += Number(p.saldo_atual || 0) * Number(p.preco_custo || 0)
    }

    const localizacoes = Object.values(map)
      .map((v) => ({
        ...v,
        total_estoque: Math.round(v.total_estoque * 100) / 100,
        valor_total: Math.round(v.valor_total * 100) / 100,
      }))
      .sort((a, b) => b.valor_total - a.valor_total)

    return { localizacoes }
  })

  // Relatório 3: movimentações por período
  fastify.get('/movimentacoes', async (request) => {
    const { dataInicio, dataFim, tipo, limite = 200 } = request.query as {
      dataInicio?: string
      dataFim?: string
      tipo?: TipoMovimentacao
      limite?: number
    }

    const result = await listarMovimentacoes({
      dataInicio,
      dataFim,
      tipo,
      limit: limite,
    })

    // Somatório do período
    let totalEntrada = 0
    let totalSaida = 0
    let valorEntradas = 0
    let valorSaidas = 0

    const precos = await precosPorProdutoIds(
      result.data.map((m) => m.produto_id)
    )

    for (const m of result.data) {
      const q = Number(m.quantidade)
      const custo = precos[m.produto_id] || 0
      if (m.tipo === 'entrada' || m.tipo === 'inventario') {
        totalEntrada += q
        valorEntradas += q * custo
      } else if (m.tipo === 'saida') {
        totalSaida += q
        valorSaidas += q * custo
      }
    }

    return {
      movimentacoes: result.data,
      resumo: {
        total_movimentacoes: result.total,
        total_entrada: Math.round(totalEntrada * 100) / 100,
        total_saida: Math.round(totalSaida * 100) / 100,
        valor_entradas: Math.round(valorEntradas * 100) / 100,
        valor_saidas: Math.round(valorSaidas * 100) / 100,
      },
    }
  })
}

async function precosPorProdutoIds(ids: number[]): Promise<Record<number, number>> {
  if (ids.length === 0) return {}

  const { data } = await supabaseAdmin
    .from('produtos')
    .select('id, preco_custo')
    .in('id', [...new Set(ids)])

  const map: Record<number, number> = {}
  for (const p of data || []) {
    map[p.id] = Number(p.preco_custo || 0)
  }
  return map
}