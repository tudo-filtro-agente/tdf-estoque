/**
 * Cache de credenciais em memória para o fluxo de login.
 *
 * CONTEXTO
 * A API consulta o Supabase em toda tentativa de login (buscar usuário + criar
 * sessão). O plano free do Supabase tem cota baixa de requisições e devolve
 * HTTP 429 "Muitas tentativas de login" quando ela estoura.
 *
 * COMO AJUDA
 * Sucesso é cacheado por TTL curto: logins legítimos repetidos do mesmo
 * usuário (reabrir a tela, recarregar, retry da rede) saem sem tocar o banco.
 * O hash do usuário vem junto no cache, então qualquer alteração de senha,
 * perfil ou status invalida a entrada.
 *
 * O QUE NÃO É CACHEADO
 * Falha de senha. Não cacheamos hash de senha errada para não transformar a
 * tabela em oráculo de verificação de senha.
 *
 * LIMITES CONSCIENTES
 * - O cache vive na memória do processo. Com mais de uma instância da API
 *   (Railway, PM2 cluster), cada uma tem o seu.
 * - O cache é descartado quando o processo reinicia.
 */

/** Quanto tempo um login bem-sucedido evita consultas ao banco. */
const TTL_MS = 60 * 1000

/** Expurga entradas vencidas quando o mapa cresce, para não vazar memória. */
const MAX_ENTRADAS = 500

export interface CredencialCacheada {
  id: number
  nome: string
  email: string
  perfil: string
  ativo: boolean
  senhaHash: string | null
  /** Sentinel que impede revalidar senha até o TTL expirar. */
  senhaVerificada: true
  expiraEm: number
}

const cache = new Map<string, CredencialCacheada>()

/** Remove entradas vencidas. Sem isso, emails novos acumulariam para sempre. */
function expurgar(): void {
  const agora = Date.now()

  for (const [chave, entrada] of cache) {
    if (entrada.expiraEm <= agora) {
      cache.delete(chave)
    }
  }

  // Se ainda assim estourou o teto, descarta o mais antigo (Map preserva ordem de inserção).
  while (cache.size > MAX_ENTRADAS) {
    const maisAntiga = cache.keys().next()
    if (maisAntiga.done) break
    cache.delete(maisAntiga.value)
  }
}

export function chaveCredencial(email: string): string {
  return email.trim().toLowerCase()
}

/** Lê o cache. Retorna null quando não há entrada válida. */
export function obterDoCache(email: string): CredencialCacheada | null {
  const chave = chaveCredencial(email)
  const entrada = cache.get(chave)

  if (!entrada) return null

  if (entrada.expiraEm <= Date.now()) {
    cache.delete(chave)
    return null
  }

  return entrada
}

/** Grava o resultado de um login bem-sucedido. */
export function guardarNoCache(email: string, dados: Omit<CredencialCacheada, 'expiraEm' | 'senhaVerificada'>): void {
  const chave = chaveCredencial(email)

  if (cache.size >= MAX_ENTRADAS) {
    expurgar()
  }

  cache.set(chave, {
    ...dados,
    senhaVerificada: true,
    expiraEm: Date.now() + TTL_MS,
  })
}

/**
 * Invalida o cache de um usuário. Chamar sempre que a senha, o perfil ou o
 * status de ativo mudar, para que a próxima entrada use os dados do banco.
 */
export function invalidarCache(email: string): void {
  cache.delete(chaveCredencial(email))
}