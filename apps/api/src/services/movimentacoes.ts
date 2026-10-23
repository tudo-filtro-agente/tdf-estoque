import { supabaseAdmin } from '../db.js'

export interface Movimentacao {
  id: number
  empresa_id: number
  produto_id: number
  tipo: 'entrada' | 'saida' | 'ajuste' | 'inventario'
  quantidade: number
  saldo_anterior?: number
  saldo_posterior?: number
  documento?: string
  observacao?: string
  usuario_id?: number
  created_at: string
}

export interface MovimentacaoComProduto extends Movimentacao {
  produto: { id: number; codigo: string; nome: string; unidade: string } | null
  usuario?: { id: number; nome: string } | null
}

export type TipoMovimentacao = Movimentacao['tipo']

export const TIPOS_MOVIMENTACAO: Array<{ value: TipoMovimentacao; label: string; cor: string; sinal: 1 | -1 | 0 }> = [
  { value: 'entrada', label: 'Entrada', cor: 'green', sinal: 1 },
  { value: 'saida', label: 'Saída', cor: 'red', sinal: -1 },
  { value: 'ajuste', label: 'Ajuste', cor: 'amber', sinal: 0 },
  { value: 'inventario', label: 'Inventário', cor: 'blue', sinal: 1 },
]

export interface ListarMovimentacoesInput {
  empresaId?: number
  produtoId?: number
  tipo?: TipoMovimentacao
  dataInicio?: string
  dataFim?: string
  page?: number
  limit?: number
}

export interface ListarMovimentacoesResult {
  data: MovimentacaoComProduto[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listarMovimentacoes(
  input: ListarMovimentacoesInput
): Promise<ListarMovimentacoesResult> {
  const {
    empresaId = 1,
    produtoId,
    tipo,
    dataInicio,
    dataFim,
    page = 1,
    limit = 50,
  } = input

  let query = supabaseAdmin
    .from('movimentacoes')
    .select(
      `
        id, empresa_id, produto_id, tipo, quantidade,
        saldo_anterior, saldo_posterior,
        documento, observacao, usuario_id, created_at,
        produto:produtos ( id, codigo, nome, unidade ),
        usuario:usuarios ( id, nome )
      `,
      { count: 'exact' }
    )
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (produtoId) query = query.eq('produto_id', produtoId)
  if (tipo) query = query.eq('tipo', tipo)
  if (dataInicio) query = query.gte('created_at', dataInicio)
  if (dataFim) query = query.lte('created_at', dataFim)

  const { data, count, error } = await query

  if (error) throw error

  return {
    data: (data as unknown as MovimentacaoComProduto[]) || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  }
}

export interface CriarMovimentacaoInput {
  empresa_id?: number
  produto_id: number
  tipo: TipoMovimentacao
  quantidade: number
  documento?: string
  observacao?: string
  usuario_id?: number
}

export async function criarMovimentacao(input: CriarMovimentacaoInput): Promise<Movimentacao> {
  const { data, error } = await supabaseAdmin
    .from('movimentacoes')
    .insert({
      empresa_id: input.empresa_id ?? 1,
      produto_id: input.produto_id,
      tipo: input.tipo,
      quantidade: input.quantidade,
      documento: input.documento,
      observacao: input.observacao,
      usuario_id: input.usuario_id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23514') {
      throw new Error('Quantidade deve ser maior que zero')
    }
    if (error.code === '23503') {
      throw new Error('Produto não encontrado')
    }
    throw error
  }

  return data as Movimentacao
}

/**
 * Sumário para o Dashboard: totais por tipo nos últimos N dias.
 */
export interface ResumoMovimentacao {
  tipo: TipoMovimentacao
  total_quantidade: number
  total_movimentos: number
}

export async function resumoMovimentacoes(
  empresaId: number = 1,
  dias: number = 30
): Promise<ResumoMovimentacao[]> {
  const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('movimentacoes')
    .select('tipo, quantidade')
    .eq('empresa_id', empresaId)
    .gte('created_at', dataInicio)

  if (error) throw error

  const grupos: Record<string, ResumoMovimentacao> = {}
  for (const m of data || []) {
    if (!grupos[m.tipo]) {
      grupos[m.tipo] = { tipo: m.tipo as TipoMovimentacao, total_quantidade: 0, total_movimentos: 0 }
    }
    grupos[m.tipo].total_quantidade += Number(m.quantidade)
    grupos[m.tipo].total_movimentos += 1
  }

  return Object.values(grupos)
}

/**
 * Movimentações agrupadas por dia (para o gráfico do Dashboard).
 */
export interface MovimentacaoPorDia {
  dia: string
  entrada: number
  saida: number
}

export async function movimentacoesPorDia(
  empresaId: number = 1,
  dias: number = 30
): Promise<MovimentacaoPorDia[]> {
  const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('movimentacoes')
    .select('tipo, quantidade, created_at')
    .eq('empresa_id', empresaId)
    .gte('created_at', dataInicio)

  if (error) throw error

  const map: Record<string, { entrada: number; saida: number }> = {}
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    map[key] = { entrada: 0, saida: 0 }
  }

  for (const m of data || []) {
    const key = m.created_at.slice(0, 10)
    if (!map[key]) continue
    if (m.tipo === 'entrada' || m.tipo === 'inventario') {
      map[key].entrada += Number(m.quantidade)
    } else if (m.tipo === 'saida') {
      map[key].saida += Number(m.quantidade)
    }
  }

  return Object.entries(map).map(([dia, v]) => ({ dia, ...v }))
}
