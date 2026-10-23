import { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/auth.js'

const EMPRESA_ID = 1 // tudo via DEFAULT

function getAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase não configurado')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export default async function fontesRoutes(fastify: FastifyInstance) {
  // Listar todas as fontes
  fastify.get('/', { preHandler: requireAuth }, async (_req, reply) => {
    const supabase = getAdmin()
    const { data, error } = await supabase
      .from('fontes')
      .select('*')
      .order('codigo', { ascending: true })

    if (error) {
      return reply.status(400).send({ message: error.message })
    }
    return { fontes: data || [] }
  })

  // Obter uma fonte
  fastify.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = getAdmin()
    const { data, error } = await supabase
      .from('fontes')
      .select('*')
      .eq('id', Number(id))
      .single()

    if (error) {
      return reply.status(404).send({ message: error.message })
    }
    return data
  })

  // Criar nova fonte
  fastify.post(
    '/',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['codigo', 'nome', 'tipo'],
          properties: {
            codigo: { type: 'string', minLength: 1, maxLength: 60 },
            nome: { type: 'string', minLength: 1, maxLength: 120 },
            tipo: { type: 'string', enum: ['api', 'arquivo', 'manual'] },
            base_url: { type: 'string' },
            ativa: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        codigo: string
        nome: string
        tipo: 'api' | 'arquivo' | 'manual'
        base_url?: string
        ativa?: boolean
      }

      const supabase = getAdmin()
      const { data, error } = await supabase
        .from('fontes')
        .insert({
          codigo: body.codigo.trim(),
          nome: body.nome.trim(),
          tipo: body.tipo,
          base_url: body.base_url?.trim() || null,
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

  // Atualizar fonte
  fastify.put(
    '/:id',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          required: ['codigo', 'nome', 'tipo'],
          properties: {
            codigo: { type: 'string', minLength: 1, maxLength: 60 },
            nome: { type: 'string', minLength: 1, maxLength: 120 },
            tipo: { type: 'string', enum: ['api', 'arquivo', 'manual'] },
            base_url: { type: 'string' },
            ativa: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        codigo: string
        nome: string
        tipo: 'api' | 'arquivo' | 'manual'
        base_url?: string
        ativa?: boolean
      }

      const supabase = getAdmin()
      const { data, error } = await supabase
        .from('fontes')
        .update({
          codigo: body.codigo.trim(),
          nome: body.nome.trim(),
          tipo: body.tipo,
          base_url: body.base_url?.trim() || null,
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

  // Excluir fonte
  fastify.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const supabase = getAdmin()

    // Não permite excluir se houver produtos referenciando
    const { count } = await supabase
      .from('produtos')
      .select('id', { count: 'exact', head: true })
      .eq('fonte_id', Number(id))

    if ((count || 0) > 0) {
      return reply
        .status(400)
        .send({ message: `Fonte em uso por ${count} produto(s). Inative-a em vez de excluir.` })
    }

    const { error } = await supabase.from('fontes').delete().eq('id', Number(id))
    if (error) {
      return reply.status(400).send({ message: error.message })
    }
    return { message: 'Fonte excluída' }
  })

  // Disparar sincronização (esqueleto: marca ultima_sync)
  fastify.post('/:id/sync', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = getAdmin()

    const { data: fonte, error: fErr } = await supabase
      .from('fontes')
      .select('*')
      .eq('id', Number(id))
      .single()
    if (fErr || !fonte) {
      return reply.status(404).send({ message: 'Fonte não encontrada' })
    }

    if (fonte.tipo !== 'api') {
      return reply
        .status(400)
        .send({ message: 'Sincronização só está habilitada para fontes do tipo API.' })
    }

    // Hooks de sincronização por fonte virão aqui.
    // Por enquanto, registra a tentativa e a falha para o usuário ver no card.
    await supabase
      .from('fontes')
      .update({ ultima_falha: new Date().toISOString() })
      .eq('id', Number(id))

    return reply.status(501).send({
      message: `Sincronização de "${fonte.nome}" ainda não implementada. Configure o integrador.`,
    })
  })
}