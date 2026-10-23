# TDF Estoque

Sistema de controle de estoque da Tudo de Filtro (TDF) — filtros e tratamento de água.

## Descricao

Sistema para gestao de estoque de filtros e produtos para tratamento de agua. Permite controle de inventario, registro de entradas e saidas, e geracao de relatorios.

## Stack Tecnologica

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v3 + shadcn/ui
- **Backend**: hoje Fastify + supabase-js; alvo é Supabase Edge Functions
- **Database**: PostgreSQL via Supabase
- **Autenticacao**: hoje custom (bcrypt + tabela `sessoes`); alvo é Supabase Auth
- **Deploy**: Vercel (Web) + Supabase (Edge Functions + Postgres)

## Arquitetura

```
tdf-estoque/
├── apps/
│   ├── web/          # React SPA (porta 5173)
│   └── api/          # Fastify API (porta 3001)
├── packages/          # (futuro: libs compartilhadas)
└── .env.example
```

## Como Instalar e Rodar Localmente

### 1. Pre-requisitos

- Node.js 20+
- npm ou yarn
- Conta no Supabase (gratuita)

### 2. Clonar o repositorio

```bash
git clone https://github.com/tudo-filtro-agente/tdf-estoque.git
cd tdf-estoque
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Configurar variaveis de ambiente

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais do Supabase:
- `SUPABASE_URL`: URL do seu projeto Supabase
- `SUPABASE_ANON_KEY`: Chave anonima do Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Chave de servico (para operacoes admin)

### 5. Rodar o projeto

```bash
# Rodar frontend e API juntos
npm run dev

# Ou individualmente:
npm run dev:api     # API Fastify (porta 3001)
npm run dev         # Frontend React (porta 5173)
```

## Scripts Disponiveis

| Script | Descricao |
|--------|-----------|
| `npm run dev` | Inicia o frontend em modo desenvolvimento |
| `npm run dev:api` | Inicia a API em modo desenvolvimento |
| `npm run build` | Build do frontend para producao |
| `npm run build:api` | Build da API para producao |
| `npm run db:generate` | Gera migrations do Drizzle |
| `npm run db:migrate` | Executa migrations no banco |

## Documentacao

- [Documentacao da API](./apps/api/README.md)
- [Documentacao do Frontend](./apps/web/README.md)

## Deploy

- **Frontend**: Vercel (estático)
- **Backend**: Supabase Edge Functions (serverless)
- **Database**: Supabase Postgres
- **Deploy automatico**: push na branch `main`

> A API ainda roda como Fastify em `apps/api` (porta 3001) para desenvolvimento
> local. A migracao para Edge Functions esta pendente. `railway.toml` e `Dockerfile`
> no raiz sao resquicios de uma montagem inicial e estao errados: este projeto nao
> usa Railway.

## Contexto

Este projeto e **independente** do `tdf-financeiro` e `tdf-rh`.

**Empresa**: Tudo de Filtro (TDF) — filtros e tratamento de agua
**CNPJ**: 52.790.081/0001-74
