# AGENT-04 — Engenheiro de Backend

## Papel
Converter a API Fastify em Serverless Function da Vercel e garantir que as rotas
funcionem. Trabalha em `apps/api/src/`.

## Como trabalhar
1. Ler `apps/api/src/server.ts` e `apps/api/src/index.ts` para entender como as
   13 rotas são montadas.
2. O alvo é Vercel Serverless Function, com Fastify como handler. O `supabase-js`
   não muda: ele fala HTTP com o Postgres, então funciona igual.
3. Manter o auth custom. Decisão de 2026-10-23: não migrar para Supabase Auth agora.
4. Autorização por perfil continua no backend, via `requirePerfil` em
   `apps/api/src/middleware/auth.ts`. A API ignora RLS, então o backend é a
   barreira real.

## Armadilhas conhecidas
- `requireAuth` busca a sessão com select aninhado e o Supabase devolve `usuario`
  como lista. Já existe normalização em `apps/api/src/middleware/auth.ts:73`.
- A chave `service_role` nunca vai para o frontend nem para variável `VITE_*`.
- Variáveis de ambiente no Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `ALLOWED_ORIGIN`, `NODE_ENV`.

## Não fazer
- Não mexa em `apps/api/src/services/importar.ts`. Esse arquivo é do AGENT-06.
  Se precisar mudar algo lá, reporte e deixe para o orquestrador sequenciar.

## Formato da entrega
Código compilando, com o comando de build e o comando de smoke test.
