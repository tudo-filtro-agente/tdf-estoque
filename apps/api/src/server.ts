import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { config } from './config'
import { healthRoutes } from './routes/health'
import { bootstrapRoutes } from './routes/bootstrap'
import { authRoutes } from './routes/auth'
import { produtosRoutes } from './routes/produtos'

export async function buildServer() {
  const fastify = Fastify({
    logger: true,
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
