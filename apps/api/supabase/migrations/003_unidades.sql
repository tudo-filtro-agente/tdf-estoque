-- TDF Controle de Estoque — Unidades de Medida
-- Execute no Supabase SQL Editor após a 002

CREATE TABLE IF NOT EXISTS unidades (
  id SERIAL PRIMARY KEY,
  empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  sigla TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, sigla)
);

CREATE INDEX IF NOT EXISTS unidades_empresa_idx
  ON unidades (empresa_id, ativa);

-- Backfill: garantir que todas as unidades já usadas em produtos existam
INSERT INTO unidades (empresa_id, sigla)
SELECT DISTINCT empresa_id, UPPER(unidade)
FROM produtos
WHERE unidade IS NOT NULL AND unidade <> ''
ON CONFLICT (empresa_id, sigla) DO NOTHING;

-- Unidades padrão do sistema
INSERT INTO unidades (empresa_id, sigla, descricao)
VALUES
  (1, 'UN', 'Unidade'),
  (1, 'CX', 'Caixa'),
  (1, 'KG', 'Quilograma'),
  (1, 'LT', 'Litro'),
  (1, 'MT', 'Metro'),
  (1, 'M2', 'Metro quadrado'),
  (1, 'M3', 'Metro cúbico'),
  (1, 'PCT', 'Pacote'),
  (1, 'PAR', 'Par'),
  (1, 'RL', 'Rolo')
ON CONFLICT (empresa_id, sigla) DO UPDATE SET descricao = EXCLUDED.descricao;

ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel unidades" ON unidades
  FOR SELECT TO authenticated USING (true);