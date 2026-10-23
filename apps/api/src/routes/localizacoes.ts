import { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/auth.js'

const EMPRESA_ID = 1

function getAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase não configurado')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export default async function localizacoesRoutes(fastify: FastifyInstance) {
  // Lista as localizações ativas, agregando quantos produtos usam cada uma
  fastify.get('/', { preHandler: requireAuth }, async (_req, reply) => {
    const supabase = getAdmin()

    const { data, error } = await supabase
      .from('localizacoes')
      .select('*')
      .eq('empresa_id', EMPRESA_ID)
      .order('codigo', { ascending: true })

    if (error) {
      return reply.status(400).send({ message: error.message })
    }

    // Conta produtos por localizacao (raw column)
    const { data: uso } = await supabase
      .from('produtos')
      .select('localizacao')
      .eq('empresa_id', EMPRESA_ID)
      .not('localizacao', 'is', null)

    const counts: Record<string, number> = {}
    ;(uso || []).forEach((row: any) => {
      const loc = (row.localizacao || '').trim()
      if (!loc) return
      counts[loc] = (counts[loc] || 0) + 1
    })

    const locs = (data || []).map((l: any) => ({
      ...l,
      uso_count: counts[l.codigo] || 0,
    }))

    return { localizacoes: locs }
  })

  // Cria
  fastify.post(
    '/',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['codigo'],
          properties: {
            codigo: { type: 'string', minLength: 1, maxLength: 60 },
            descricao: { type: 'string' },
            ativa: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        codigo: string
        descricao?: string
        ativa?: boolean
      }
      const supabase = getAdmin()

      const { data, error } = await supabase
        .from('localizacoes')
        .insert({
          empresa_id: EMPRESA_ID,
          codigo: body.codigo.trim(),
          descricao: body.descricao?.trim() || null,
          ativa: body.ativa ?? true,
        })
        .select()
        .single()

      if (error) {
        return reply.status(400).send({ message: error.message })
      }
      return reply.status(201).send(data)
    }
  )

  // Atualiza
  fastify.put(
    '/:id',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['codigo'],
          properties: {
            codigo: { type: 'string', minLength: 1, maxLength: 60 },
            descricao: { type: 'string' },
            ativa: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        codigo: string
        descricao?: string
        ativa?: boolean
      }
      const supabase = getAdmin()

      const { data, error } = await supabase
        .from('localizacoes')
        .update({
          codigo: body.codigo.trim(),
          descricao: body.descricao?.trim() || null,
          ativa: body.ativa ?? true,
        })
        .eq('id', Number(id))
        .select()
        .single()

      if (error) {
        return reply.status(400).send({ message: error.message })
      }
      return data
    }
  )

  // Exclui
  fastify.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = getAdmin()

    const { count } = await supabase
      .from('produtos')
      .select('id', { count: 'exact', head: true })
      .eq('localizacao', (await getCodigoById(supabase, Number(id))) || '')

    if ((count || 0) > 0) {
      return reply.status(400).send({
        message: `Localização em uso por ${count} produto(s). Inative-a em vez de excluir.`,
      })
    }

    const { error } = await supabase
      .from('localizacoes')
      .delete()
      .eq('id', Number(id))

    if (error) {
      return reply.status(400).send({ message: error.message })
    }
    return { message: 'Localização excluída' }
  })
}

async function getCodigoById(
  supabase: ReturnType<typeof getAdmin>,
  id: number
): Promise<string | null> {
  const { data } = await supabase
    .from('localizacoes')
    .select('codigo')
    .eq('id', id)
    .single()
  return (data as any)?.codigo ?? null
}