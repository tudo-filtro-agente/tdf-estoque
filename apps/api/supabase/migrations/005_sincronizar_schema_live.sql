-- TDF Controle de Estoque — Sincronização do schema com o banco existente
--
-- POR QUE ESTE ARQUIVO EXISTE
-- O banco em produção foi criado a partir de uma versão ANTIGA da 001
-- (sem markup_padrao, estoque_maximo, id_origem, raw, updated_at, base_url,
-- ultimo_sync, ultima_falha, ultimo_login, ip, user_agent) e nunca recebeu
-- as migrations 002/003/004.
--
-- A 001 original usa `CREATE TABLE IF NOT EXISTS`: reexecutá-la NÃO cria
-- colunas novas em tabelas que já existem. Por isso este arquivo usa
-- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para as colunas faltantes e
-- `DROP ... IF EXISTS` antes de cada CREATE de trigger/policy.
--
-- ESTE ARQUIVO É IDEMPOTENTE: pode ser executado quantas vezes quiser.
-- Em um banco novo (001 → 005) ele é inofensivo.
--
-- Execute no Supabase SQL Editor (ou via psql).

-- ============================================================
-- 1. Colunas faltantes nas tabelas que já existem
-- ============================================================
ALTER TABLE empresas   ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

ALTER TABLE fontes     ADD COLUMN IF NOT EXISTS base_url     TEXT;
ALTER TABLE fontes     ADD COLUMN IF NOT EXISTS ultimo_sync  TIMESTAMPTZ;
ALTER TABLE fontes     ADD COLUMN IF NOT EXISTS ultima_falha TEXT;

ALTER TABLE usuarios   ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMPTZ;
ALTER TABLE usuarios   ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

ALTER TABLE sessoes    ADD COLUMN IF NOT EXISTS ip        TEXT;
ALTER TABLE sessoes    ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE produtos  ADD COLUMN IF NOT EXISTS markup_padrao       NUMERIC(5,2);
ALTER TABLE produtos  ADD COLUMN IF NOT EXISTS estoque_maximo     NUMERIC(10,2);
ALTER TABLE produtos  ADD COLUMN IF NOT EXISTS id_origem          TEXT;
ALTER TABLE produtos  ADD COLUMN IF NOT EXISTS raw                JSONB;
ALTER TABLE produtos  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT now();
ALTER TABLE produtos  ADD COLUMN IF NOT EXISTS saldo_atual        NUMERIC(12,2) DEFAULT 0;
ALTER TABLE produtos  ADD COLUMN IF NOT EXISTS saldo_atualizado_em TIMESTAMPTZ;

-- ============================================================
-- 2. Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS produtos_categoria_idx  ON produtos (categoria);
CREATE INDEX IF NOT EXISTS produtos_nome_idx      ON produtos (nome);
CREATE INDEX IF NOT EXISTS produtos_ativo_idx     ON produtos (ativo);
CREATE INDEX IF NOT EXISTS produtos_saldo_atual_idx ON produtos (saldo_atual) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS sessoes_usuario_id_idx ON sessoes (usuario_id);
CREATE INDEX IF NOT EXISTS sessoes_expira_em_idx  ON sessoes (expira_em);

-- ============================================================
-- 3. Tabelas novas (idênticas às definições de 002/003)
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
CREATE INDEX IF NOT EXISTS categorias_empresa_idx ON categorias (empresa_id, ativa);

CREATE TABLE IF NOT EXISTS localizacoes (
  id SERIAL PRIMARY KEY,
  empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE INDEX IF NOT EXISTS localizacoes_empresa_idx ON localizacoes (empresa_id, ativa);

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
CREATE INDEX IF NOT EXISTS movimentacoes_produto_idx ON movimentacoes (produto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS movimentacoes_tipo_idx    ON movimentacoes (tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS movimentacoes_empresa_idx ON movimentacoes (empresa_id, created_at DESC);

CREATE TABLE IF NOT EXISTS unidades (
  id SERIAL PRIMARY KEY,
  empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  sigla TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, sigla)
);
CREATE INDEX IF NOT EXISTS unidades_empresa_idx ON unidades (empresa_id, ativa);

-- ============================================================
-- 4. Trigger de saldo — recalcula produtos.saldo_atual a cada movimentação
-- ============================================================
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

-- ============================================================
-- 5. Triggers de updated_at (idempotentes)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_empresas_updated_at  ON empresas;
CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_produtos_updated_at ON produtos;
CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. Backfill dos saldos e tabelas auxiliares
-- Usa saldo_atualizado_em IS NULL como marcador de "nunca apurado",
-- para não sobrescrever saldos reais em execuções futuras.
-- ============================================================
UPDATE produtos
   SET saldo_atual = COALESCE(estoque_minimo, 0),
       saldo_atualizado_em = now()
 WHERE saldo_atualizado_em IS NULL;

INSERT INTO categorias (empresa_id, nome)
SELECT DISTINCT empresa_id, categoria
  FROM produtos
 WHERE categoria IS NOT NULL AND categoria <> ''
ON CONFLICT (empresa_id, nome) DO NOTHING;

INSERT INTO localizacoes (empresa_id, codigo)
SELECT DISTINCT empresa_id, localizacao
  FROM produtos
 WHERE localizacao IS NOT NULL AND localizacao <> ''
ON CONFLICT (empresa_id, codigo) DO NOTHING;

INSERT INTO unidades (empresa_id, sigla)
SELECT DISTINCT empresa_id, UPPER(unidade)
  FROM produtos
 WHERE unidade IS NOT NULL AND unidade <> ''
ON CONFLICT (empresa_id, sigla) DO NOTHING;

INSERT INTO unidades (empresa_id, sigla, descricao)
VALUES
  (1, 'UN',  'Unidade'),
  (1, 'CX',  'Caixa'),
  (1, 'KG',  'Quilograma'),
  (1, 'LT',  'Litro'),
  (1, 'MT',  'Metro'),
  (1, 'M2',  'Metro quadrado'),
  (1, 'M3',  'Metro cúbico'),
  (1, 'PCT', 'Pacote'),
  (1, 'PAR', 'Par'),
  (1, 'RL',  'Rolo')
ON CONFLICT (empresa_id, sigla) DO UPDATE SET descricao = EXCLUDED.descricao;

-- ============================================================
-- 7. RLS e policies
-- A API usa service_role (bypassa RLS); a autorização por perfil é
-- feita no backend. As policies abaixo cobrem acesso direto via
-- PostgREST com a chave anon/authenticated.
-- ============================================================
ALTER TABLE empresas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fontes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE localizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades     ENABLE ROW LEVEL SECURITY;

-- Remove policies legadas em chinês (vêm da 001)
DROP POLICY IF EXISTS "允许已认证用户读取企业" ON empresas;
DROP POLICY IF EXISTS "允许已认证用户读取来源" ON fontes;
DROP POLICY IF EXISTS "允许已认证用户读取用户" ON usuarios;
DROP POLICY IF EXISTS "允许已认证用户读取产品" ON produtos;
DROP POLICY IF EXISTS "允许已认证用户操作产品" ON produtos;

-- Regras de leitura
DROP POLICY IF EXISTS "empresas_select_authenticated"     ON empresas;
CREATE POLICY "empresas_select_authenticated" ON empresas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fontes_select_authenticated"       ON fontes;
CREATE POLICY "fontes_select_authenticated" ON fontes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "produtos_select_authenticated"     ON produtos;
CREATE POLICY "produtos_select_authenticated" ON produtos
  FOR SELECT TO authenticated USING (true);

-- Usuário lê o próprio registro; administrador lê todos
DROP POLICY IF EXISTS "usuarios_select_authenticated_self" ON usuarios;
CREATE POLICY "usuarios_select_authenticated_self" ON usuarios
  FOR SELECT TO authenticated
  USING (
    email = (auth.jwt() ->> 'email')::text
    OR EXISTS (
      SELECT 1 FROM usuarios u2
       WHERE u2.email = (auth.jwt() ->> 'email')::text
         AND u2.perfil = 'administrador'
    )
  );

DROP POLICY IF EXISTS "sel categorias"   ON categorias;
CREATE POLICY "sel categorias" ON categorias
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sel localizacoes" ON localizacoes;
CREATE POLICY "sel localizacoes" ON localizacoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sel movimentacoes" ON movimentacoes;
CREATE POLICY "sel movimentacoes" ON movimentacoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sel unidades"     ON unidades;
CREATE POLICY "sel unidades" ON unidades
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 8. Verificação (deve retornar 4 tabelas com as contagens)
-- ============================================================
SELECT 'categorias'   AS tabela, COUNT(*) FROM categorias
UNION ALL SELECT 'localizacoes',  COUNT(*) FROM localizacoes
UNION ALL SELECT 'unidades',      COUNT(*) FROM unidades
UNION ALL SELECT 'movimentacoes', COUNT(*) FROM movimentacoes
UNION ALL SELECT 'produtos_saldo', COUNT(*) FROM produtos WHERE saldo_atualizado_em IS NOT NULL;
