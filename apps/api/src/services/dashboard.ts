import { supabaseAdmin } from '../db.js'

export interface DashboardKpis {
  total_produtos_ativos: number
  valor_total_estoque: number
  total_abaixo_minimo: number
  total_sem_movimento_30d: number
  total_categorias: number
  total_movimentacoes_30d: number
  total_entradas_30d: number
  total_saidas_30d: number
}

export async function dashboardKpis(empresaId: number = 1): Promise<DashboardKpis> {
  // produtos ativos
  const { count: totalProdutos } = await supabaseAdmin
    .from('produtos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('ativo', true)

  // valor do estoque = saldo_atual * preco_custo (apenas ativos)
  const { data: saldos } = await supabaseAdmin
    .from('produtos')
    .select('saldo_atual, preco_custo, estoque_minimo')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)

  let valorTotal = 0
  let abaixoMinimo = 0
  for (const p of saldos || []) {
    if (p.preco_custo) {
      valorTotal += Number(p.saldo_atual ?? 0) * Number(p.preco_custo)
    }
    if (Number(p.estoque_minimo ?? 0) > 0 && Number(p.saldo_atual ?? 0) < Number(p.estoque_minimo)) {
      abaixoMinimo += 1
    }
  }

  // total de categorias distintas em uso
  const { count: totalCategorias } = await supabaseAdmin
    .from('categorias')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('ativa', true)

  // movimentações dos últimos 30 dias
  const dataInicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: m30 } = await supabaseAdmin
    .from('movimentacoes')
    .select('tipo, quantidade, produto_id')
    .eq('empresa_id', empresaId)
    .gte('created_at', dataInicio)

  let totalEntradas = 0
  let totalSaidas = 0
  const produtosComMovimento = new Set<number>()
  for (const m of m30 || []) {
    produtosComMovimento.add(m.produto_id)
    if (m.tipo === 'entrada' || m.tipo === 'inventario') {
      totalEntradas += Number(m.quantidade)
    } else if (m.tipo === 'saida') {
      totalSaidas += Number(m.quantidade)
    }
  }

  // produtos ativos sem movimento nos últimos 30d
  const { data: ativos } = await supabaseAdmin
    .from('produtos')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)

  const totalAtivos = ativos?.length || 0
  const totalSemMovimento = Math.max(0, totalAtivos - produtosComMovimento.size)

  return {
    total_produtos_ativos: totalProdutos || 0,
    valor_total_estoque: Math.round(valorTotal * 100) / 100,
    total_abaixo_minimo: abaixoMinimo,
    total_sem_movimento_30d: totalSemMovimento,
    total_categorias: totalCategorias || 0,
    total_movimentacoes_30d: (m30 || []).length,
    total_entradas_30d: Math.round(totalEntradas * 100) / 100,
    total_saidas_30d: Math.round(totalSaidas * 100) / 100,
  }
}

export interface AlertaEstoqueMin {
  id: number
  codigo: string
  nome: string
  categoria?: string
  unidade: string
  saldo_atual: number
  estoque_minimo: number
  deficit: number
  localizacao?: string
}

export async function alertasEstoqueMinimo(
  empresaId: number = 1,
  limite: number = 50
): Promise<AlertaEstoqueMin[]> {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('id, codigo, nome, categoria, unidade, saldo_atual, estoque_minimo, localizacao')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .gt('estoque_minimo', 0)
    .order('nome')
    .limit(200)

  if (error) throw error

  const alertas: AlertaEstoqueMin[] = []
  for (const p of data || []) {
    const min = Number(p.estoque_minimo || 0)
    const atual = Number(p.saldo_atual || 0)
    if (min > 0 && atual < min) {
      alertas.push({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        categoria: p.categoria || undefined,
        unidade: p.unidade,
        saldo_atual: atual,
        estoque_minimo: min,
        deficit: Math.round((min - atual) * 100) / 100,
        localizacao: p.localizacao || undefined,
      })
    }
  }

  // ordena por criticidade (maior déficit primeiro)
  alertas.sort((a, b) => b.deficit - a.deficit)
  return alertas.slice(0, limite)
}

export interface ProdutoResumoCategoria {
  categoria: string
  total_produtos: number
  total_estoque: number
  valor_total: number
}

export async function resumoPorCategoria(
  empresaId: number = 1
): Promise<ProdutoResumoCategoria[]> {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('categoria, saldo_atual, preco_custo')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)

  if (error) throw error

  const map: Record<string, ProdutoResumoCategoria> = {}
  for (const p of data || []) {
    const cat = p.categoria || '(sem categoria)'
    if (!map[cat]) {
      map[cat] = { categoria: cat, total_produtos: 0, total_estoque: 0, valor_total: 0 }
    }
    map[cat].total_produtos += 1
    map[cat].total_estoque += Number(p.saldo_atual || 0)
    map[cat].valor_total += Number(p.saldo_atual || 0) * Number(p.preco_custo || 0)
  }

  return Object.values(map)
    .map((v) => ({
      ...v,
      total_estoque: Math.round(v.total_estoque * 100) / 100,
      valor_total: Math.round(v.valor_total * 100) / 100,
    }))
    .sort((a, b) => b.valor_total - a.valor_total)
}
