-- TDF Controle de Estoque — Movimentações, Saldo, Categorias, Localizações
-- Execute no Supabase SQL Editor após a 001

-- ============================
-- 1. Saldo atual por produto
-- ============================
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS saldo_atual NUMERIC(12,2) DEFAULT 0;

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS saldo_atualizado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS produtos_saldo_atual_idx
  ON produtos (saldo_atual)
  WHERE ativo = true;

-- ============================
-- 2. Categorias (era TEXT solto em produtos)
-- ============================
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE INDEX IF NOT EXISTS categorias_empresa_idx
  ON categorias (empresa_id, ativa);

-- Backfill: criar categoria para todo nome distinto que já existe em produtos
INSERT INTO categorias (empresa_id, nome)
SELECT DISTINCT empresa_id, categoria
FROM produtos
WHERE categoria IS NOT NULL AND categoria <> ''
ON CONFLICT (empresa_id, nome) DO NOTHING;

-- ============================
-- 3. Localizações (era TEXT solto em produtos)
-- ============================
CREATE TABLE IF NOT EXISTS localizacoes (
  id SERIAL PRIMARY KEY,
  empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS localizacoes_empresa_idx
  ON localizacoes (empresa_id, ativa);

-- Backfill de localizações
INSERT INTO localizacoes (empresa_id, codigo)
SELECT DISTINCT empresa_id, localizacao
FROM produtos
WHERE localizacao IS NOT NULL AND localizacao <> ''
ON CONFLICT (empresa_id, codigo) DO NOTHING;

-- ============================
-- 4. Histórico de movimentações
-- ============================
CREATE TABLE IF NOT EXISTS movimentacoes (
  id BIGSERIAL PRIMARY KEY,
  empresa_id INT NOT NULL REFERENCES empresas(id),
  produto_id INT NOT NULL REFERENCES produtos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','inventario')),
  quantidade NUMERIC(12,2) NOT NULL CHECK (quantidade > 0),
  saldo_anterior NUMERIC(12,2),
  saldo_posterior NUMERIC(12,2),
  documento TEXT,
  observacao TEXT,
  usuario_id BIGINT REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS movimentacoes_produto_idx
  ON movimentacoes (produto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS movimentacoes_tipo_idx
  ON movimentacoes (tipo, created_at DESC);

CREATE INDEX IF NOT EXISTS movimentacoes_empresa_idx
  ON movimentacoes (empresa_id, created_at DESC);

-- ============================
-- 5. Trigger: atualiza saldo na inserção de movimentação
-- ============================
CREATE OR REPLACE FUNCTION atualizar_saldo_produto()
RETURNS TRIGGER AS $$
DECLARE
  anterior NUMERIC(12,2);
  posterior NUMERIC(12,2);
BEGIN
  SELECT COALESCE(saldo_atual, 0) INTO anterior
    FROM produtos WHERE id = NEW.produto_id
    FOR UPDATE;

  IF NEW.tipo IN ('entrada','inventario') THEN
    posterior := anterior + NEW.quantidade;
  ELSIF NEW.tipo = 'saida' THEN
    posterior := anterior - NEW.quantidade;
  ELSIF NEW.tipo = 'ajuste' THEN
    -- ajuste é um valor absoluto que substitui o saldo, não soma
    posterior := NEW.quantidade;
  END IF;

  UPDATE produtos
     SET saldo_atual = posterior,
         saldo_atualizado_em = now()
   WHERE id = NEW.produto_id;

  NEW.saldo_anterior := anterior;
  NEW.saldo_posterior := posterior;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_saldo ON movimentacoes;
CREATE TRIGGER trg_atualizar_saldo
  BEFORE INSERT ON movimentacoes
  FOR EACH ROW EXECUTE FUNCTION atualizar_saldo_produto();

-- ============================
-- 6. Backfill de saldo (a partir do estoque_minimo atual)
-- Aproveita o conteúdo já importado pelo Marcos.
-- ============================
UPDATE produtos
   SET saldo_atual = COALESCE(estoque_minimo, 0),
       saldo_atualizado_em = now()
 WHERE saldo_atual IS NULL OR saldo_atual = 0;

-- ============================
-- 7. RLS
-- service_role bypassa, então a API atual continua funcionando.
-- Policies só para usuários que acessam via anon/authenticated.
-- ============================
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE localizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel categorias" ON categorias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sel localizacoes" ON localizacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sel movimentacoes" ON movimentacoes
  FOR SELECT TO authenticated USING (true);
