import { supabaseAdmin } from '../db'

export interface Produto {
  id: number
  empresa_id: number
  codigo: string
  nome: string
  descricao?: string
  unidade: string
  categoria?: string
  ncm?: string
  gtin?: string
  preco_custo?: number
  preco_venda?: number
  markup_padrao?: number
  estoque_minimo?: number
  estoque_maximo?: number
  localizacao?: string
  ativo: boolean
  created_at: string
  updated_at?: string
}

export interface ListProdutosInput {
  empresaId?: number
  categoria?: string
  busca?: string
  ativo?: boolean
  page?: number
  limit?: number
}

export interface ListProdutosResult {
  data: Produto[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listProdutos(input: ListProdutosInput): Promise<ListProdutosResult> {
  const {
    empresaId = 1,
    categoria,
    busca,
    ativo = true,
    page = 1,
    limit = 20
  } = input

  let query = supabaseAdmin
    .from('produtos')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('ativo', ativo)
    .order('nome')
    .range((page - 1) * limit, page * limit - 1)

  if (categoria) {
    query = query.eq('categoria', categoria)
  }

  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%`)
  }

  const { data, count, error } = await query

  if (error) throw error

  return {
    data: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  }
}

export async function getProduto(id: number): Promise<Produto | null> {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export interface CreateProdutoInput {
  empresa_id: number
  codigo: string
  nome: string
  descricao?: string
  unidade?: string
  categoria?: string
  ncm?: string
  gtin?: string
  preco_custo?: number
  preco_venda?: number
  markup_padrao?: number
  estoque_minimo?: number
  estoque_maximo?: number
  localizacao?: string
  fonte_id?: number
  id_origem?: string
}

export async function createProduto(input: CreateProdutoInput): Promise<Produto> {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .insert(input)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Código do produto já existe para esta empresa')
    }
    throw error
  }

  return data
}

export async function updateProduto(id: number, input: Partial<CreateProdutoInput>): Promise<Produto> {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Código do produto já existe para esta empresa')
    }
    throw error
  }

  return data
}

export async function deleteProduto(id: number): Promise<void> {
  // Soft delete
  const { error } = await supabaseAdmin
    .from('produtos')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export const produtosService = {
  async listarProdutos(params: { fonteId?: string; pagina?: number; limite?: number }) {
    const { pagina = 1, limite = 50 } = params
    const result = await listProdutos({
      page: pagina,
      limit: limite,
    })
    return {
      produtos: result.data,
      total: result.total,
      pagina: result.page,
      limite: result.limit,
    }
  },

  async buscarProduto(id: string) {
    return await getProduto(parseInt(id))
  },

  async criarProduto(data: Record<string, unknown>) {
    return await createProduto(data as CreateProdutoInput)
  },

  async atualizarProduto(id: string, data: Record<string, unknown>) {
    return await updateProduto(parseInt(id), data as Partial<CreateProdutoInput>)
  },

  async deletarProduto(id: string) {
    await deleteProduto(parseInt(id))
  },
}

export async function getCategorias(empresaId: number = 1): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('categoria')
    .eq('empresa_id', empresaId)
    .not('categoria', 'is', null)
    .eq('ativo', true)

  if (error) return []

  const categorias = [...new Set(data?.map(p => p.categoria).filter(Boolean) as string[])]
  return categorias.sort()
}
