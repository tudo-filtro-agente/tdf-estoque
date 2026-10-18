import Fastify from 'fastify'

const fastify = Fastify({
  logger: true,
})

fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

fastify.get('/api/ping', async () => {
  return { message: 'Hello from tdf-estoque API', version: '0.0.0' }
})

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' })
    console.log('Server running at http://localhost:3001')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
