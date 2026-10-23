# CLAUDE.md — TDF Estoque

Sistema de controle de estoque da Tudo de Filtro (TDF). Filtros e tratamento de água.
São José dos Campos, SP. CNPJ 52.790.081/0001-74.

## LEIA ANTES DE PLANEJAR DEPLOY

**O deploy deste projeto é GitHub + Supabase + Vercel. Railway NÃO é usado aqui.**
Railway pertence ao `tdf-financeiro` e ao `tdf-banco-api`, que são projetos separados.

| Camada | Onde roda |
|---|---|
| Frontend | Vercel (`apps/web`, React + Vite, build estático) |
| Backend | Supabase Edge Functions (alvo) — hoje Fastify local |
| Banco | Supabase Postgres |
| Auth | Supabase Auth (alvo) — hoje custom com bcrypt |

Se você encontrar `railway.toml`, `Dockerfile` com `EXPOSE 3001`, ou um README dizendo
Railway, trate como resíduo errado. O `railway.toml` já foi removido em 2026-10-23.

## Onde o código diverge do plano

These three gaps are known and open:

1. **Sem Edge Functions.** `apps/api/supabase/` contém apenas `migrations/`. A API é
   Fastify em escuta contínua na porta 3001 (`apps/api/src/server.ts`), com CORS via
   `@fastify/cors` e `helmet`. Isso não roda na Vercel nem em Edge Functions.
2. **Auth custom.** `apps/api/src/services/auth.ts` usa `bcrypt` e a tabela `sessoes`
   própria, com token hashado. O plano era Supabase Auth.
3. **Importador de planilha.** Aceita XLSX de até 50 MB em base64 no corpo da requisição.
   Edge Functions têm limite de payload muito menor. Vai precisar de upload direto ao
   Supabase Storage, com a função recebendo a referência do arquivo em vez do bytes.

## Bloqueio ativo: qual é o Supabase real

Existem duas referências conflitantes e só uma é o banco de produção:

- `apps/web/.env` aponta para o projeto `vkmullfeuewjjbfnzlys`
- `apps/api/.env.example` aponta para o projeto `oaruxgwmrljgghbvswwj`

Não tente ler o `service_role` key: leitura de credencial é barrada pelo classificador de
segurança. Peça ao Marcos o valor de `SUPABASE_URL` e a `SUPABASE_SERVICE_ROLE_KEY` em
plain text para configurar na plataforma.

## Estrutura

```
tdf-estoque/
├── apps/
│   ├── web/     React 19 + Vite + Tailwind v3 + TanStack Query. 12 páginas em src/routes/
│   └── api/     Fastify + supabase-js. 13 rotas, 8 services, 5 migrations.
└── .env.example
```

### Migrations (`apps/api/supabase/migrations/`)

| Arquivo | O que faz |
|---|---|
| `001_initial_schema.sql` | empresas, fontes, usuarios, sessoes, produtos |
| `002_estoque_tables.sql` | saldo_atual, categorias, localizacoes, movimentacoes, trigger de saldo |
| `003_unidades.sql` | tabela de unidades |
| `004_limpar_policies_rls.sql` | limpeza de policies |
| `005_sincronizar_schema_live.sql` | idempotente; sincroniza o schema do banco que já existia. Rode esta em banco antigo. |

### Perfis de usuário

`administrador`, `estoquista`, `financeiro`. Autorização é feita no backend, via
`requirePerfil` em `apps/api/src/middleware/auth.ts`. A API usa `service_role` e ignora
RLS, então as policies do banco são apenas uma segunda barreira para acesso direto.

## Regras do domínio

- O saldo vem **exclusivamente** de movimentações registradas localmente. Nenhuma consulta
  pode depender só da OMIE ou do Zoho.
- `saldo_atual` em `produtos` é denormalizado e mantido por trigger. Apagar uma
  movimentação direto no banco não reverte o saldo; a correção é por `tipo=ajuste`.
- A API usa `service_role`. Nunca exponha essa chave no frontend nem em variável `VITE_*`.

## Estado do repositório

Branch padrão esperada para deploy automático é `main`, mas o repositório está em `master`.
Verifique antes de assumir que o push dispara deploy.

## Referências

Memória do projeto em `~/.claude/projects/C--Users-User-Downloads/memory/`:
`tdf-estoque-deploy-vercel-supabase.md`, `tdf-estoque-contexto.md`,
`tdf-estoque-sessao-2026-10.md`.