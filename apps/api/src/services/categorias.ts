import { supabaseAdmin } from '../db.js'

export interface Categoria {
  id: number
  empresa_id: number
  nome: string
  descricao?: string
  ativa: boolean
  created_at: string
}

export async function listarCategorias(empresaId: number = 1): Promise<Categoria[]> {
  const { data, error } = await supabaseAdmin
    .from('categorias')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nome')

  if (error) throw error
  return (data || []) as Categoria[]
}

export async function criarCategoria(
  input: { empresa_id?: number; nome: string; descricao?: string }
): Promise<Categoria> {
  const { data, error } = await supabaseAdmin
    .from('categorias')
    .insert({
      empresa_id: input.empresa_id ?? 1,
      nome: input.nome,
      descricao: input.descricao,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Já existe uma categoria com este nome')
    }
    throw error
  }
  return data as Categoria
}

export async function atualizarCategoria(
  id: number,
  input: { nome?: string; descricao?: string; ativa?: boolean }
): Promise<Categoria> {
  const { data, error } = await supabaseAdmin
    .from('categorias')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Já existe uma categoria com este nome')
    }
    throw error
  }
  return data as Categoria
}

export async function desativarCategoria(id: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('categorias')
    .update({ ativa: false })
    .eq('id', id)

  if (error) throw error
}
