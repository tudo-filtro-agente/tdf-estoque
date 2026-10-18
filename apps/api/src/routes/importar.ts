import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth } from '../middleware/auth'
import { processImport, processAllSheets, generateTemplateBuffer, generateTDFTemplateBuffer, parseExcel } from '../services/importar'

export async function importarRoutes(fastify: FastifyInstance) {

  // GET /api/produtos/importar/template - Baixar template genérico
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

  // GET /api/produtos/importar/template-tdf - Baixar template específico TDF
  fastify.get(
    '/template-tdf',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const buffer = generateTDFTemplateBuffer()

        return reply
          .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .header('Content-Disposition', 'attachment; filename="template-tdf-estoque.xlsx"')
          .send(buffer)
      } catch (error) {
        console.error('Erro ao gerar template TDF:', error)
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível gerar o template'
        })
      }
    }
  )

  // GET /api/produtos/importar/sheets - Listar abas da planilha
  fastify.get(
    '/sheets',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // Pegar o arquivo do body do último POST ou param
        const { file } = request.query as { file?: string }

        if (!file) {
          return reply.status(400).send({
            error: 'Dados inválidos',
            message: 'Arquivo não fornecido (enviar base64 como query param ?file=...)'
          })
        }

        const buffer = Buffer.from(file, 'base64')
        const parsed = parseExcel(buffer)

        const sheets = parsed.allSheets.map(s => ({
          name: s.name,
          rowCount: s.rows.length,
          columns: s.headers.slice(0, 10) // primeiras 10 colunas
        }))

        return reply.send({ sheets })
      } catch (error) {
        console.error('Erro ao listar abas:', error)
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível analisar a planilha'
        })
      }
    }
  )

  // POST /api/produtos/importar - Importar planilha
  fastify.post<{
    Body: {
      file?: string // base64
      dryRun?: boolean
      sheet?: string // nome da aba específica (opcional)
      allSheets?: boolean // importar todas as abas
    }
  }>(
    '/',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const { file, dryRun = true, sheet, allSheets = false } = request.body || {}

        if (!file) {
          return reply.status(400).send({
            error: 'Dados inválidos',
            message: 'Arquivo não fornecido'
          })
        }

        const buffer = Buffer.from(file, 'base64')

        let result

        if (allSheets) {
          // Importar todas as abas
          const allResults = await processAllSheets(buffer, 1, dryRun)

          return reply.send({
            ...allResults,
            dryRun,
            message: dryRun
              ? `Dry-run: ${allResults.summary.importados} produtos serão importados de ${allResults.results.length} abas`
              : `${allResults.summary.importados} produtos importados de ${allResults.results.length} abas`
          })
        } else {
          // Importar uma aba específica ou a primeira
          result = await processImport(buffer, 1, dryRun, sheet)

          return reply.send({
            ...result,
            dryRun,
            message: dryRun
              ? `Dry-run: ${result.importados} produtos serão importados da aba "${result.sheet}"`
              : `${result.importados} produtos importados da aba "${result.sheet}"`
          })
        }
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
