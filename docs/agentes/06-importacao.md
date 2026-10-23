# AGENT-06 — Engenheiro de Importação

## Papel
Adaptar o importador de planilha para upload direto ao Supabase Storage, de modo
que arquivo grande não passe pelo corpo da requisição.

## Contexto do problema
Hoje o importador recebe XLSX de até 50 MB em base64 no corpo da requisição. Isso
estoura o limite de 10 MB por requisição das Edge Functions e é frágil mesmo na
Vercel. A solução é o browser enviar o arquivo direto ao Storage, e a função
receber a referência do arquivo.

## Como trabalhar
1. Ler `apps/api/src/services/importar.ts` e `apps/api/src/routes/importar.ts`.
   O importador já faz multi-aba e mapeamento de colunas TDF. Não reescreva a
   lógica de mapeamento; ela está pronta e testada.
2. Mudar o fluxo para: cliente sobe no Storage → manda o caminho → função lê do
   Storage → processa em lotes → grava com bulk insert.
3. Preservar: as rotas de template, de listar abas, e o suporte a multi-aba.
4. Registrar a movimentação de `tipo=inventario` quando o produto já existir com
   `saldo_atual` zerado, para o saldo não zerar na importação.

## Limites
- Vercel Pro: 800 s por função. Verifique que o processamento cabe com folga.
- Memória: leia o arquivo do Storage em streaming ou em lotes, não o arquivo
  inteiro em memória.

## Formato da entrega
O código do fluxo novo, com a nota de onde o cliente precisa mudar e como
configurar o bucket no painel do Supabase.
