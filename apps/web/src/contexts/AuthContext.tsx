import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/api'

interface Usuario {
  id: number
  nome: string
  email: string
  perfil: string
}

interface AuthContextType {
  usuario: Usuario | null
  loading: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Buscar dados do usuário
        setUsuario({
          id: 1,
          nome: session.user.user_metadata?.nome || session.user.email || 'Usuário',
          email: session.user.email || '',
          perfil: session.user.user_metadata?.perfil || 'estoquista',
        })
      }
      setLoading(false)
    })
  }, [])

  const login = async (email: string, senha: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
    if (data.user) {
      setUsuario({
        id: 1,
        nome: data.user.user_metadata?.nome || email,
        email: data.user.email || '',
        perfil: data.user.user_metadata?.perfil || 'estoquista',
      })
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
