import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { config } from './config.js'
import { healthRoutes } from './routes/health.js'
import { bootstrapRoutes } from './routes/bootstrap.js'
import { authRoutes } from './routes/auth.js'
import { produtosRoutes } from './routes/produtos.js'
import { importarRoutes } from './routes/importar.js'
import { movimentacoesRoutes } from './routes/movimentacoes.js'
import { categoriasRoutes } from './routes/categorias.js'
import { usuariosRoutes } from './routes/usuarios.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { relatoriosRoutes } from './routes/relatorios.js'
import fontesRoutes from './routes/fontes.js'
import localizacoesRoutes from './routes/localizacoes.js'
import unidadesRoutes from './routes/unidades.js'

export async function buildServer() {
  const fastify = Fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024, // 50MB - suporta planilhas grandes em base64
  })

  // Plugins
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  })

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  })

  // Routes
  await fastify.register(healthRoutes)
  await fastify.register(bootstrapRoutes)
  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(produtosRoutes, { prefix: '/api/produtos' })
  await fastify.register(importarRoutes, { prefix: '/api/produtos/importar' })
  await fastify.register(movimentacoesRoutes, { prefix: '/api/movimentacoes' })
  await fastify.register(categoriasRoutes, { prefix: '/api/categorias' })
  await fastify.register(usuariosRoutes, { prefix: '/api/usuarios' })
  await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' })
  await fastify.register(relatoriosRoutes, { prefix: '/api/relatorios' })
  await fastify.register(fontesRoutes, { prefix: '/api/fontes' })
  await fastify.register(localizacoesRoutes, { prefix: '/api/localizacoes' })
  await fastify.register(unidadesRoutes, { prefix: '/api/unidades' })

  return fastify
}

export async function startServer() {
  const fastify = await buildServer()

  try {
    await fastify.listen({
      port: config.api.port,
      host: config.api.host,
    })
    console.log(`Server running at http://${config.api.host}:${config.api.port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }

  return fastify
}
