# PLANO — TDF Controle de Estoque | Fase 1

**Escopo:** Infraestrutura + Auth + Catálogo de Produtos + Importação Excel

---

## 1. O QUE FOI ENTENDIDO

Criar do zero o sistema de controle de estoque da Tudo de Filtro, separado do Financeiro, com catálogo de produtos (CRUD manual + importação Excel), auth por sessão com cookie httpOnly, e preparação para movimentações futuras.

**Decisões já travadas (da sessão out/2026):**
- Monorepo com `apps/web` + `apps/api`
- Postgres dedicado no Railway (projeto `tdf-estoque`)
- Stack: React + TypeScript + Vite + Tailwind + shadcn/ui + Fastify + Drizzle
- Auth idêntico ao Financeiro (sessão em tabela, cookie httpOnly)
- Mesmas cores do logo TDF (verde-água, âmbar, coral, azul-marinho)
- Integração com Financeiro via `X-Internal-Api-Key` em fases futuras

**Estado atual:** Estrutura inicial a ser criada. O plano parte dessa premissa.

---

## 2. ESTRUTURA DE PASTAS DO MONOREPO

```
tdf-estoque/
├── apps/
│   ├── api/                          # Backend Fastify + Drizzle
│   │   ├── src/
│   │   │   ├── server.js             # Entry point (listen na porta)
│   │   │   ├── db/
│   │   │   │   ├── index.js          # Pool pg + query helpers
│   │   │   │   ├── migrate.js        # Runner de migrations
│   │   │   │   └── create-admin.js   # Script para criar admin inicial
│   │   │   ├── middleware/
│   │   │   │   └── auth.js           # Middleware requireAuth (lê sessão)
│   │   │   ├── routes/
│   │   │   │   ├── bootstrap.js      # GET /health, GET /api/bootstrap
│   │   │   │   ├── auth.js           # POST login/logout, GET /me
│   │   │   │   ├── produtos.js       # CRUD + importar + template
│   │   │   │   ├── empresas.js       # GET /api/empresas
│   │   │   │   └── financeiro.js     # Proxy para Financeiro (futuro)
│   │   │   └── services/
│   │   │       ├── auth.js           # login, logout, renewSession
│   │   │       └── produtos.js       # Lógica de produtos
│   │   └── drizzle/
│   │       ├── 0000_init/
│   │       │   └── 0001_schema.sql   # Schema completo Fase 1
│   │       └── 0001_seed/
│   │           └── 0001_fontes.sql   # Seed: manual, excel, omie, zoho
│   │
│   └── web/                          # Frontend React
│       ├── src/
│       │   ├── main.tsx              # Entry point
│       │   ├── App.tsx               # Router principal
│       │   ├── index.css             # Tailwind + CSS vars TDF
│       │   ├── lib/
│       │   │   ├── api.ts            # Fetch wrapper com auth
│       │   │   ├── utils.ts          # cn() do shadcn
│       │   │   └── queryClient.ts    # TanStack Query config
│       │   ├── contexts/
│       │   │   └── AuthContext.tsx   # Estado do usuário logado
│       │   ├── components/
│       │   │   ├── ui/               # shadcn components
│       │   │   │   ├── button.tsx
│       │   │   │   ├── card.tsx
│       │   │   │   ├── input.tsx
│       │   │   │   ├── label.tsx
│       │   │   │   ├── table.tsx
│       │   │   │   ├── dialog.tsx
│       │   │   │   ├── select.tsx
│       │   │   │   ├── badge.tsx
│       │   │   │   ├── dropdown-menu.tsx
│       │   │   │   ├── toast.tsx
│       │   │   │   └── ...
│       │   │   ├── PageHeader.tsx     # shadcn-page-header
│       │   │   ├── StatusBadge.tsx   # badge de status
│       │   │   ├── KpiCard.tsx       # card de métrica
│       │   │   ├── EmptyState.tsx    # estado vazio
│       │   │   └── ModalShell.tsx    # wrapper de dialog
│       │   └── routes/
│       │       ├── LoginPage.tsx     # /login
│       │       ├── Layout.tsx        # shell com sidebar + header
│       │       ├── ProdutosPage.tsx  # /produtos
│       │       └── ImportarPage.tsx  # /importar
│       ├── public/
│       │   └── template-importacao.xlsx
│       └── tailwind.config.js        # Cores do logo TDF
│
├── scripts/
│   └── verificar-schema.js           # Verifica se schema está aplicado
│
├── railway.toml                      # Deploy Railway
├── Dockerfile                        # Build multi-stage
├── package.json                      # Root (npm workspaces)
└── .env.local                        # Dev (não commitar)
```

---

## 3. SCHEMA SQL — TABELAS DA FASE 1

**Arquivo:** `apps/api/drizzle/0000_init/0001_schema.sql`

```sql
-- TDF Controle de Estoque — Schema Fase 1
-- Idempotente: reaplicar não faz nada.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────
-- EMPRESAS (espelho do Financeiro — buscar via API)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id      INT PRIMARY KEY,   -- ID do Financeiro
  nome    TEXT NOT NULL,
  cnpj    TEXT,
  ativa   BOOLEAN DEFAULT true
);

-- ──────────────────────────────────────────────
-- FONTES (origem dos dados)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fontes (
  id          SERIAL PRIMARY KEY,
  codigo      TEXT NOT NULL UNIQUE,   -- 'manual' | 'excel' | 'omie' | 'zoho'
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('api','arquivo','manual')),
  base_url    TEXT,
  ultimo_sync TIMESTAMPTZ,
  ultima_falha TIMESTAMPTZ,
  ativa       BOOLEAN NOT NULL DEFAULT true
);

-- ──────────────────────────────────────────────
-- USUÁRIOS (mesmo padrão do Financeiro)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id             BIGSERIAL PRIMARY KEY,
  nome           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  perfil         TEXT NOT NULL
                 CHECK (perfil IN ('administrador','estoquista','financeiro')),
  senha_hash     TEXT NOT NULL,
  algoritmo_hash TEXT NOT NULL DEFAULT 'argon2id',
  ativo          BOOLEAN NOT NULL DEFAULT true,
  ultimo_login   TIMESTAMPTZ,
  criado_por     INT REFERENCES usuarios(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_corporativo CHECK (email ILIKE '%@tudodefiltro.com.br')
);

-- Sessão em tabela (não em memória — não morre no restart)
CREATE TABLE IF NOT EXISTS sessoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,  -- SHA-256; o token puro só existe no cookie
  csrf_token    TEXT NOT NULL,
  ip            TEXT,
  user_agent    TEXT,
  expira_em     TIMESTAMPTZ NOT NULL,
  revogada_em   TIMESTAMPTZ,           -- logout e desligamento marcam aqui
  criada_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessoes_usuario_id_expira_em_idx ON sessoes (usuario_id, expira_em);

-- ──────────────────────────────────────────────
-- PRODUTOS (catálogo)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id              SERIAL PRIMARY KEY,
  empresa_id      INT NOT NULL REFERENCES empresas(id),
  codigo          TEXT NOT NULL,
  nome            TEXT NOT NULL,
  descricao       TEXT,
  unidade         TEXT DEFAULT 'UN',
  categoria       TEXT,
  ncm             TEXT,
  gtin            TEXT,

  -- Preços (R$)
  preco_custo     NUMERIC(12,2),
  preco_venda     NUMERIC(12,2),
  markup_padrao   NUMERIC(5,2),

  -- Controle
  estoque_minimo  NUMERIC(10,2) DEFAULT 0,
  estoque_maximo  NUMERIC(10,2),
  localizacao     TEXT,

  -- Origem
  fonte_id        INT REFERENCES fontes(id),
  id_origem       TEXT,
  raw             JSONB,
  criado_por      TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  ingerido_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE INDEX IF NOT EXISTS produtos_categoria_idx ON produtos (categoria);
CREATE INDEX IF NOT EXISTS produtos_nome_idx ON produtos (nome);
```

**Arquivo:** `apps/api/drizzle/0001_seed/0001_fontes.sql`

```sql
-- Seed das fontes (idempotente)
INSERT INTO fontes (codigo, nome, tipo) VALUES
  ('manual', 'Cadastro Manual', 'manual'),
  ('excel',  'Importação Excel', 'arquivo'),
  ('omie',   'OMIE (NF-e)', 'api'),
  ('zoho',   'ZOHO CRM', 'api')
ON CONFLICT (codigo) DO NOTHING;
```

---

## 4. ROTAS DA API — FASE 1

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/health` | Health check | Não |
| `GET` | `/api/bootstrap` | Config pública (nomed a empresa, fontes) | Não |
| `POST` | `/api/auth/login` | Login (email + senha) | Não |
| `POST` | `/api/auth/logout` | Logout | Sim |
| `GET` | `/api/auth/me` | Retorna usuário logado | Sim |
| `GET` | `/api/empresas` | Lista empresas | Sim |
| `GET` | `/api/produtos` | Lista produtos (filtros: categoria, nome, ativo) | Sim |
| `GET` | `/api/produtos/:id` | Detalhe de um produto | Sim |
| `POST` | `/api/produtos` | Criar produto | Sim |
| `PUT` | `/api/produtos/:id` | Editar produto | Sim |
| `DELETE` | `/api/produtos/:id` | Desativar produto (soft delete) | Sim |
| `POST` | `/api/produtos/importar` | Importar planilha XLSX (dry-run ou commit) | Sim |
| `GET` | `/api/produtos/importar/template` | Baixar template Excel | Sim |

---

## 5. TELAS DO FRONTEND — FASE 1

### 5.1 Login (`/login`)
- Form: email + senha
- Submit → POST /api/auth/login
- Erro: mensagem inline
- Sucesso: redirect para `/produtos`
- Link "esqueci a senha" (opcional, Fase 2)

### 5.2 Layout Principal (`/` com shell)
- Sidebar: Logo TDF Estoque, links (Produtos, Importar, Sair)
- Header: nome do usuário logado, empresa atual
- Outlet: conteúdo da rota

### 5.3 Produtos (`/produtos`)
**Header da página:** título "Produtos", botão "+ Novo Produto"

**Tabela de produtos:**
| Código | Nome | Categoria | Unidade | Preço Custo | Preço Venda | Status |
|--------|------|-----------|---------|-------------|-------------|--------|
| FLT-001 | Filtro 10pol | Filtro | UN | R$ 45,90 | R$ 89,90 | Ativo |

**Filtros:** busca por nome/código, dropdown categoria, toggle "mostrar inativos"

**Ações por linha:**
- Editar (ícone de lápis) → abre modal com formulário
- Desativar (ícone de lixeira) → confirmação → soft delete

**Botão "Importar Excel"** → link para `/importar`

### 5.4 Modal de Produto (Criar/Editar)
**Campos do formulário:**
- Código (text, obrigatório, único por empresa)
- Nome (text, obrigatório)
- Descrição (textarea, opcional)
- Unidade (select: UN, KG, LT, MT, M2, M3)
- Categoria (text com autocomplete)
- NCM (text, máscara 0000.00.00)
- GTIN/EAN (text)
- Preço Custo (number, R$)
- Preço Venda (number, R$)
- Markup Padrão (number, %)
- Estoque Mínimo (number)
- Estoque Máximo (number)
- Localização (text, ex: "Prateleira A-1")

**Validações:**
- Código único por empresa
- Nome obrigatório
- Preço não negativo

### 5.5 Importar (`/importar`)
**Header:** "Importar Planilha"

**Upload:**
- Drag &amp; drop ou clique para selecionar arquivo
- Aceita apenas `.xlsx` ou `.xls`
- Limite: 5MB

**Após upload:**
- Preview da tabela com primeiras 10 linhas
- Contador: X linhas válidas, Y duplicadas, Z com erro
- Tabela de erros (se houver): linha, coluna, motivo
- Botão "Importar X produtos" (só aparece se X &gt; 0)
- Checkbox "Fazer dry-run" (default: checado)

**Colunas esperadas no Excel (do prompt):**
`Código`, `Nome`, `Descrição`, `Unidade`, `Categoria`, `NCM`, `GTIN/EAN`, `Preço Custo`, `Preço Venda`, `Estoque Mínimo`, `Estoque Atual`, `Localização`

**Validações do dry-run:**
- Código duplicado no Excel → rejeita
- Nome vazio → rejeita
- Preço negativo → rejeita
- Formato NCM inválido → rejeita

---

## 6. DEPENDÊNCIAS NPM

### `apps/api/package.json`
```json
{
  "name": "@tdf-estoque/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node src/server.js",
    "start": "bash startup.sh",
    "db:migrate": "node src/db/migrate.js",
    "db:create-admin": "node src/db/create-admin.js"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/multipart": "^9.0.0",
    "pg": "^8.23.0",
    "bcryptjs": "^2.4.3",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0"
  }
}
```

### `apps/web/package.json`
```json
{
  "name": "@tdf-estoque/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b &amp;&amp; vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@tanstack/react-query": "^5.59.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.454.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0",
    "tailwind-merge": "^2.5.4",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8"
  }
}
```

**Dependências extras no root (`package.json`):**
```json
{
  "workspaces": ["apps/*"],
  "devDependencies": {
    "shadcn": "latest"
  }
}
```

---

## 7. VARIÁVEIS DE AMBIENTE

### `.env.local` (desenvolvimento)
```bash
# Banco
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tdf_estoque

# CORS
ALLOWED_ORIGIN=http://localhost:5173

# Auth
SESSION_COOKIE_DOMAIN=localhost

# Integração Financeiro (para quando precisar buscar empresas)
FINANCEIRO_API_URL=http://localhost:3001
INTERNAL_API_KEY=dev-internal-key-change-me
```

### Railway (produção)
| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/estoque` (do projeto Railway) |
| `ALLOWED_ORIGIN` | `https://tdf-estoque.up.railway.app` |
| `SESSION_COOKIE_DOMAIN` | `.up.railway.app` |
| `FINANCEIRO_API_URL` | `https://tdf-financeiro.up.railway.app` |
| `INTERNAL_API_KEY` | (copiar do Railway do Financeiro) |

---

## 8. ORDEM DE EXECUÇÃO DOS ENTREGÁVEIS

| # | Etapa | Arquivos | Como saber que está pronto |
|---|-------|----------|---------------------------|
| 1 | **Estrutura base** | `package.json` (root + apps), `vite.config.ts`, `tailwind.config.js`, `tsconfig.json` | `npm install` roda sem erro |
| 2 | **shadcn components** | `components/ui/*.tsx` | `npx shadcn@latest add button card input label table dialog select badge dropdown-menu toast` funciona |
| 3 | **CSS + cores TDF** | `index.css` com CSS vars | Cores do logo aplicadas |
| 4 | **DB helpers** | `db/index.js`, `db/migrate.js` | `node src/db/migrate.js` aplica o schema |
| 5 | **Schema SQL** | `drizzle/0000_init/0001_schema.sql` | Tabelas existem: `produtos`, `fontes`, `usuarios`, `sessoes`, `empresas` |
| 6 | **Seed fontes** | `drizzle/0001_seed/0001_fontes.sql` | `SELECT * FROM fontes` retorna 4 linhas |
| 7 | **Script criar admin** | `db/create-admin.js` | Executa sem erro, cria usuário admin |
| 8 | **Middleware auth** | `middleware/auth.js` | Rotas protegidas retornam 401 se sem sessão |
| 9 | **Rotas auth** | `routes/auth.js`, `services/auth.js` | Login/logout/me funcionam |
| 10 | **Bootstrap** | `routes/bootstrap.js` | `/api/bootstrap` retorna config pública |
| 11 | **Rotas produtos** | `routes/produtos.js`, `services/produtos.js` | CRUD completo via curl |
| 12 | **Importar Excel** | Rotas de `importar` com xlsx | Dry-run retorna preview correto |
| 13 | **Template Excel** | `public/template-importacao.xlsx` | Download funciona |
| 14 | **Login page** | `LoginPage.tsx` + `AuthContext.tsx` | Login funciona no browser |
| 15 | **Layout** | `Layout.tsx`, `Sidebar.tsx`, `Header.tsx` | Navegação funciona |
| 16 | **Produtos page** | `ProdutosPage.tsx`, `ProdutoModal.tsx` | CRUD completo na UI |
| 17 | **Importar page** | `ImportarPage.tsx` | Upload + preview + import funcionam |

---

## 9. CRITÉRIOS DE ACEITAÇÃO — FASE 1

### Auth
- [ ] POST `/api/auth/login` com credenciais válidas retorna token + usuário
- [ ] POST `/api/auth/login` com credenciais inválidas retorna 401
- [ ] GET `/api/auth/me` sem sessão retorna 401
- [ ] POST `/api/auth/logout` invalida sessão (não pode ser reutilizada)
- [ ] Cookie `session_token` com httpOnly, Secure em prod
- [ ] CSRF token funciona (cookie + header)
- [ ] Rate limit: 5 tentativas por IP em 15 min

### Produtos
- [ ] GET `/api/produtos` retorna lista com filtros funcionando
- [ ] GET `/api/produtos/:id` retorna produto correto
- [ ] POST `/api/produtos` cria produto (valida código único)
- [ ] PUT `/api/produtos/:id` atualiza produto
- [ ] DELETE `/api/produtos/:id` faz soft delete (ativo = false)
- [ ] Validação: código único por empresa
- [ ] Validação: nome obrigatório

### Importação Excel
- [ ] GET `/api/produtos/importar/template` baixa arquivo .xlsx
- [ ] POST com `dry-run: true` retorna preview sem gravar
- [ ] POST com `dry-run: false` importa e retorna contagem
- [ ] Linhas duplicadas no Excel são rejeitadas com motivo
- [ ] Linhas com nome vazio são rejeitadas
- [ ] Preços negativos são rejeitados
- [ ] Formato NCM inválido é rejeitado

### Frontend
- [ ] Página de login com validação
- [ ] Redirect para /produtos após login
- [ ] Tabela de produtos com paginação (se &gt; 50 itens)
- [ ] Filtros de categoria e busca funcionam
- [ ] Modal de criar/editar produto com todos os campos
- [ ] Toast de sucesso/erro após operações
- [ ] Upload de Excel com preview
- [ ] Sidebar com logout funcional

---

## 10. RISCOS E DECISÕES ABERTAS

### Risco 1: Estrutura inicial não existe
**Problema:** O PLANEJADOR não localizou o repositório `tdf-estoque` (porque o chip da estrutura não foi clicado ainda).
**Mitigação:** O CRIADOR da Fase 1 cria a estrutura antes de tudo.
**Decisão necessária:** Clicar no chip que aparece na conversa.

### Risco 2: Drizzle vs SQL puro
**Problema:** O Financeiro usa SQL puro (`.sql` files) e pg direto. O prompt menciona Drizzle.
**Recomendação do PLANEJADOR:** Manter SQL puro (sem Drizzle ORM) para consistência com Financeiro.
**Alternativa:** Usar Drizzle. Custo: aprendizado, benefício: type-safety nas queries.

### Decisão 2: shadcn via CLI ou manual
**Recomendação:** `npx shadcn@latest init` + adicionar componentes um a um.
**Alternativa:** Copiar do Financeiro. Custo: desatualizado vs. versão nova.

### Decisão 3: Fastify vs Express
**Recomendação:** Fastify (mais rápido, schema de validação built-in).
**Alternativa:** Express. Mais comum, mais exemplos na internet.

### Decisão 4: Autenticação multi-empresa
**Problema:** Cada usuário é de uma empresa ou vê todas?
**Recomendação:** Na Fase 1, usar empresa_id fixo = 1 (Tudo de Filtro Matriz). Seletor de empresa vem na Fase 2+.
**Alternativa:** Tabela `usuarios_empresas` para múltiplas.

### Decisão 5: Empresas via API ou seed
**Problema:** A tabela `empresas` precisa de dados. De onde vem?
**Recomendação:** Seedar com as 3 empresas (TDF, American, Mococa) + buscar empresas do Financeiro via `GET /api/financeiro/empresas` quando a integração estiver pronta.
**Alternativa:** hardcoded no schema seed.

---

## 11. CHECKLIST PARA MARCOS

### Precisa de input seu:
- [ ] Qual usuário admin inicial? (email + senha)
- [ ] Empresa inicial: só TDF (id=1) ou as 3?
- [ ] Confirma **SQL puro** (sem Drizzle ORM) pra manter consistência com Financeiro?

### Pode começar sem input:
- [x] Estrutura de pastas
- [x] Schema SQL
- [x] Auth (padrão Financeiro)
- [x] shadcn + Tailwind
- [x] CRUD produtos
- [x] Importação Excel

### Após Fase 1:
- [ ] Testar login
- [ ] Cadastrar 10 produtos manualmente
- [ ] Importar planilha de 100 produtos
- [ ] Deploy no Railway
