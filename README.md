# TDF Estoque

Controle de estoque da Tudo de Filtro (TDF) — filtros e tratamento de água.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v3 + shadcn/ui
- **Backend**: Fastify (Node 20) + Drizzle ORM
- **Database**: PostgreSQL (Railway)
- **Deploy**: Railway

## Arquitetura

```
tdf-estoque/
├── apps/
│   ├── web/          # React SPA (porta 5173)
│   └── api/          # Fastify API (porta 3001)
├── packages/          # (futuro: libs compartilhadas)
└── railway.toml
```

## Setup Local

### 1. Pré-requisitos

- Node.js 20+
- PostgreSQL (local ou Railway)

### 2. Variáveis de ambiente

Criar `.env` na raiz:

```env
DATABASE_URL=postgres://user:password@host:5432/tdf_estoque
```

### 3. Instalar dependências

```bash
npm install
```

### 4. Rodar

```bash
# Frontend
npm run dev

# API
npm run dev:api
```

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/api/ping` | Teste de resposta |

## Integrações Futuras

- Importação de NF-e da OMIE
- Feed para DRE e Fluxo de Caixa do TDF Financeiro via API REST
- Planilha Excel como catálogo inicial

## Deploy

Deploy automático via Railway ao fazer push na branch `main`.

## Contexto

Este projeto é **independente** do `tdf-financeiro` e `tdf-rh`.
Empresa: **Tudo de Filtro (TDF)** — filtros e tratamento de água.
CNPJ: 52.790.081/0001-74
