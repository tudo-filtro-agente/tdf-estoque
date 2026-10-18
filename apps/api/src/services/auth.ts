import { supabaseAdmin } from '../db'
import crypto from 'crypto'

export interface LoginInput {
  email: string
  senha: string
}

export interface LoginResult {
  success: boolean
  token?: string
  usuario?: {
    id: number
    nome: string
    email: string
    perfil: string
  }
  error?: string
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const { email, senha } = input

  // Buscar usuário
  const { data: usuario, error: userError } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, perfil')
    .eq('email', email)
    .eq('ativo', true)
    .single()

  if (userError || !usuario) {
    return { success: false, error: 'Credenciais inválidas' }
  }

  // Gerar token
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const csrfToken = crypto.randomBytes(16).toString('hex')
  const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

  // Criar sessão
  const { error: sessionError } = await supabaseAdmin
    .from('sessoes')
    .insert({
      usuario_id: usuario.id,
      token_hash: tokenHash,
      csrf_token: csrfToken,
      expira_em: expiraEm.toISOString(),
    })

  if (sessionError) {
    console.error('Erro ao criar sessão:', sessionError)
    return { success: false, error: 'Erro ao criar sessão' }
  }

  // Atualizar último login
  await supabaseAdmin
    .from('usuarios')
    .update({ ultimo_login: new Date().toISOString() })
    .eq('id', usuario.id)

  return {
    success: true,
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    }
  }
}

export async function logout(token: string): Promise<boolean> {
  const tokenHash = hashToken(token)

  const { error } = await supabaseAdmin
    .from('sessoes')
    .update({ revogada_em: new Date().toISOString() })
    .eq('token_hash', tokenHash)

  return !error
}

export async function getUsuarioByToken(token: string) {
  const tokenHash = hashToken(token)

  const { data: session } = await supabaseAdmin
    .from('sessoes')
    .select(`
      usuario:usuarios (
        id,
        nome,
        email,
        perfil
      )
    `)
    .eq('token_hash', tokenHash)
    .is('revogada_em', null)
    .gt('expira_em', new Date().toISOString())
    .single()

  return session?.usuario
}

function hashToken(token: string): string {
  let hash = 0
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}
