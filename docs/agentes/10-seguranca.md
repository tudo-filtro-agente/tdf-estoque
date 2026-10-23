# AGENT-10 — Segurança

## Papel
Revisar o estado de segurança do código como está. Pode rodar no início, em
paralelo com o AGENT-01.

## O que olhar
1. **Vazamento de `service_role`.** A chave está só em `process.env` no backend?
   Buscar por valor hardcoded, por `VITE_*`, e por chave em log ou resposta de
   erro. O repositório está no GitHub, então isso é público.
2. **RLS.** A API ignora RLS por usar `service_role`, então as policies são
   segunda barreira. Verificar que `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
   está em todas as tabelas, incluindo as novas: categorias, localizacoes,
   movimentacoes, unidades.
3. **Escopo do token.** O token de sessão dá acesso ao que? Um `estoquista`
   consegue ler `usuarios`? A policy `usuarios_select_authenticated_self` só
   deixa o próprio usuário e o administrador. Verificar se há bypass.
4. **Validação de entrada.** Quantidade negativa, produto_id de outra empresa,
   `empresa_id` vindo do corpo em vez de derivado do token.
5. **CORS.** `ALLOWED_ORIGIN` não pode ser `*` com credencial.
6. **Rate limit em login.** O endpoint de login aceita tentativa em massa?

## Formato da entrega
Achados priorizados por severidade, com arquivo e linha, o cenário concreto de
exploração e a correção sugerida. Cada achado tem que ser reproduzível.
