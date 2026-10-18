import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// API wrapper para chamadas backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface ApiOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

export async function api<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

// Tipos
export interface Usuario {
  id: number
  nome: string
  email: string
  perfil: 'administrador' | 'estoquista' | 'financeiro'
}

export interface AuthResponse {
  usuario: Usuario
  token: string
}

export interface BootstrapResponse {
  empresa: string
  versao: string
  fontes: Array<{ id: number; codigo: string; nome: string; tipo: string }>
}

export interface Produto {
  id: number
  empresa_id: number
  codigo: string
  nome: string
  descricao?: string
  unidade: string
  categoria?: string
  ncm?: string
  gtin?: string
  preco_custo?: number
  preco_venda?: number
  markup_padrao?: number
  estoque_minimo?: number
  estoque_maximo?: number
  localizacao?: string
  ativo: boolean
  created_at: string
}

export interface ProdutoFormData {
  codigo: string
  nome: string
  descricao?: string
  unidade?: string
  categoria?: string
  ncm?: string
  gtin?: string
  preco_custo?: number
  preco_venda?: number
  markup_padrao?: number
  estoque_minimo?: number
  estoque_maximo?: number
  localizacao?: string
}
