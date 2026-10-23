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

export default async function unidadesRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireAuth }, async (_req, reply) => {
    const supabase = getAdmin()

    const { data, error } = await supabase
      .from('unidades')
      .select('*')
      .eq('empresa_id', EMPRESA_ID)
      .order('sigla', { ascending: true })

    if (error) {
      return reply.status(400).send({ message: error.message })
    }

    // Quantos produtos usam cada unidade
    const { data: uso } = await supabase
      .from('produtos')
      .select('unidade')
      .eq('empresa_id', EMPRESA_ID)
      .not('unidade', 'is', null)

    const counts: Record<string, number> = {}
    ;(uso || []).forEach((row: any) => {
      const u = (row.unidade || '').trim().toUpperCase()
      if (!u) return
      counts[u] = (counts[u] || 0) + 1
    })

    const list = (data || []).map((u: any) => ({
      ...u,
      uso_count: counts[(u.sigla || '').toUpperCase()] || 0,
    }))

    return { unidades: list }
  })

  fastify.post(
    '/',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['sigla'],
          properties: {
            sigla: { type: 'string', minLength: 1, maxLength: 8 },
            descricao: { type: 'string' },
            ativa: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        sigla: string
        descricao?: string
        ativa?: boolean
      }
      const supabase = getAdmin()

      const { data, error } = await supabase
        .from('unidades')
        .insert({
          empresa_id: EMPRESA_ID,
          sigla: body.sigla.trim().toUpperCase(),
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

  fastify.put(
    '/:id',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['sigla'],
          properties: {
            sigla: { type: 'string', minLength: 1, maxLength: 8 },
            descricao: { type: 'string' },
            ativa: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        sigla: string
        descricao?: string
        ativa?: boolean
      }
      const supabase = getAdmin()

      const { data, error } = await supabase
        .from('unidades')
        .update({
          sigla: body.sigla.trim().toUpperCase(),
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

  fastify.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = getAdmin()

    const sigla = await getSiglaById(supabase, Number(id))
    if (sigla) {
      const { count } = await supabase
        .from('produtos')
        .select('id', { count: 'exact', head: true })
        .ilike('unidade', sigla)

      if ((count || 0) > 0) {
        return reply.status(400).send({
          message: `Unidade em uso por ${count} produto(s). Inative-a em vez de excluir.`,
        })
      }
    }

    const { error } = await supabase.from('unidades').delete().eq('id', Number(id))
    if (error) {
      return reply.status(400).send({ message: error.message })
    }
    return { message: 'Unidade excluída' }
  })
}

async function getSiglaById(
  supabase: ReturnType<typeof getAdmin>,
  id: number
): Promise<string | null> {
  const { data } = await supabase
    .from('unidades')
    .select('sigla')
    .eq('id', id)
    .single()
  return (data as any)?.sigla ?? null
}