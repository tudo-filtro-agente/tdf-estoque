import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './routes/LoginPage'
import RegistroPage from './routes/RegistroPage'
import EsqueciSenhaPage from './routes/EsqueciSenhaPage'
import Layout from './routes/Layout'
import ProdutosPage from './routes/ProdutosPage'
import ImportarPage from './routes/ImportarPage'
import DashboardPage from './routes/DashboardPage'
import MovimentacoesPage from './routes/MovimentacoesPage'
import CategoriasPage from './routes/CategoriasPage'
import RelatoriosPage from './routes/RelatoriosPage'
import UsuariosPage from './routes/UsuariosPage'
import CadastrosPage from './routes/CadastrosPage'
import FontesPage from './routes/FontesPage'
import { type Usuario } from './lib/api'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    )
  }
  if (!usuario) return <Navigate to="/login" replace />
  return <>{children}</>
}

/**
 * Restringe a rota a um conjunto de perfis. Use em volta da rota:
 *   <RequirePerfil perfis={['administrador']}><Page/></RequirePerfil>
 */
function RequirePerfil({
  perfis,
  children,
}: {
  perfis: Array<Usuario['perfil']>
  children: React.ReactNode
}) {
  const { usuario } = useAuth()
  if (!usuario || !perfis.includes(usuario.perfil)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="produtos" element={<ProdutosPage />} />
        <Route
          path="movimentacoes"
          element={
            <RequirePerfil perfis={['administrador', 'estoquista']}>
              <MovimentacoesPage />
            </RequirePerfil>
          }
        />
        <Route path="importar" element={<ImportarPage />} />
        <Route
          path="categorias"
          element={
            <RequirePerfil perfis={['administrador']}>
              <CategoriasPage />
            </RequirePerfil>
          }
        />
        <Route
          path="relatorios"
          element={
            <RequirePerfil perfis={['administrador', 'financeiro']}>
              <RelatoriosPage />
            </RequirePerfil>
          }
        />
        <Route path="cadastros" element={<CadastrosPage />} />
        <Route
          path="fontes"
          element={
            <RequirePerfil perfis={['administrador']}>
              <FontesPage />
            </RequirePerfil>
          }
        />
        <Route
          path="usuarios"
          element={
            <RequirePerfil perfis={['administrador']}>
              <UsuariosPage />
            </RequirePerfil>
          }
        />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App