# PROMPT — TDF Controle de Estoque

> Copie tudo a partir da linha "---" abaixo e cole no Claude Code, numa sessão
> nova, com o repositório `tdf-estoque` já criado.

---

Crie do zero um sistema web chamado **TDF Controle de Estoque**, para gerenciar
o estoque da Tudo de Filtro. Ele mantém o catálogo de produtos, registra
movimentações (entradas e saídas), calcula saldos e alimenta o painel
TDF Financeiro (DRE e Fluxo de Caixa).

O estoque é **100% independente da OMIE** — funciona mesmo se a OMIE sair.
OMIE é usada apenas como fonte opcional de verificação.

Antes de escrever qualquer código, leia este prompt inteiro e produza um plano
de implementação. Execute fase a fase, confirmando com o usuário ao fim de
cada fase.

---

## 1. ISOLAMENTO

Crie **tudo novo**. Nada pode ser criado, alterado, movido ou apagado dentro
destes diretórios/repositórios:

- `tdf-financeiro` (repositório existente, usar apenas como referência)
- `tdf-rh` (repositório existente, usar apenas como referência)
- `tdf-probe` (testes, usar apenas como referência)
- Qualquer repositório do Hermes

**Repositório novo:** `tdf-estoque` no GitHub.
**Projeto novo no Railway:** `tdf-estoque`, com Postgres próprio.

---

## 2. REGRA ABSOLUTA — ESTOQUE É INDEPENDENTE

O sistema de estoque **não depende de nenhuma plataforma externa** para funcionar.
OMIE é fonte adicional (NF-e de compra), não requisito.

| Origem | Como entra | Quando |
|---|---|---|
| `manual` | digitação na tela | catálogo base |
| `excel` | importação de planilha | catálogo inicial |
| `omie` | sync de NF-e de compra | verificação/cross-check |
| `zoho` | sync do catálogo de produtos | verificação/cross-check |

A regra que decorre:
> **Nenhuma consulta do estoque pode depender exclusivamente da OMIE ou ZOHO.**
> O saldo é calculado a partir dos movimentos registrados localmente.

---

## 3. FONTES DE DADOS DA TDF

### 3.1 OMIE — NF-e de Compra
- Endpoint: `POST https://app.omie.com.br/api/v1/produtos/pedido/`
- Função: `ListarPedidos`
- **Volume real (TDF):** 4.821 pedidos (mucho maior que as outras empresas)
- A NF-e de COMPRA (pedido de entrada) identifica fornecedores e valores
- Filtrar: tipo de pedido = 'entrada' ou natureza = 'compra'
- Restrição OMIE: throttle ≥ 2.5s, paginação 200 registros
- Fonte: variáveis de ambiente (setadas no Railway da seção "Apresentação TDF")

### 3.2 ZOHO CRM — Catálogo de Produtos
- Endpoint: `GET https://www.zohoapis.com/crm/v2/Products`
- Escopo: `ZohoCRM.modules.products.READ`
- Trava: endpoint throttleia com backoff
- Fonte: variáveis ZOHO_* do Railway da seção "Apresentação TDF"

### 3.3 Planilha Excel — Catálogo Inicial
- Modelo: colunas fixas (ver seção 6.2)
- Upload com preview e validação
- Importação com dry-run obrigatório

---

## 4. MODELO DE DADOS

### 4.1 Produtos (catálogo)
```sql
CREATE TABLE produtos (
  id              SERIAL PRIMARY KEY,
  empresa_id      INT NOT NULL REFERENCES empresas(id),
  codigo          TEXT NOT NULL,          -- SKU / código interno
  nome            TEXT NOT NULL,
  descricao       TEXT,
  unidade         TEXT DEFAULT 'UN',       -- UN, KG, LT, MT, M2, M3...
  categoria       TEXT,                    -- Filtro, Purificador, Refil, Acessório, Componente...
  ncm             TEXT,
  gtin            TEXT,                    -- código de barras (EAN13)

  -- Preços (R$)
  preco_custo     NUMERIC(12,2),
  preco_venda     NUMERIC(12,2),
  markup_padrao   NUMERIC(5,2),            -- % para sugerir preço

  -- Controle
  estoque_minimo  NUMERIC(10,2) DEFAULT 0,
  estoque_maximo  NUMERIC(10,2),
  localizacao     TEXT,                   -- Prateleira A-1, Depósito B...

  -- Origem
  fonte_id        INT REFERENCES fontes(id),
  id_origem       TEXT,                   -- id no OMIE/ZOHO
  raw             JSONB,
  criado_por      TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  ingerido_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE INDEX IF NOT EXISTS produtos_categoria_idx ON produtos (categoria);
CREATE INDEX IF NOT EXISTS produtos_nome_idx ON produtos (nome);
```

### 4.2 Fontes (mesma estrutura do Financeiro)
```sql
CREATE TABLE fontes (
  id          SERIAL PRIMARY KEY,
  codigo      TEXT NOT NULL UNIQUE,   -- 'manual' | 'excel' | 'omie' | 'zoho'
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('api','arquivo','manual')),
  base_url    TEXT,
  ultimo_sync TIMESTAMPTZ,
  ultima_falha TIMESTAMPTZ,
  ativa       BOOLEAN NOT NULL DEFAULT true
);
```

### 4.3 Movimentações
```sql
CREATE TABLE estoque_movimentacao (
  id                  BIGSERIAL PRIMARY KEY,
  empresa_id          INT NOT NULL REFERENCES empresas(id),
  produto_id          BIGINT NOT NULL REFERENCES produtos(id),
  tipo                TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  operacao            TEXT NOT NULL CHECK (operacao IN (
    'compra','devolucao_entrada','venda','devolucao_saida',
    'perda','quebra','transferencia','inventario','ajuste'
  )),

  quantidade          NUMERIC(10,2) NOT NULL,  -- sempre positivo
  valor_unitario      NUMERIC(12,2),           -- custo no momento
  valor_total         NUMERIC(12,2),

  -- Vínculo com Financeiro
  lancamento_id       BIGINT REFERENCES tdf_financeiro.lancamento_origem(id),

  -- Vínculo com OMIE/ZOHO
  id_origem           TEXT,
  fonte_id             INT REFERENCES fontes(id),

  documento           TEXT,    -- NF, OS, ordem de compra...
  fornecedor_cnpj     TEXT,
  fornecedor_nome     TEXT,
  observacao          TEXT,

  criado_por          TEXT NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS estoque_movimentacao_produto_data_idx ON estoque_movimentacao (produto_id, criado_em);
CREATE INDEX IF NOT EXISTS estoque_movimentacao_tipo_idx ON estoque_movimentacao (tipo, operacao);
```

### 4.4 Saldo Atual (materializado)
```sql
CREATE TABLE estoque_saldo (
  empresa_id          INT NOT NULL REFERENCES empresas(id),
  produto_id          BIGINT NOT NULL REFERENCES produtos(id),
  saldo_atual         NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_reservado     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- em OS em aberto
  custo_medio        NUMERIC(12,4),                    -- preço médio ponderado
  ultima_movimentacao TIMESTAMPTZ,
  PRIMARY KEY (empresa_id, produto_id)
);
```

### 4.5 Pedidos de Compra
```sql
CREATE TABLE pedido_compra (
  id              SERIAL PRIMARY KEY,
  empresa_id      INT NOT NULL REFERENCES empresas(id),
  fornecedor_cnpj TEXT,
  fornecedor_nome TEXT,
  data_pedido     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_entrega    DATE,
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','confirmado','recebido','cancelado')),
  valor_total     NUMERIC(14,2),
  observacao      TEXT,
  criado_por      TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pedido_compra_item (
  id                  SERIAL PRIMARY KEY,
  pedido_compra_id    BIGINT NOT NULL REFERENCES pedido_compra(id),
  produto_id          BIGINT REFERENCES produtos(id),
  descricao_temp      TEXT,                          -- quando produto não existe ainda
  quantidade          NUMERIC(10,2) NOT NULL,
  valor_unitario      NUMERIC(12,2),
  valor_total         NUMERIC(12,2),
  UNIQUE (pedido_compra_id, produto_id)
);
```

### 4.6 Empresas (mesma do Financeiro — buscar via API)
```sql
-- Tabela espelho (sincronizada do Financeiro)
CREATE TABLE empresas (
  id      INT PRIMARY KEY,   -- ID do Financeiro
  nome    TEXT NOT NULL,
  cnpj    TEXT,
  ativa   BOOLEAN DEFAULT true
);
```

---

## 5. INTEGRAÇÃO COM TDF FINANCEIRO

O estoque alimenta o Financeiro via **HTTP POST** (rotas REST).

### 5.1 Custo da Mercadoria Vendida (CMV) → DRE
```
Rota: POST https://tdf-financeiro.up.railway.app/api/financeiro/cmv
Payload:
{
  empresa_id: int,
  competencia: "YYYY-MM",
  cmv: [{ produto_id, produto_nome, quantidade, valor_total }],
  total_cmv: numeric
}
```
O Financeiro cria/adiciona linha "Custo das Mercadorias Vendidas" no DRE.

### 5.2 Compras → Fluxo de Caixa
```
Rota: POST https://tdf-financeiro.up.railway.app/api/financeiro/compras-estoque
Payload:
{
  empresa_id: int,
  periodo: { de: "YYYY-MM-DD", ate: "YYYY-MM-DD" },
  compras: [{ fornecedor, cnpj, valor, data, documento }],
  total: numeric
}
```
O Financeiro adiciona em "Saídas" no Fluxo de Caixa.

### 5.3 Autenticação entre serviços
- Header: `X-Internal-Api-Key: <INTERNAL_API_KEY>`
- A chave é a mesma variável `INTERNAL_API_KEY` do Financeiro
- Credenciais ficam no Railway de cada serviço

---

## 6. FUNCIONALIDADES

### 6.1 Dashboard
- Total de SKUs cadastrados
- Valor total do estoque (custo)
- Valor total do estoque (venda)
- Produtos com estoque baixo (abaixo do mínimo)
- Produtos sem movimento (30+ dias)
- Últimas 10 movimentações
- Gráfico: entradas vs saídas (últimos 6 meses)

### 6.2 Importação de Planilha Excel
Colunas esperadas:
| Coluna | Obrigatório | Exemplo |
|---|---|---|
| Código | Sim | "FLT-001" |
| Nome | Sim | "Filtro de Entrada 10 Pol" |
| Descrição | Não | "Filtro descartável" |
| Unidade | Não (default UN) | "UN", "KG", "LT" |
| Categoria | Não | "Filtro", "Refil", "Acessório" |
| NCM | Não | "8421.23.00" |
| GTIN/EAN | Não | "7891234567890" |
| Preço Custo | Não | 45.90 |
| Preço Venda | Não | 89.90 |
| Estoque Mínimo | Não | 10 |
| Estoque Atual | Não | 50 |
| Localização | Não | "Prateleira A-1" |

Validações:
- Código duplicado no Excel → rejeita linha
- Nome vazio → rejeita linha
- Preço negativo → rejeita linha
- Formato NCM inválido → rejeita linha

Dry-run: mostra preview do que seria importado, com contagem de:
- Linhas válidas
- Linhas duplicadas (código já existe)
- Linhas com erro (motivo)

### 6.3 Cadastro Manual de Produtos
Formulário com todos os campos da seção 4.1.
Validação: código único por empresa.

### 6.4 Movimentações
**Entrada:**
- Tipo: entrada
- Operação: compra | devolução_entrada
- Campos: produto, quantidade, valor unitário, fornecedor, documento (NF), observação
- Ao registrar: atualiza `estoque_saldo.saldo_atual += quantidade`
- Ao registrar: atualiza `estoque_saldo.custo_medio` (média ponderada)
- Ao registrar: cria vínculo com `pedido_compra` se houver

**Saída:**
- Tipo: saída
- Operação: venda | perda | quebra | devolução_saida
- Campos: produto, quantidade, observação
- Validação: saldo_atual >= quantidade (bloqueia se negativo)
- Ao registrar: atualiza `estoque_saldo.saldo_atual -= quantidade`

**Ajuste:**
- Tipo: ajuste
- Operação: inventario | ajuste
- Campos: produto, quantidade nova (substitui), observação
- Não usa valor (não é transação financeira)

### 6.5 Saldos e Inventário
- Grid: Produto | Saldo Atual | Reservado | Disponível | Mín. | Máx. | Valor Custo | Valor Venda | Status
- Status: OK | Baixo | Crítico | Zezo | Acima do máximo
- Ordenável por qualquer coluna
- Filtravel por categoria, status, localizacao
- Inventário: comparação saldo sistema × saldo físico digitado → gera ajustes

### 6.6 Pedidos de Compra
- Criar pedido: fornecedor, data entrega, itens
- Status: pendente → confirmado → recebido → cancelado
- Ao marcar como "recebido": cria entradas de estoque para cada item
- Converte para movimentações automaticamente

### 6.7 Alertas de Estoque Mínimo
- Tela dedicada de alertas
- Produtos abaixo do mínimo: badge vermelho no dashboard
- Notificação visual quando saldo < estoque_minimo
- threshold configurável: alerta em 100% / 80% / 50% do mínimo

### 6.8 Sincronização OMIE (NF-e de Compra)
- Botão "Sync OMIE" na tela de Configurações
- Busca `ListarPedidos` com filtro de natureza = compra
- Para cada pedido de compra:
  1. Identifica fornecedores
  2. Identifica produtos (pelo código/nome)
  3. Cross-check: produto existe no estoque?
     - **Sim:** marca como "verificado OMIE"
     - **Não:** adiciona à lista de "produtos OMIE sem cadastro"
- Não cria movimentação automaticamente — só sinaliza para revisão

---

## 7. ROTAS DA API

### 7.1 Produtos
```
GET    /api/produtos              — lista (com filtros: categoria, nome, ativo)
GET    /api/produtos/:id           — detalhe
POST   /api/produtos              — criar
PUT    /api/produtos/:id          — editar
DELETE /api/produtos/:id          — desativar (soft delete)
POST   /api/produtos/importar     — importar planilha (multipart: file=xlsx)
GET    /api/produtos/importar/template — baixar template Excel
```

### 7.2 Movimentações
```
GET    /api/movimentacoes          — lista (filtros: produto, tipo, operacao, data_de, data_ate)
POST   /api/movimentacoes          — registrar (entrada, saida, ajuste)
GET    /api/movimentacoes/:id      — detalhe
```

### 7.3 Saldos
```
GET    /api/saldos                 — grid completo (com status, filtros)
GET    /api/saldos/produto/:id     — histórico de saldo de um produto
POST   /api/saldos/recalcular      — força recalcular saldo de um produto (admin)
```

### 7.4 Pedidos de Compra
```
GET    /api/pedidos-compra          — lista
POST   /api/pedidos-compra          — criar
GET    /api/pedidos-compra/:id      — detalhe
PUT    /api/pedidos-compra/:id      — editar
POST   /api/pedidos-compra/:id/receber — marcar como recebido (gera entradas)
DELETE /api/pedidos-compra/:id      — cancelar
```

### 7.5 Financeiro (integração)
```
POST   /api/financeiro/cmv         — enviar CMV para o Financeiro
POST   /api/financeiro/compras      — enviar compras para o Fluxo
GET    /api/financeiro/empresas     — buscar empresas do Financeiro
```

### 7.6 Alertas
```
GET    /api/alertas/estoque-minimo  — produtos abaixo do mínimo
GET    /api/alertas/sem-movimento   — produtos sem movimento (30+ dias)
GET    /api/alertas/omie-divergente — produtos OMIE sem cadastro
```

### 7.7 Sync
```
POST   /api/sync/omie               — sincronizar com OMIE (NF-e)
POST   /api/sync/zoho               — sincronizar com ZOHO (catálogo)
GET    /api/sync/status             — status das últimas sincronizações
```

---

## 8. AUTENTICAÇÃO

Mesma estratégia do TDF Financeiro:
- Sessão em tabela (não em memória)
- Cookie `session_id` com httpOnly
- Tabela `usuarios` com email corporativo `@tudodefiltro.com.br`
- Perfis: `administrador` | `estoquista` | `financeiro`
- Login via `/api/auth/login`
- Logout via `/api/auth/logout`
- Me (`/api/auth/me`) retorna usuário logado

---

## 9. DESIGN SYSTEM

Usar o mesmo estilo do TDF Financeiro:
- **Paleta de cores extraída do logo:**
  - Verde-água: hsl(174 58% 47%) — primary / accent-brand
  - Âmbar: hsl(37 79% 57%) — accent-warn
  - Coral: hsl(11 60% 58%) — destructive
  - Azul-marinho: hsl(213 64% 33%) — accent-cool
- **Tipografia:** Inter / system-ui
- **Dark mode:** via classe `.dark` no `<html>`
- **Componentes:** shadcn/ui
- **Ícones:** Lucide React

---

## 10. CREDENCIAIS

Todas as credenciais ficam em variáveis de ambiente no Railway.

| Variável | Descrição | Onde está |
|---|---|---|
| `DATABASE_URL` | Postgres do tdf-estoque | Railway (criar) |
| `INTERNAL_API_KEY` | Chave para comunicar com Financeiro | Buscar no Railway Financeiro |
| `OMIE_APP_KEY` | OMIE TDF | Sessão "Apresentação TDF" |
| `OMIE_APP_SECRET` | OMIE TDF | Sessão "Apresentação TDF" |
| `ZOHO_CLIENT_ID` | ZOHO CRM | Sessão "Apresentação TDF" |
| `ZOHO_CLIENT_SECRET` | ZOHO CRM | Sessão "Apresentação TDF" |
| `ZOHO_REFRESH_TOKEN` | ZOHO CRM | Sessão "Apresentação TDF" |
| `FINANCEIRO_API_URL` | URL do Financeiro | `https://tdf-financeiro.up.railway.app` |

---

## 11. DEPLOY

- **Frontend:** Vercel (mesma conta do Financeiro) ou Railway
- **Backend:** Railway (mesmo fluxo do Financeiro)
- **Banco:** Postgres Railway (novo projeto `tdf-estoque`)
- **Domínio:** `tdf-estoque.up.railway.app` ou custom domain

---

## 12. FASES DE IMPLEMENTAÇÃO

### Fase 1 — Infraestrutura e Catálogo (atual)
- [x] Repositório criado
- [ ] Schema SQL completo
- [ ] Auth (login, logout, sessão)
- [ ] CRUD de produtos (manual)
- [ ] Importação de planilha Excel
- [ ] Tela: Produtos

### Fase 2 — Movimentações
- [ ] CRUD de movimentações (entrada/saída/ajuste)
- [ ] Recalcular saldo automático
- [ ] Tela: Movimentações
- [ ] Tela: Saldos
- [ ] Alertas de estoque mínimo

### Fase 3 — Pedidos de Compra
- [ ] CRUD de pedidos de compra
- [ ] Recebimento de pedido → entrada automática
- [ ] Tela: Pedidos de Compra

### Fase 4 — Dashboard e KPIs
- [ ] Dashboard com gráficos
- [ ] KPIs de estoque
- [ ] Inventário (comparação física × sistema)

### Fase 5 — Integração Financeiro
- [ ] Criar rotas no Financeiro para receber CMV e compras
- [ ] Enviar CMV do estoque → Financeiro DRE
- [ ] Enviar compras do estoque → Financeiro Fluxo

### Fase 6 — Sincronização OMIE/ZOHO
- [ ] Conector OMIE (NF-e de compra)
- [ ] Conector ZOHO (catálogo)
- [ ] Tela de sync com preview
- [ ] Alertas de divergência
