import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api, type Usuario } from '@/lib/api'

interface AuthContextType {
  usuario: Usuario | null
  loading: boolean
  login: (email: string, senha: string) => Promise<void>
  register: (nome: string, email: string, senha: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ success: boolean; devToken?: string; message?: string }>
  resetPassword: (token: string, senha: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'tdf_token'
const USER_KEY = 'tdf_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar sessão salva no localStorage
    const token = localStorage.getItem(TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)

    if (token && userStr) {
      try {
        setUsuario(JSON.parse(userStr))
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, senha: string) => {
    const data = await api<{ usuario: Usuario; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email, senha },
    })

    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))
    setUsuario(data.usuario)
  }

  const register = async (nome: string, email: string, senha: string) => {
    const data = await api<{ usuario: Usuario; token: string }>('/api/auth/register', {
      method: 'POST',
      body: { nome, email, senha },
    })

    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))
    setUsuario(data.usuario)
  }

  const requestPasswordReset = async (email: string) => {
    return await api<{ success: boolean; devToken?: string; message?: string }>(
      '/api/auth/forgot',
      {
        method: 'POST',
        body: { email },
      }
    )
  }

  const resetPassword = async (token: string, senha: string) => {
    await api('/api/auth/reset', {
      method: 'POST',
      body: { token, senha },
    })
  }

  const logout = async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      try {
        await api('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // Ignora erro de logout - vai deslogar mesmo assim
      }
    }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUsuario(null)
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        loading,
        login,
        register,
        requestPasswordReset,
        resetPassword,
        logout,
      }}
    >
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
