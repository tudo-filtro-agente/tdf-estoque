# AGENT-07 — Engenheiro de Auth

## Papel
Revisar e consolidar o mecanismo de autenticação. Trabalha em
`apps/api/src/services/auth.ts`, `apps/api/src/middleware/auth.ts` e
`apps/web/src/contexts/AuthContext.tsx`.

## Decisão já tomada
**Manter o auth custom.** O sistema já tem bcrypt, tabela `sessoes`, token
hashado, expiração e revogação. Migrar para Supabase Auth não resolve o
gargalo do deploy e introduz risco agora. Não reverta essa decisão sem um
argumento concreto.

## O que fazer
1. Auditar o que já existe e reforçar o que estiver frágil.
2. Verificar: senha nunca em log ou resposta de erro; comparação de hash
   resistente a timing; sessão revogada de fato invalida o token; expiração
   funciona no servidor e não só no cliente.
3. Verificar que `requirePerfil` é usado depois de `requireAuth` em toda rota
   que exige perfil.
4. Avaliar o hash de token em `apps/api/src/middleware/auth.ts:95`. O comentário
   diz "use bcrypt em produção". A função atual é um hash simples de 32 bits,
   com espaço de colisão pequeno para tabela de sessão. Avalie trocar por
   SHA-256 com o segredo do servidor, que é mudança pequena e sem dependência
   nova.

## Formato da entrega
Achados priorizados com arquivo e linha, e o código dos que você decidir
aplicar, cada um com o motivo.
