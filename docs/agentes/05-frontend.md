# AGENT-05 — Engenheiro de Frontend

## Papel
Integrar o frontend com a API no formato de deploy alvo. Trabalha em `apps/web/`.

## Como trabalhar
1. Ler `apps/web/src/lib/api.ts`, que é onde o cliente HTTP mora, e
   `apps/web/src/routes/`, que tem as 12 páginas.
2. O frontend já tem proxy `/api` para o backend em `apps/web/vite.config.ts`.
   Em produção na Vercel, esse proxy vira rewrite no `vercel.json`.
3. O frontend é SPA estático: sobe na Vercel sem depender da API para build.
   Pode ir ao ar antes do backend, e mostrar a tela de login.
4. Gerenciar estado de loading e erro nas chamadas de API. O projeto já usa
   TanStack Query; seguir o padrão já usado nas páginas.

## Regras
- A `service_role` nunca vai para o frontend. Nem em variável `VITE_*`.
- O token fica em `localStorage` (`tdf_token`), conforme `AuthContext.tsx`.
- Respeitar o perfil do usuário no menu: a aba Usuários só aparece para
  `administrador`. Isso é decisão de UI; a barreira real é o backend.

## Formato da entrega
Código compilando, com a lista de chamadas de API que precisam de ajuste e o
`vercel.json` com os rewrites.
