import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// API wrapper para chamadas backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Chaves do localStorage (devem bater com AuthContext)
const TOKEN_KEY = 'tdf_token'
const USER_KEY = 'tdf_user'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

interface ApiOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  responseType?: 'json' | 'blob'
}

/**
 * Erro de API que carrega o status HTTP e sinaliza quando a falha foi
 * por cota do Supabase (429/503), e não por dado inválido do usuário.
 */
export class ApiError extends Error {
  status: number
  /** true quando a API ou o Supabase recusou por excesso de requisições. */
  porCota: boolean

  constructor(message: string, status: number, porCota: boolean) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.porCota = porCota
  }
}

export async function api<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, responseType = 'json' } = options

  const token = getToken()

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (response.status === 401) {
    clearAuth()
    alert('Sessão expirada. Faça login novamente.')
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }

  if (!response.ok) {
    if (responseType === 'blob') {
      throw new ApiError(`HTTP ${response.status}`, response.status, response.status === 429)
    }

    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }))

    // 429 do Supabase e 503 da nossa API (cota estourada) não são problema
    // de senha nem de dado: a tela precisa mandar o usuário esperar, não corrigir.
    const porCota =
      response.status === 429 ||
      response.status === 503 ||
      error.erroCota === true

    throw new ApiError(error.message || `HTTP ${response.status}`, response.status, porCota)
  }

  if (responseType === 'blob') {
    return (await response.blob()) as unknown as T
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

export const PERFIS_META: Array<{ value: Usuario['perfil']; label: string }> = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'estoquista', label: 'Estoquista' },
  { value: 'financeiro', label: 'Financeiro' },
]

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
  saldo_atual?: number
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

// ===== Estoque =====

export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste' | 'inventario'

export interface Movimentacao {
  id: number
  empresa_id: number
  produto_id: number
  tipo: TipoMovimentacao
  quantidade: number
  saldo_anterior?: number
  saldo_posterior?: number
  documento?: string
  observacao?: string
  usuario_id?: number
  created_at: string
  produto?: {
    id: number
    codigo: string
    nome: string
    unidade: string
  } | null
  usuario?: { id: number; nome: string } | null
}

export interface MovimentacaoFormData {
  produto_id: number
  tipo: TipoMovimentacao
  quantidade: number
  documento?: string
  observacao?: string
}

export interface TipoMovimentacaoMeta {
  value: TipoMovimentacao
  label: string
  cor: string
  sinal: number
}

export interface DashboardKpis {
  total_produtos_ativos: number
  valor_total_estoque: number
  total_abaixo_minimo: number
  total_sem_movimento_30d: number
  total_categorias: number
  total_movimentacoes_30d: number
  total_entradas_30d: number
  total_saidas_30d: number
}

export interface AlertaEstoqueMinimo {
  id: number
  codigo: string
  nome: string
  categoria?: string
  unidade: string
  saldo_atual: number
  estoque_minimo: number
  deficit: number
  localizacao?: string
}

export interface MovimentacaoPorDia {
  dia: string
  entrada: number
  saida: number
}

export interface ResumoMovimentacao {
  tipo: TipoMovimentacao
  total_quantidade: number
  total_movimentos: number
}

export interface ResumoPorCategoria {
  categoria: string
  total_produtos: number
  total_estoque: number
  valor_total: number
}

export interface ResumoPorLocalizacao {
  localizacao: string
  total_produtos: number
  total_estoque: number
  valor_total: number
}

// ===== Cadastros =====

export interface Categoria {
  id: number
  empresa_id: number
  nome: string
  descricao?: string
  ativa: boolean
  created_at: string
}

export interface UsuarioGerenciado {
  id: number
  nome: string
  email: string
  perfil: 'administrador' | 'estoquista' | 'financeiro'
  ativo: boolean
  ultimo_login?: string
  created_at: string
}

// Alias usado em algumas telas que tratam o "usuário atual" e o "gerenciado" como o mesmo tipo
export type UsuarioFormData = {
  nome: string
  email: string
  senha?: string
  perfil: UsuarioGerenciado['perfil']
  ativo: boolean
}

// ===== Fontes =====
export interface Fonte {
  id: number
  empresa_id: number
  codigo: string
  nome: string
  tipo: 'api' | 'arquivo' | 'manual'
  base_url?: string
  ativa: boolean
  ultimo_sync?: string
  ultima_falha?: string
  created_at: string
}

export type FonteFormData = {
  codigo: string
  nome: string
  tipo: Fonte['tipo']
  base_url?: string
  ativa: boolean
}

// ===== Cadastros auxiliares =====
export interface Localizacao {
  id: number
  empresa_id: number
  codigo: string
  descricao?: string
  ativa: boolean
  uso_count?: number
  created_at: string
}

export interface Unidade {
  id: number
  empresa_id: number
  sigla: string
  descricao?: string
  ativa: boolean
  uso_count?: number
  created_at: string
}

export const TIPOS_MOVIMENTACAO_META: TipoMovimentacaoMeta[] = [
  { value: 'entrada', label: 'Entrada', cor: 'green', sinal: 1 },
  { value: 'saida', label: 'Saída', cor: 'red', sinal: -1 },
  { value: 'ajuste', label: 'Ajuste', cor: 'amber', sinal: 0 },
  { value: 'inventario', label: 'Inventário', cor: 'blue', sinal: 1 },
]
