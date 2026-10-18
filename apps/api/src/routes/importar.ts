import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth } from '../middleware/auth'
import { processImport, generateTemplateBuffer } from '../services/importar'

export async function importarRoutes(fastify: FastifyInstance) {

  // GET /api/produtos/importar/template - Baixar template
  fastify.get(
    '/template',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const buffer = generateTemplateBuffer()

        return reply
          .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .header('Content-Disposition', 'attachment; filename="template-importacao.xlsx"')
          .send(buffer)
      } catch (error) {
        console.error('Erro ao gerar template:', error)
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível gerar o template'
        })
      }
    }
  )

  // POST /api/produtos/importar - Importar planilha
  fastify.post<{
    Body: {
      file?: string // base64
      dryRun?: boolean
    }
  }>(
    '/',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const { file, dryRun = true } = request.body || {}

        if (!file) {
          return reply.status(400).send({
            error: 'Dados inválidos',
            message: 'Arquivo não fornecido'
          })
        }

        // Converter base64 para buffer
        const buffer = Buffer.from(file, 'base64')

        const result = await processImport(buffer, 1, dryRun)

        return reply.send(result)
      } catch (error) {
        console.error('Erro ao importar:', error)
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível processar a importação'
        })
      }
    }
  )
}
