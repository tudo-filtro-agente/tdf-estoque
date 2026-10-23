-- TDF Controle de Estoque — Limpar RLS policies legadas (em chinês) e
-- estabelecer policies explícitas, somente-leitura para a chave
-- authenticated. A API usa service_role (bypassa RLS), então escrita
-- continua passando pelo backend como hoje.

-- Remover policies antigas da 001
DROP POLICY IF EXISTS "允许已认证用户读取企业"   ON empresas;
DROP POLICY IF EXISTS "允许已认证用户读取来源"   ON fontes;
DROP POLICY IF EXISTS "允许已认证用户读取用户"   ON usuarios;
DROP POLICY IF EXISTS "允许已认证用户读取产品"   ON produtos;
DROP POLICY IF EXISTS "允许已认证用户操作产品"   ON produtos;

-- Produtos
DROP POLICY IF EXISTS "produtos_select_authenticated" ON produtos;
CREATE POLICY "produtos_select_authenticated"
  ON produtos FOR SELECT TO authenticated USING (true);

-- Empresas
DROP POLICY IF EXISTS "empresas_select_authenticated" ON empresas;
CREATE POLICY "empresas_select_authenticated"
  ON empresas FOR SELECT TO authenticated USING (true);

-- Fontes
DROP POLICY IF EXISTS "fontes_select_authenticated" ON fontes;
CREATE POLICY "fontes_select_authenticated"
  ON fontes FOR SELECT TO authenticated USING (true);

-- Usuários: usuário pode ler o próprio registro, gestor vê todos
DROP POLICY IF EXISTS "usuarios_select_authenticated_self" ON usuarios;
CREATE POLICY "usuarios_select_authenticated_self"
  ON usuarios FOR SELECT TO authenticated
  USING (
    email = (auth.jwt() ->> 'email')::text
    OR EXISTS (
      SELECT 1 FROM usuarios u2
      WHERE u2.email = (auth.jwt() ->> 'email')::text
        AND u2.perfil = 'administrador'
    )
  );

-- A migration 002 já criou policies para categorias, localizacoes e
-- movimentacoes — mantenha-as.
