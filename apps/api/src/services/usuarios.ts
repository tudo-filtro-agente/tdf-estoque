import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../db.js'
import { invalidarCache } from './loginCache.js'

export interface Usuario {
  id: number
  nome: string
  email: string
  perfil: 'administrador' | 'estoquista' | 'financeiro'
  ativo: boolean
  ultimo_login?: string
  created_at: string
}

export const PERFIS: Usuario['perfil'][] = ['administrador', 'estoquista', 'financeiro']

export async function listarUsuarios(): Promise<Omit<Usuario, 'senha_hash'>[]> {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, perfil, ativo, ultimo_login, created_at')
    .order('nome')

  if (error) throw error
  return (data || []) as Omit<Usuario, 'senha_hash'>[]
}

export async function buscarUsuario(id: number): Promise<Omit<Usuario, 'senha_hash'> | null> {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, perfil, ativo, ultimo_login, created_at')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Omit<Usuario, 'senha_hash'>
}

export async function criarUsuario(input: {
  nome: string
  email: string
  senha: string
  perfil: Usuario['perfil']
}): Promise<Usuario> {
  if (!input.email.toLowerCase().endsWith('@tudodefiltro.com.br')) {
    throw new Error('Apenas e-mails @tudodefiltro.com.br são permitidos')
  }
  if (input.senha.length < 6) {
    throw new Error('Senha deve ter pelo menos 6 caracteres')
  }
  if (!PERFIS.includes(input.perfil)) {
    throw new Error('Perfil inválido')
  }

  const senha_hash = await bcrypt.hash(input.senha, 10)

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .insert({
      nome: input.nome,
      email: input.email,
      senha_hash,
      perfil: input.perfil,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('E-mail já cadastrado')
    }
    throw error
  }
  return data as Usuario
}

export async function atualizarUsuario(
  id: number,
  input: { nome?: string; perfil?: Usuario['perfil']; ativo?: boolean }
): Promise<Usuario> {
  if (input.perfil && !PERFIS.includes(input.perfil)) {
    throw new Error('Perfil inválido')
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // Perfil, nome ou status ativo mudaram: o cache de login guarda esses
  // campos junto, então a próxima entrada precisa reler do banco.
  invalidarCache(data.email)

  return data as Usuario
}

export async function redefinirSenha(id: number, novaSenha: string): Promise<void> {
  if (novaSenha.length < 6) {
    throw new Error('Senha deve ter pelo menos 6 caracteres')
  }
  const senha_hash = await bcrypt.hash(novaSenha, 10)

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({ senha_hash })
    .eq('id', id)
    .select('email')
    .single()

  if (error) throw error

  // Senha nova: o cache ainda valida a senha antiga, precisa sair.
  if (data?.email) {
    invalidarCache(data.email)
  }
}

export async function desativarUsuario(id: number): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({ ativo: false })
    .eq('id', id)
    .select('email')
    .single()

  if (error) throw error

  // Usuário desativado: não pode mais entrar pelo cache.
  if (data?.email) {
    invalidarCache(data.email)
  }
}
