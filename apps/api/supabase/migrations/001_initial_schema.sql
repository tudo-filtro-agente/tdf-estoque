-- TDF Controle de Estoque — Schema Inicial
-- Execute isso no Supabase SQL Editor

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de empresas (espelho do Financeiro)
CREATE TABLE IF NOT EXISTS empresas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de fontes (origem dos dados)
CREATE TABLE IF NOT EXISTS fontes (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('api', 'arquivo', 'manual')),
  base_url TEXT,
  ultimo_sync TIMESTAMPTZ,
  ultima_falha TIMESTAMPTZ,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  perfil TEXT NOT NULL CHECK (perfil IN ('administrador', 'estoquista', 'financeiro')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de sessões (para custom auth)
CREATE TABLE IF NOT EXISTS sessoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  expira_em TIMESTAMPTZ NOT NULL,
  revogada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessoes_usuario_id_idx ON sessoes (usuario_id);
CREATE INDEX IF NOT EXISTS sessoes_expira_em_idx ON sessoes (expira_em);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  empresa_id INT NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT DEFAULT 'UN',
  categoria TEXT,
  ncm TEXT,
  gtin TEXT,

  -- Preços
  preco_custo NUMERIC(12,2),
  preco_venda NUMERIC(12,2),
  markup_padrao NUMERIC(5,2),

  -- Controle
  estoque_minimo NUMERIC(10,2) DEFAULT 0,
  estoque_maximo NUMERIC(10,2),
  localizacao TEXT,

  -- Origem
  fonte_id INT REFERENCES fontes(id),
  id_origem TEXT,
  raw JSONB,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS produtos_categoria_idx ON produtos (categoria);
CREATE INDEX IF NOT EXISTS produtos_nome_idx ON produtos (nome);
CREATE INDEX IF NOT EXISTS produtos_ativo_idx ON produtos (ativo);

-- Seed das fontes
INSERT INTO fontes (codigo, nome, tipo) VALUES
  ('manual', 'Cadastro Manual', 'manual'),
  ('excel', 'Importação Excel', 'arquivo'),
  ('omie', 'OMIE (NF-e)', 'api'),
  ('zoho', 'ZOHO CRM', 'api')
ON CONFLICT (codigo) DO NOTHING;

-- Seed empresa inicial
INSERT INTO empresas (id, nome, cnpj, ativa) VALUES
  (1, 'Tudo de Filtro - Matriz', '00.000.000/0001-00', true)
ON CONFLICT DO NOTHING;

-- Função para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fontes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- Policies básicas (ajuste conforme necessidade)
CREATE POLICY "允许已认证用户读取企业" ON empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "允许已认证用户读取来源" ON fontes FOR SELECT TO authenticated USING (true);
CREATE POLICY "允许已认证用户读取用户" ON usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "允许已认证用户读取产品" ON produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "允许已认证用户操作产品" ON produtos FOR ALL TO authenticated USING (true);
