import { FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '../db.js'

export interface AuthUser {
  id: number
  email: string
  nome: string
  perfil: string
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: AuthUser
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Não autorizado',
      message: 'Token de autenticação não fornecido'
    })
  }

  const token = authHeader.substring(7)

  try {
    // Verificar sessão no banco
    const { data: session, error } = await supabaseAdmin
      .from('sessoes')
      .select(`
        id,
        expira_em,
        revogada_em,
        usuario:usuarios (
          id,
          email,
          nome,
          perfil
        )
      `)
      .eq('token_hash', hashToken(token))
      .single()

    if (error || !session) {
      return reply.status(401).send({
        error: 'Não autorizado',
        message: 'Sessão inválida'
      })
    }

    if (new Date(session.expira_em) < new Date()) {
      return reply.status(401).send({
        error: 'Sessão expirada',
        message: 'Faça login novamente'
      })
    }

    if (session.revogada_em) {
      return reply.status(401).send({
        error: 'Sessão revogada',
        message: 'Faça login novamente'
      })
    }

    // O select aninhado do Supabase devolve o usuario como lista;
    // normalizamos para o objeto unico esperado por AuthUser.
    const usuario = (Array.isArray(session.usuario)
      ? session.usuario[0]
      : session.usuario) as unknown as AuthUser

    if (!usuario) {
      return reply.status(401).send({
        error: 'Não autorizado',
        message: 'Sessão inválida'
      })
    }

    request.usuario = usuario

  } catch (err) {
    return reply.status(401).send({
      error: 'Erro de autenticação',
      message: 'Não foi possível verificar a sessão'
    })
  }
}

// Hash simples para token (em produção use bcrypt ou similar)
function hashToken(token: string): string {
  let hash = 0
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}

/**
 * Exige que o usuário autenticado tenha um dos perfis informados.
 * Usar SEMPRE depois de requireAuth — não verifica token sozinho.
 *
 * A API usa service_role (bypassa RLS), então toda autorização de perfil
 * acontece aqui no backend, não no banco.
 */
export function requirePerfil(perfis: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const usuario = request.usuario

    if (!usuario) {
      return reply.status(401).send({
        error: 'Não autorizado',
        message: 'Token de autenticação não fornecido'
      })
    }

    if (!perfis.includes(usuario.perfil)) {
      return reply.status(403).send({
        error: 'Acesso negado',
        message: `Esta ação exige perfil: ${perfis.join(' ou ')}`
      })
    }
  }
}
