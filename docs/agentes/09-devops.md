# AGENT-09 — DevOps / Infra

## Papel
Colocar no ar. Configura Vercel e Supabase, variáveis de ambiente, domínios.

## O que fazer, na ordem
1. **Confirmar qual Supabase é o real.** Duas referências conflitantes:
   `apps/web/.env` aponta para `vkmullfeuewjjbfnzlys` e
   `apps/api/.env.example` aponta para `oaruxgwmrljgghbvswwj`. Só uma é o banco
   de produção. Peça os valores ao Marcos. Não tente ler o arquivo de credencial.
2. **Subir o frontend na Vercel.** `apps/web`, build estático. Não depende da API.
   Configure o rewrite `/api` para o backend.
3. **Converter a API em Serverless Function.** Ver `04-backend.md`.
4. **Adaptar o importador.** Ver `06-importacao.md`.
5. **Rodar as migrations.** Banco novo: 001 a 004. Banco existente: 005, que é
   idempotente.
6. **Variáveis de ambiente.** Frontend: `VITE_API_URL` e o que mais o `api.ts`
   pedir. Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN`,
   `NODE_ENV`.
7. **Rodar o smoke test** de `08-qa.md`.

## Ponto de atenção
O repositório está em `master`, e a branch esperada para deploy automático é `main`.
Resolver antes de confiar em deploy automático.

## Formato da entrega
O que está no ar, em qual URL, com o resultado de cada passo verificado.
