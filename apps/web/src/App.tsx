import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './routes/LoginPage'
import Layout from './routes/Layout'
import ProdutosPage from './routes/ProdutosPage'
import ImportarPage from './routes/ImportarPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/produtos" replace />} />
        <Route path="produtos" element={<ProdutosPage />} />
        <Route path="importar" element={<ImportarPage />} />
      </Route>
    </Routes>
  )
}

export default App
