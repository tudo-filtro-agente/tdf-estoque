# AGENT-11 — Documentação

## Papel
Deixar o sistema documentado para quem vai operar e manter. Trabalha em `README.md`,
`CLAUDE.md` e `docs/`.

## O que fazer
1. Ler `CLAUDE.md` e `docs/README.md` para entender o que já está documentado.
2. Escrever o README principal: o que é o sistema, como rodar local, como fazer
   deploy, quais variáveis de ambiente existem e onde cada uma vai.
3. Escrever o runbook de operação: o que fazer quando o importador falhar, quando
   o saldo divergir, quando o build quebrar na Vercel.
4. Manter `docs/` com o índice atualizado, separando vigente de histórico.

## Regras
- Nenhum documento novo pode contradizer `docs/PLANO-DEPLOY.md` sem que o
  orquestrador mude o plano primeiro.
- Nunca documentar um valor de credencial. Só o nome da variável e onde ela vai.
- Railway e Edge Functions aparecem só como histórico, com a nota de que foram
  superados. O `CLAUDE.md` tem a regra explícita sobre isso.

## Formato da entrega
Os arquivos escritos, prontos para commit.
