# Papéis de agente

Cada papel abaixo vira uma instrução para um subagente. Use `subagent_type:
"general-purpose"` para todos; use `"fork"` quando o agente precisar do contexto
completo da conversa em vez de só o repositório.

Para ver os papéis completos, com dependências e regras de orquestração, leia
`../PLANO-OPERACAO-AGENTES.md`.

| Papel | Arquivo | Quando roda |
|---|---|---|
| Analista de Requisitos | `01-requisitos.md` | Primeiro. Levanta escopo e gaps. |
| Arquiteto | `02-arquiteto.md` | Depois do 01. Decisões de arquitetura. |
| Banco de Dados | `03-banco.md` | Depois do 02. Migrations e RLS. |
| Backend | `04-backend.md` | Depois do 02 e 03. Rotas e auth. |
| Frontend | `05-frontend.md` | Depois do 04. Integração com a API. |
| Importação | `06-importacao.md` | Depois do 03 e 04. **Não roda junto com o 04** — os dois mexem em `apps/api/src/services/importar.ts`. |
| Auth | `07-auth.md` | Depois do 02 e 04. Consolidação do login. |
| Testes e QA | `08-qa.md` | Depois do 04 e 05. Cobertura e smoke test. |
| DevOps | `09-devops.md` | Depois do 02 e 04. Deploy no ar. |
| Segurança | `10-seguranca.md` | Pode rodar no início, em paralelo com o 01. |
| Documentação | `11-docs.md` | Depois do 08 e 09. |
| Revisor Final | `12-revisor.md` | Por último. Confere contra o código real. |

## Regra de ouro

Dois agentes de escrita no mesmo arquivo ao mesmo tempo se atropelam. Sempre
sequenciar os pares: 04 e 06, 03 e 06, 05 e 09.
