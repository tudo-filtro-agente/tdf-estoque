# Plano da Operação — 12 Agentes

> Documento de referência do plano de execução multi-agente do TDF Estoque.
> Fonte: restaurado da conversa do orquestrador em 2026-10-23. Nenhuma informação
> deste plano deve viver apenas em conversa.

## Contexto

O projeto TDF Estoque já tem a aplicação construída (API Fastify, 12 páginas no
frontend, 5 migrations, importador de planilha multi-aba). O plano dos 12 agentes
foi criado para executar a fase de deploy e consolidação, não para construir do zero.

A estratégia do orquestrador: 12 agentes com papéis distintos, executados em
dependência parcial. Agentes que leem o mesmo domínio rodam em paralelo; agentes
que escrevem no mesmo arquivo rodam em sequência.

## Os 12 papéis

| # | Agente | Papel | Depende de | Entrega |
|---|---|---|---|---|
| 01 | Analista de Requisitos | Levanta escopo, gaps e critérios de aceite | — | escopo priorizado |
| 02 | Arquiteto de Software | Desenha a arquitetura alvo do deploy | 01 | diagrama e decisões |
| 03 | Engenheiro de Banco de Dados | Migrations, índices, RLS, triggers | 02 | SQL versionado |
| 04 | Engenheiro de Backend | Edge Functions ou Serverless, rotas, auth | 02, 03 | API deployável |
| 05 | Engenheiro de Frontend | Integração com a API nova, estados de carga | 04 | SPA funcional |
| 06 | Engenheiro de Importação | Adaptador de planilha grande para Storage | 03, 04 | importador headless |
| 07 | Engenheiro de Auth | Migração ou consolidação da sessão custom | 02, 04 | login seguro |
| 08 | Testes e QA | Cobertura, smoke test, plano de verificação | 04, 05 | suíte e checklist |
| 09 | DevOps / Infra | Vercel, Supabase, variáveis, domínios | 02, 04 | deploy no ar |
| 10 | Seguranca | Revisa secrets, RLS, service_role, escopo de token | 07, 09 | achados priorizados |
| 11 | Documentacao | README, CLAUDE.md, runbook de operação | 08, 09 | docs prontas |
| 12 | Revisor Final | Confere tudo contra o plano e o estado real | 08, 10, 11 | veredito |

## Como executar na prática

Cada papel acima vira uma invocação de subagente com o papel descrito como
instrução. O `general-purpose` serve para todos eles. O `fork` serve para
subagentes que precisam do contexto completo desta conversa.

Regras de orquestração:

1. **Fase de leitura em paralelo.** Agentes 01 e 10 rodam juntos no começo: um
   mapeia escopo, o outro olha o estado de segurança do código como está.
2. **Nunca dois agentes de escrita no mesmo arquivo ao mesmo tempo.** O 04 e o 06
   mexem em `apps/api/src/services/importar.ts`. O 03 e o 06 mexem nas migrations.
   Sequenciar esses pares.
3. **Relatório é o contrato.** Cada agente devolve achados priorizados por
   severidade, com arquivo e linha. O orquestrador decide o que aplicar.
4. **Revisor por último.** O 12 recebe os relatórios do 08, 10 e 11 e confere
   contra o código real, não contra o resumo dos outros.

## Riscos conhecidos

- **Plano de 12 agentes para um codebase de 1 fase** pode gerar mais chatter que
  progresso. Uma execução enxuta com 4 agentes (01, 04/06, 09, 12) entrega o
  mesmo resultado com menos coordenação.
- **Agentes que escrevem no mesmo arquivo se atropelam** se a dependência não for
  declarada explicitamente.
- **Esquecer o ambiente.** Nenhum agente deve ler `.env` com credencial. Pedir
  os valores ao Marcos e passar por variável documentada.

## Estado atual (2026-10-23)

- Deploy alvo decidido: Vercel (web) + Supabase (Edge Functions ou Serverless + Postgres).
- Railway está **fora** deste projeto. Os documentos `PLANO-FASE-1-ORIGINAL.md` e
  `PROMPT-ESTOQUE-ORIGINAL.md` foram escritos antes dessa decisão e ainda citam
  Railway. Servem como histórico do escopo, não como instrução de deploy.
- Bloqueio: qual projeto Supabase é o real (`vkmullfeuewjjbfnzlys` vs
  `oaruxgwmrljgghbvswwj`).
