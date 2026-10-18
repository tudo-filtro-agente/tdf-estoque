import { FastifyInstance } from 'fastify'
import { supabase } from '../db'

export async function bootstrapRoutes(fastify: FastifyInstance) {
  fastify.get('/api/bootstrap', async () => {
    // Buscar fontes disponíveis
    const { data: fontes } = await supabase
      .from('fontes')
      .select('id, codigo, nome, tipo')
      .eq('ativa', true)

    return {
      empresa: 'TDF Controle de Estoque',
      versao: '1.0.0',
      fontes: fontes || [],
    }
  })
}
