# Plano de Deploy — TDF Estoque

> Decisão de arquitetura de deploy, com os limites reais que a justificam.
> Substitui a seção de deploy de `PLANO-FASE-1-ORIGINAL.md`, que apontava para Railway.

## Decisão

**Frontend na Vercel. Backend e banco no Supabase. Railway não é usado neste projeto.**

O plano original (outubro/2026) dizia Edge Functions para o backend. A recomendação
foi revista em 2026-10-23 depois de conferir os limites reais de plataforma.

## Por que Edge Functions não é o caminho

O importador de planilha é o gargalo, não as rotas CRUD.

| Limite | Valor | Consequência no Estoque |
|---|---|---|
| Edge Functions, corpo da requisição | 10 MB | O importador envia XLSX de até 50 MB em base64. Estoura. |
| Edge Functions, memória | 256 MB | Parser XLSX de planilha grande estoura. |
| Edge Functions, tempo | 150 s (free) / 400 s (pago) | Catálogo completo não termina. |
| Edge Functions, bundle | 5 MB server-side / 20 MB local | `xlsx` e `exceljs` somam. |

Rotas CRUD como listar produtos, registrar movimentação e gerar relatório rodam
bem em Edge Function. Importação não.

## A alternativa recomendada: Vercel Serverless

| Limite | Valor | Consequência |
|---|---|---|
| Vercel Hobby, tempo | 300 s (5 min) | Corta importação grande. |
| Vercel Pro, tempo | 800 s | Comfortável para importação. |
| Vercel Pro, tempo estendido | até 1800 s (beta) | Folga para o pior caso. |

Custo: USD 20/mês no plano Pro. A alternativa é Edge Functions no Supabase Free,
que exige reescrever o importador para upload via Storage e processar em lotes.

**Escolha depende de uma coisa: quanto tempo o importador leva com o catálogo real.**
Medir antes de escolher. Com 800 s de folga, Vercel Pro entrega mais simples.

## Auth: manter custom

O código tem bcrypt, tabela `sessoes`, token com hash e três perfis. Migrar para
Supabase Auth agora é risco sem ganho, porque o problema do deploy não é
autenticação. Manter até o sistema estar no ar e estável.

## Ordem de execução

1. **Descobrir o Supabase real.** Existem duas referências conflitantes:
   - `apps/web/.env` → `vkmullfeuewjjbfnzlys`
   - `apps/api/.env.example` → `oaruxgwmrljgghbvswwj`
   Só uma é o banco de produção. Ler `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
   Não conseguir ler o arquivo de credencial: o classificador barra. Pedir ao Marcos.

2. **Subir o frontend na Vercel.** É SPA estático, não depende da API para build.
   Vai no ar antes de qualquer backend. URL de preview para revisar as 12 telas.

3. **Converter a API para Serverless Function.** Fastify vira handler, os 13
   arquivos de rota viram funções. `supabase-js` continua igual, porque fala HTTP
   com o Postgres. Mecânico, sem reescrever regra de negócio.

4. **Adaptar o importador.** Upload direto ao Supabase Storage, a função recebe a
   referência do arquivo e faz o bulk insert a partir dela. Evita o limite de corpo.

5. **Rodar as migrations.** `001` a `004` para banco novo. `005` para o banco que
   já existe, e é idempotente, pode rodar quantas vezes quiser.

6. **Configurar as variáveis de ambiente** nos dois painéis e validar com um smoke
   test: login, listar produtos, registrar movimentação, ver o saldo mudar.

## Riscos

- **Dois projetos Supabase.** Se apontar para o errado, a API sobe e não vê dado.
  Passo 1 existe por isso.
- **Branch.** O repositório está em `master`. O README diz `main`. Confirmar qual
  a Vercel vai observar antes de confiar no deploy automático.
- **`service_role` no frontend.** Nunca. A chave vive só na plataforma de backend.
- **Importador em base64.** Enquanto não for o Storage, o upload estoura o limite.
