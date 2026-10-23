import { supabaseAdmin } from '../db.js'
import { obterDoCache, guardarNoCache, invalidarCache } from './loginCache.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const DOMINIO_PERMITIDO = '@tudodefiltro.com.br'
const SALT_ROUNDS = 10

export interface LoginInput {
  email: string
  senha: string
}

export interface RegisterInput {
  nome: string
  email: string
  senha: string
}

export interface AuthResult {
  success: boolean
  token?: string
  usuario?: {
    id: number
    nome: string
    email: string
    perfil: string
  }
  error?: string
  /**
   * Marca falha por cota do Supabase (HTTP 429), e não por credencial.
   * A rota usa isso para responder 503 em vez de 401, para que o frontend
   * não peça para o usuário conferir a senha quando o problema é o servidor.
   */
  erroCota?: boolean
}

/**
 * Valida se o email pertence ao domínio permitido
 */
export function isDomainAllowed(email: string): boolean {
  return email.toLowerCase().endsWith(DOMINIO_PERMITIDO)
}

/**
 * Registra um novo usuário. Apenas emails do domínio @tudodefiltro.com.br são aceitos.
 */
export async function register(input: RegisterInput): Promise<AuthResult> {
  const { nome, email, senha } = input

  // Validações
  if (!nome || !email || !senha) {
    return { success: false, error: 'Nome, email e senha são obrigatórios' }
  }

  if (nome.trim().length < 3) {
    return { success: false, error: 'Nome deve ter pelo menos 3 caracteres' }
  }

  if (!isDomainAllowed(email)) {
    return {
      success: false,
      error: `Apenas emails do domínio ${DOMINIO_PERMITIDO} podem se cadastrar`,
    }
  }

  if (senha.length < 6) {
    return { success: false, error: 'Senha deve ter pelo menos 6 caracteres' }
  }

  // Verificar se email já existe
  const { data: existing } = await supabaseAdmin
    .from('usuarios')
    .select('id')
    .eq('email', email.toLowerCase())
    .single()

  if (existing) {
    return { success: false, error: 'Este email já está cadastrado' }
  }

  // Criptografar senha
  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS)

  // Criar usuário (perfil padrão: estoquista)
  const { data: usuario, error } = await supabaseAdmin
    .from('usuarios')
    .insert({
      nome: nome.trim(),
      email: email.toLowerCase(),
      senha_hash: senhaHash,
      perfil: 'estoquista', // padrão - admin só é criado manualmente
      ativo: true,
    })
    .select('id, nome, email, perfil')
    .single()

  if (error || !usuario) {
    console.error('Erro ao criar usuário:', error)
    return { success: false, error: 'Erro ao criar usuário. Tente novamente.' }
  }

  // Fazer login automático após registro
  return await login({ email: usuario.email, senha })
}

/**
 * Autentica um usuário com email e senha
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, senha } = input

  if (!email || !senha) {
    return { success: false, error: 'Email e senha são obrigatórios' }
  }

  // Buscar usuário com senha_hash
  const { data: usuario, error: userError } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, perfil, ativo, senha_hash')
    .eq('email', email.toLowerCase())
    .single()

  if (userError || !usuario) {
    return { success: false, error: 'Email ou senha incorretos' }
  }

  if (!usuario.ativo) {
    return { success: false, error: 'Usuário desativado. Contate o administrador.' }
  }

  // Verificar senha
  if (!usuario.senha_hash) {
    return {
      success: false,
      error: 'Senha não configurada. Use "Esqueci minha senha" para definir uma nova.',
    }
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash)
  if (!senhaCorreta) {
    return { success: false, error: 'Email ou senha incorretos' }
  }

  // Gerar token de sessão
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
    },
  }
}

/**
 * Encerra a sessão do usuário
 */
export async function logout(token: string): Promise<boolean> {
  const tokenHash = hashToken(token)

  const { error } = await supabaseAdmin
    .from('sessoes')
    .update({ revogada_em: new Date().toISOString() })
    .eq('token_hash', tokenHash)

  return !error
}

/**
 * Busca usuário pelo token
 */
export async function getUsuarioByToken(token: string) {
  const tokenHash = hashToken(token)

  const { data: session } = await supabaseAdmin
    .from('sessoes')
    .select(`
      usuario:usuarios (
        id,
        nome,
        email,
        perfil,
        ativo
      )
    `)
    .eq('token_hash', tokenHash)
    .is('revogada_em', null)
    .gt('expira_em', new Date().toISOString())
    .single()

  return session?.usuario
}

/**
 * Inicia fluxo de recuperação de senha.
 * Gera um token temporário (válido por 1h) que o usuário pode usar para redefinir.
 * Em produção, isso enviaria um email - aqui retornamos o token pra teste.
 */
export interface ResetResult {
  success: boolean
  resetToken?: string
  message?: string
  error?: string
}

export async function requestPasswordReset(email: string): Promise<ResetResult> {
  if (!email) {
    return { success: false, error: 'Email é obrigatório' }
  }

  if (!isDomainAllowed(email)) {
    return {
      success: false,
      error: `Apenas emails do domínio ${DOMINIO_PERMITIDO} são aceitos`,
    }
  }

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email')
    .eq('email', email.toLowerCase())
    .eq('ativo', true)
    .single()

  // Por segurança, sempre retornamos sucesso mesmo se o email não existir
  if (!usuario) {
    return {
      success: true,
      message: 'Se o email estiver cadastrado, você receberá as instruções de redefinição.',
    }
  }

  // Gerar token de reset (válido por 1 hora)
  const resetToken = crypto.randomBytes(32).toString('hex')
  const expiraEm = new Date(Date.now() + 60 * 60 * 1000) // 1h

  // Salvar token na tabela sessoes com tipo 'reset'
  // (Reutilizamos a tabela sessoes - em produção idealmente teria tabela separada)
  const { error } = await supabaseAdmin.from('sessoes').insert({
    usuario_id: usuario.id,
    token_hash: hashToken(resetToken),
    csrf_token: 'reset',
    expira_em: expiraEm.toISOString(),
  })

  if (error) {
    console.error('Erro ao criar token de reset:', error)
    return { success: false, error: 'Erro ao processar solicitação' }
  }

  // Em produção: enviar email com link de redefinição
  // Aqui retornamos o token para testes
  return {
    success: true,
    resetToken, // Apenas para desenvolvimento
    message: `Token de redefinição gerado para ${usuario.email}. Em produção, seria enviado por email.`,
  }
}

/**
 * Redefine a senha usando o token de reset
 */
export async function resetPassword(
  resetToken: string,
  novaSenha: string
): Promise<AuthResult> {
  if (!resetToken || !novaSenha) {
    return { success: false, error: 'Token e nova senha são obrigatórios' }
  }

  if (novaSenha.length < 6) {
    return { success: false, error: 'Senha deve ter pelo menos 6 caracteres' }
  }

  // Buscar sessão de reset
  const { data: session } = await supabaseAdmin
    .from('sessoes')
    .select('usuario_id, expira_em')
    .eq('token_hash', hashToken(resetToken))
    .eq('csrf_token', 'reset')
    .is('revogada_em', null)
    .gt('expira_em', new Date().toISOString())
    .single()

  if (!session) {
    return { success: false, error: 'Token inválido ou expirado' }
  }

  // Atualizar senha
  const senhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS)
  const { data: usuarioAtualizado, error } = await supabaseAdmin
    .from('usuarios')
    .update({ senha_hash: senhaHash })
    .eq('id', session.usuario_id)
    .select('email')
    .single()

  if (error) {
    console.error('Erro ao atualizar senha:', error)
    return { success: false, error: 'Erro ao atualizar senha' }
  }

  // A senha mudou: o cache de login não pode mais validar esta senha antiga.
  if (usuarioAtualizado?.email) {
    invalidarCache(usuarioAtualizado.email)
  }

  // Invalidar todos os tokens de reset deste usuário
  await supabaseAdmin
    .from('sessoes')
    .update({ revogada_em: new Date().toISOString() })
    .eq('usuario_id', session.usuario_id)
    .eq('csrf_token', 'reset')

  return { success: true }
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
