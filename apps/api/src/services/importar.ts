import * as XLSX from 'xlsx'
import { supabaseAdmin } from '../db.js'
import { createProduto } from './produtos.js'
import { criarMovimentacao } from './movimentacoes.js'

export interface ImportRow {
  codigo?: string
  nome?: string
  descricao?: string
  unidade?: string
  categoria?: string
  ncm?: string
  gtin?: string
  preco_custo?: number
  preco_venda?: number
  /** Limiar de reposição — NÃO é a quantidade em estoque. */
  estoque_minimo?: number
  /**
   * Quantidade física em estoque no momento da importação.
   * Escrita como movimentação tipo 'inventario' para respeitar a trigger
   * que é a única a alterar `produtos.saldo_atual`.
   */
  saldo_inicial?: number
  localizacao?: string
  observacao?: string
  /** Linha original no Excel (1-indexed, contando o header). Usado só em mensagens de erro. */
  _linha?: number
}

export interface ImportValidationError {
  linha: number
  coluna: string
  valor?: any
  mensagem: string
}

export interface ImportResult {
  total: number
  importados: number
  duplicados: number
  erros: ImportValidationError[]
  produtos: ImportRow[]
  sheet?: string
}

export interface ParsedExcel {
  headers: string[]
  rows: Record<string, any>[]
  sheetName?: string
  allSheets: { name: string; rows: Record<string, any>[]; headers: string[] }[]
}

// Mapeamento expandido de colunas do Excel
const COLUMN_MAP: Record<string, keyof ImportRow> = {
  // Código
  'código': 'codigo',
  'codigo': 'codigo',
  'cod': 'codigo',
  'sku': 'codigo',
  'part number': 'codigo',
  'partnumber': 'codigo',

  // Nome/Descrição
  'nome': 'nome',
  'descrição': 'descricao',
  'descricao': 'descricao',
  'produto': 'nome',

  // Unidade
  'unidade': 'unidade',
  'unit': 'unidade',
  'un': 'unidade',

  // Categoria
  'categoria': 'categoria',
  'tipo': 'categoria',
  'type': 'categoria',

  // NCM/GTIN
  'ncm': 'ncm',
  'gtin': 'gtin',
  'ean': 'gtin',
  'barras': 'gtin',

  // Preços
  'preço custo': 'preco_custo',
  'preco custo': 'preco_custo',
  'custo': 'preco_custo',
  'preço venda': 'preco_venda',
  'preco venda': 'preco_venda',
  'venda': 'preco_venda',
  'preço': 'preco_venda',

  // Estoque (saldo físico vs mínimo de reposição)
  'estoque mínimo': 'estoque_minimo',
  'estoque_minimo': 'estoque_minimo',
  'minimo': 'estoque_minimo',
  'estoque': 'saldo_inicial',
  'qtde': 'saldo_inicial',
  'quantidade': 'saldo_inicial',
  'total': 'saldo_inicial',
  'qty': 'saldo_inicial',

  // Localização
  'localização': 'localizacao',
  'localizacao': 'localizacao',
  'local': 'localizacao',
  'prateleira': 'localizacao',
  'loacação': 'localizacao',
  'loacação ': 'localizacao',

  // Observação
  'observação': 'observacao',
  'observacao': 'observacao',
  'especificação': 'observacao',
  'especificacao': 'observacao',
  'spec': 'observacao',
  'obs': 'observacao',

  // Uso/Ponto de uso
  'ponto de uso': 'observacao',
  'uso da semana': 'observacao',
  'usa da semana': 'observacao',
}

// Mapeamento de abas para categorias
const SHEET_CATEGORIA_MAP: Record<string, string> = {
  'elementos': 'elementos',
  'ELEMENTOS': 'elementos',
  'ESTOQUE PURIFICADOR': 'purificadores',
  'purificadores': 'purificadores',
  'REFIL PURIFICADOR': 'refis',
  'refis': 'refis',
  'TANK': 'tanks',
  'tank': 'tanks',
  'VALVULAS': 'valvulas',
  'valvulas': 'valvulas',
  'VALVULA E CONEÇÕES': 'conexoes',
  'conexoes': 'conexoes',
  'VISÃO DA PROGRAMAÇÃO': 'programacao',
}

// Headers padrão por categoria (fallback quando não encontrar header)
const DEFAULT_HEADERS: Record<string, string[]> = {
  elementos: ['DESCRIÇÃO', 'ESTOQUE', 'USO DA SEMANA'],
  purificadores: ['LOACÃO', 'PART NUMBER', 'DESCRIÇÃO', 'QTDE'],
  refis: ['PART NUMBER', 'DESCRIÇÃO', 'PONTO DE USO', 'ESTOQUE', 'TOTAL'],
  tanks: ['PRODUTO', 'DESCRIÇÃO', 'ESPECIFICAÇÃO', 'UNIT', 'TOTAL'],
  valvulas: ['DESCRIÇÃO', 'ESPECIFICAÇÃO', 'QTDE'],
  conexoes: ['LOACÃO', 'PART NUMBER', 'DESCRIÇÃO', 'QTDE'],
}

function normalizeHeader(header: string): string {
  return String(header || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Sanitiza um valor que veio do Excel para garantir que entra no banco.
 * Strings soltas viram "" (campos nulos viram null) e strings em campos numéricos
 * viram numero, ou caem pra "" se não der.
 */
function toNum(value: any): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && !isNaN(value)) return value
  if (typeof value === 'string') {
    // Limpar texto (R$, espaco, virgula)
    const cleaned = value.replace(/[R$\s]/gi, '').replace(',', '.').replace(/[^0-9.\-]/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? null : n
  }
  return null
}
function toInt(value: any): number | null {
  const n = toNum(value)
  return n == null ? null : Math.round(n)
}
function toStr(value: any): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function parseSheetName(sheetName: string): { categoria: string; originalName: string } {
  const normalized = sheetName.trim()
  const categoria = SHEET_CATEGORIA_MAP[normalized] || SHEET_CATEGORIA_MAP[normalized.toUpperCase()] || 'outros'
  return { categoria, originalName: normalized }
}

/**
 * Detecta a linha de cabeçalho numa aba do Excel
 * Procura a primeira linha que tenha pelo menos 2 colunas com texto significativo
 * e contenha palavras-chave conhecidas (codigo, descricao, produto, qtde, etc.)
 */
function detectHeaderRow(rows: any[][]): { headerRowIndex: number; headers: string[] } {
  const HEADER_KEYWORDS = [
    'codigo', 'código', 'cod', 'sku', 'part number', 'partnumber',
    'nome', 'descricao', 'descrição', 'produto', 'description',
    'qtde', 'quantidade', 'qtd', 'qty', 'estoque', 'total',
    'unidade', 'unit', 'un',
    'localizacao', 'localização', 'local', 'prateleira', 'loacação', 'loacacao',
    'categoria', 'tipo', 'category',
    'especificacao', 'especificação', 'spec', 'observacao', 'observação',
    'frp', 'pc', 'tanque',
  ]

  let bestMatch = { headerRowIndex: -1, headers: [] as string[], score: 0 }

  // Procurar nos primeiros 15 linhas a MELHOR candidata a cabeçalho
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] as any[]
    if (!row) continue

    // Contar colunas com texto significativo
    const nonEmpty = row.filter(c => c != null && String(c).trim() !== '')

    // Precisa ter pelo menos 2 colunas não-vazias
    if (nonEmpty.length < 2) continue

    // Calcular score baseado em quantas palavras-chave aparecem
    let score = 0
    for (const c of nonEmpty) {
      const normalized = normalizeHeader(String(c))
      for (const kw of HEADER_KEYWORDS) {
        if (normalized.includes(kw)) {
          score += 1
          break // só conta 1 ponto por célula
        }
      }
    }

    if (score > bestMatch.score) {
      bestMatch = {
        headerRowIndex: i,
        headers: row.map(h => String(h || '').trim()),
        score
      }
    }
  }

  if (bestMatch.score > 0) {
    return { headerRowIndex: bestMatch.headerRowIndex, headers: bestMatch.headers }
  }

  // Fallback: usar primeira linha com 2+ colunas
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i] as any[]
    if (row && row.filter(c => c != null && String(c).trim() !== '').length >= 2) {
      return {
        headerRowIndex: i,
        headers: row.map(h => String(h || '').trim())
      }
    }
  }

  return { headerRowIndex: 0, headers: [] }
}

/**
 * TANK: cada produto ocupa 2 linhas. A 1ª tem FRP TANK/Especificação/Unit/Qtde/TOTAL.
 * A 2ª é só a cor (Color Natural / Color Blue / etc) sem nenhuma outra coluna.
 * Aqui junta as duas linhas e monta 1 produto por par.
 */
function parseTank(rows: any[][], headerRowIndex: number, categoria: string): Record<string, any>[] {
  const headerRow = rows[headerRowIndex] as any[]
  const h = headerRow.map(x => normalizeHeader(String(x || '')))

  // Índices das colunas que importam
  const idxDesc = h.findIndex(x => x.includes('descricao'))
  const idxEspec = h.findIndex(x => x.includes('especificacao'))
  const idxUnit = h.findIndex(x => x.includes('unit'))
  const idxTotal = h.findIndex(x => x.includes('total'))
  const idxProduto = h.findIndex(x => x.includes('produto'))

  if (idxDesc < 0) return []

  const out: Record<string, any>[] = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] as any[]
    if (!row) continue

    const desc = toStr(row[idxDesc])
    const espec = toStr(row[idxEspec])
    const unit = toStr(row[idxUnit])
    const total = toNum(row[idxTotal])
    const prod = toStr(row[idxProduto])

    // Linha principal: tem descrição E (especificação OU total OU unit)
    const isMain = !!desc && (!!espec || !!unit || total != null)
    if (!isMain) continue

    // Procurar linha de continuação abaixo (cor / observação)
    let extra = ''
    const nextRow = rows[i + 1] as any[] | undefined
    if (nextRow) {
      const nextDesc = toStr(nextRow[idxDesc])
      const nextEspec = toStr(nextRow[idxEspec])
      const nextTotal = toNum(nextRow[idxTotal])
      // Continuação: tem texto na desc, mas NÃO tem espec nem total (logo não é outra linha principal)
      if (nextDesc && !nextEspec && nextTotal == null) {
        extra = nextDesc
        i++ // pular a linha de continuação
      }
    }

    // Compor o nome final
    const nome = extra ? `${desc} — ${extra}` : desc

    out.push({
      codigo: null,
      nome,
      descricao: espec || desc,
      unidade: unit || 'PC',
      categoria,
      saldo_inicial: total,
      observacao: prod || undefined,
    })
  }

  return out
}

/**
 * VALVULAS: cada produto ocupa N linhas. A 1ª tem Automática Filter Valve + Especificação + Unit + Qtde.
 * As seguintes são fragmento de descrição: F71Q1 (55502), 2m³/h Time Type, American standard plug.
 * Aqui junta todas as linhas de fragmento em 1 nome só.
 */
function parseValvulas(rows: any[][], headerRowIndex: number, categoria: string): Record<string, any>[] {
  const headerRow = rows[headerRowIndex] as any[]
  const h = headerRow.map(x => normalizeHeader(String(x || '')))

  const idxDesc = h.findIndex(x => x.includes('descricao'))
  const idxEspec = h.findIndex(x => x.includes('especificacao'))
  const idxUnit = h.findIndex(x => x.includes('unit'))
  const idxQtde = h.findIndex(x => x.includes('qtde') || x.includes('total'))
  const idxProduto = h.findIndex(x => x.includes('produto'))

  if (idxDesc < 0) return []

  const out: Record<string, any>[] = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] as any[]
    if (!row) continue

    const desc = toStr(row[idxDesc])
    const espec = toStr(row[idxEspec])
    const unit = toStr(row[idxUnit])
    const qtde = toNum(row[idxQtde])
    const prod = toStr(row[idxProduto])

    // Linha principal: tem descrição E qtde (ou espec OU unit)
    const isMain = !!desc && (qtde != null || !!espec || !!unit)
    if (!isMain) continue

    // Gather linhas seguintes que são fragmentos (tem desc, mas sem qtde/espec/unit)
    const parts: string[] = [desc]
    let j = i + 1
    while (j < rows.length) {
      const nr = rows[j] as any[] | undefined
      if (!nr) break
      const nDesc = toStr(nr[idxDesc])
      const nEspec = toStr(nr[idxEspec])
      const nUnit = toStr(nr[idxUnit])
      const nQtde = toNum(nr[idxQtde])

      // Se tem qtde/espec/unit → é outra linha principal, parar
      if (nQtde != null || nEspec || nUnit) break
      // Se não tem nada → linha vazia, parar
      if (!nDesc) break
      // É fragmento
      parts.push(nDesc)
      j++
    }
    i = j - 1 // pular fragmentos

    out.push({
      codigo: null,
      nome: parts.join(' | '),
      descricao: espec || parts[0],
      unidade: unit || 'PC',
      categoria,
      saldo_inicial: qtde,
      observacao: prod || undefined,
    })
  }

  return out
}

/**
 * ELEMENTOS: tem 2 blocos empilhados verticalmente.
 * Bloco 1 (L3-L14): DESCRIÇÃO | SEPARADO | FECHADO | TOTAL | (col 8+) DESCRIÇÃO | Estoque | uso | saldo
 * Bloco 2 (L17-L24): (col 8+) DESCRIÇÃO | QTDE POR SACO | QTDE DE EMBAL. | TOTAL DE MATERIAL
 * Este parser detecta e processa ambos os blocos e junta por nome.
 */
function parseElementos(rows: any[][], headerRowIndex: number, categoria: string): Record<string, any>[] {
  const out: Record<string, any>[] = []
  const seen = new Map<string, Record<string, any>>()

  // Procurar blocos: cada linha que contém "DESCRIÇÃO" em qualquer coluna é inicio de bloco
  const blockHeaders: number[] = []
  for (let i = headerRowIndex; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] as any[] | undefined
    if (!row) continue
    const hasDescCol = row.some(c => normalizeHeader(String(c || '')).includes('descricao'))
    const hasQtdeCol = row.some(c => {
      const n = normalizeHeader(String(c || ''))
      return n.includes('qtde') || n.includes('total') || n.includes('estoque') || n.includes('separado') || n.includes('fechado')
    })
    if (hasDescCol && hasQtdeCol) blockHeaders.push(i)
  }

  for (const bi of blockHeaders) {
    const headerRow = rows[bi] as any[]
    // Encontrar índice da coluna DESCRIÇÃO (primeira)
    let idxDesc = -1
    for (let j = 0; j < headerRow.length; j++) {
      if (normalizeHeader(String(headerRow[j] || '')).includes('descricao')) {
        idxDesc = j
        break
      }
    }
    if (idxDesc < 0) continue

    // Mapear colunas numéricas à direita da DESCRIÇÃO
    const colQty: { idx: number; nome: string }[] = []
    for (let j = idxDesc + 1; j < headerRow.length; j++) {
      const colName = normalizeHeader(String(headerRow[j] || ''))
      if (!colName) continue
      if (colName.includes('qtde') || colName.includes('total') || colName.includes('estoque') ||
          colName.includes('separado') || colName.includes('fechado') || colName.includes('saldo') ||
          colName.includes('usa') || colName.includes('saco') || colName.includes('embal')) {
        colQty.push({ idx: j, nome: colName })
      }
    }
    if (colQty.length === 0) continue

    // Processar linhas de dados
    for (let i = bi + 1; i < rows.length; i++) {
      const row = rows[i] as any[]
      if (!row) continue

      const desc = toStr(row[idxDesc])
      if (!desc) continue

      // Verificar se é nova linha de cabeçalho (próximo bloco) → parar
      const rowHasDescCol = row.some(c => normalizeHeader(String(c || '')).includes('descricao'))
      if (rowHasDescCol) break

      const vals: Record<string, number> = {}
      for (const cq of colQty) {
        const n = toNum(row[cq.idx])
        if (n != null) vals[cq.nome] = n
      }

      const key = desc.toLowerCase().trim()
      if (seen.has(key)) {
        // Mesclar com produto existente (somar valores)
        const ex = seen.get(key)!
        for (const [k, v] of Object.entries(vals)) {
          ex._raw = ex._raw || {}
          ex._raw[k] = (ex._raw[k] || 0) + v
        }
      } else {
        const prod: Record<string, any> = {
          codigo: null,
          nome: desc,
          descricao: desc,
          unidade: 'KG',
          categoria,
          _raw: { ...vals },
        }
        seen.set(key, prod)
        out.push(prod)
      }
    }
  }

  // Estoque final: preferir a coluna de TOTAL do bloco mais recente
  // (o bloco de "QTDE DE EMBAL." traz a quantidade real de material).
  // Se nenhum bloco tiver total, usar a soma dos valores.
  for (const prod of out) {
    const raw = prod._raw || {}
    const totalKeys = Object.keys(raw).filter(k => k === 'total' || k.includes('total de material') || k === 'fechado' || k === 'estoque')
    if (totalKeys.length > 0) {
      // usa o último (bloco mais recente) - they override
      prod.saldo_inicial = raw[totalKeys[totalKeys.length - 1]]
    } else {
      const soma = Object.values(raw).reduce(
        (a: number, b) => a + (Number(b) || 0),
        0
      )
      prod.saldo_inicial = soma > 0 ? soma : null
    }
    delete prod._raw
  }

  return out
}

/**
 * Para abas com layout de colunas mescladas (tipo ESTOQUE PURIFICADOR),
 * detecta a estrutura de "blocos" onde cada bloco tem seu próprio cabeçalho
 */
function parseMergedColumns(rows: any[][], headerRowIndex: number, categoria: string): Record<string, any>[] {
  if (rows.length <= headerRowIndex + 1) return []

  const headerRow = rows[headerRowIndex] as any[]

  // Detectar blocos: sequências de colunas com mesmo "padrão" de cabeçalho
  // Cada bloco tem 3-4 colunas: codigo, descricao, qtd, (opcional localizacao)
  const blocks: { startCol: number; codigoIdx: number; descIdx: number; qtdIdx: number; localIdx?: number }[] = []

  // Procurar padrões "Loacação/Part Number/Descrição/Qtde" repetidos
  for (let i = 0; i < headerRow.length - 2; i++) {
    const h1 = normalizeHeader(String(headerRow[i] || ''))
    const h2 = normalizeHeader(String(headerRow[i + 1] || ''))
    const h3 = normalizeHeader(String(headerRow[i + 2] || ''))

    if (h2.includes('part number') || h2.includes('partnumber')) {
      blocks.push({
        startCol: i,
        codigoIdx: i + 1, // Part Number
        descIdx: i + 2,   // Descrição
        qtdIdx: i + 3,    // Qtde
      })
    }
  }

  if (blocks.length === 0) {
    // Tentar padrão simples: "Loacação | Part Number | Descrição | Qtde"
    for (let i = 0; i < headerRow.length - 3; i++) {
      const h1 = normalizeHeader(String(headerRow[i] || ''))
      const h2 = normalizeHeader(String(headerRow[i + 1] || ''))
      const h3 = normalizeHeader(String(headerRow[i + 2] || ''))
      const h4 = normalizeHeader(String(headerRow[i + 3] || ''))

      if ((h1.includes('loacação') || h1.includes('loacacao') || h1.includes('localizacao')) &&
          (h2.includes('part number') || h2.includes('partnumber'))) {
        blocks.push({
          startCol: i,
          codigoIdx: i + 1,
          descIdx: i + 2,
          qtdIdx: i + 3,
        })
      }
    }
  }

  if (blocks.length === 0) return []

  // Para cada linha de dados, extrair UM produto por bloco
  const produtos: Record<string, any>[] = []
  const seen = new Set<string>()
  const codigoCounter = new Map<string, number>()

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] as any[]
    if (!row) continue

    for (const block of blocks) {
      const codigo = String(row[block.codigoIdx] || '').trim()
      const desc = String(row[block.descIdx] || '').trim()
      const qtd = row[block.qtdIdx]

      if (!desc || desc === 'null') continue

      // Chave única pra deduplicar (desc + qtd)
      const key = `${desc.toLowerCase()}|${qtd}`
      if (seen.has(key)) continue
      seen.add(key)

      // Gerar código único se vazio
      let finalCodigo = codigo
      if (!finalCodigo) {
        const codKey = desc.toLowerCase()
        const count = (codigoCounter.get(codKey) || 0) + 1
        codigoCounter.set(codKey, count)
        finalCodigo = `${categoria.toUpperCase()}-${count.toString().padStart(3, '0')}`
      }

      produtos.push({
        codigo: finalCodigo,
        nome: desc,
        descricao: desc,
        saldo_inicial: typeof qtd === 'number' ? qtd : parseFloat(String(qtd || 0).replace(',', '.')) || 0,
        categoria,
        unidade: 'UN',
      })
    }
  }

  return produtos
}

export function parseExcel(buffer: Buffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const allSheets: ParsedExcel['allSheets'] = []

  // Parsear todas as abas
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[]

    if (rows.length === 0) continue

    // Detectar a linha do cabeçalho
    const { headerRowIndex, headers } = detectHeaderRow(rows)
    const { categoria } = parseSheetName(sheetName)

    // Filtrar headers vazios
    const validHeaders = headers
      .map((h, i) => ({ original: h, normalized: normalizeHeader(h), index: i }))
      .filter(h => h.original && h.original.trim() !== '')

    // Tentar primeiro o parser tradicional
    let dataRows = rows.slice(headerRowIndex + 1).map(row => {
      const obj: Record<string, any> = {}
      validHeaders.forEach(header => {
        const value = row[header.index]
        if (value != null && value !== '') {
          obj[header.original] = value
          obj[header.normalized] = value
        }
      })
      return obj
    }).filter(row => Object.keys(row).length > 0)

    // Parsers dedicados por aba (tratam layouts com linhas de continuação / múltiplos blocos)
    let specialized: Record<string, any>[] | null = null
    if (categoria === 'tanks') {
      specialized = parseTank(rows, headerRowIndex, categoria)
    } else if (categoria === 'valvulas') {
      specialized = parseValvulas(rows, headerRowIndex, categoria)
    } else if (categoria === 'elementos') {
      specialized = parseElementos(rows, headerRowIndex, categoria)
    }

    if (specialized && specialized.length > 0) {
      dataRows = specialized
    } else if (dataRows.length === 0) {
      // Se não gerou dados válidos, tentar parser de colunas mescladas
      const merged = parseMergedColumns(rows, headerRowIndex, categoria)
      if (merged.length > 0) {
        dataRows = merged
      }
    }

    allSheets.push({
      name: sheetName,
      headers: validHeaders.map(h => h.original),
      rows: dataRows
    })
  }

  // Retornar primeira aba por padrão
  const firstSheet = allSheets[0] || { name: '', headers: [], rows: [] }

  return {
    headers: firstSheet.headers,
    rows: firstSheet.rows,
    sheetName: firstSheet.name,
    allSheets
  }
}

export function mapRowToProduto(row: Record<string, any>, categoria: string = 'outros'): ImportRow {
  const produto: ImportRow = {
    categoria,
    unidade: 'UN',
  }

  // Tentar encontrar cada campo no row
  for (const [excelCol, prop] of Object.entries(COLUMN_MAP)) {
    // Buscar a coluna no row (case insensitive e normalizado)
    const key = Object.keys(row).find(k => {
      const rowKeyNormalized = normalizeHeader(k)
      return rowKeyNormalized === excelCol || rowKeyNormalized === excelCol.toLowerCase()
    })

    if (!key) continue
    const raw = row[key]
    if (raw == null || raw === '') continue

    let value: any
    if (prop === 'preco_custo' || prop === 'preco_venda' || prop === 'estoque_minimo' || prop === 'saldo_inicial') {
      value = toNum(raw)
    } else if (prop === 'codigo') {
      value = toStr(raw)
    } else {
      value = toStr(raw)
    }

    if (value == null || value === '') continue

    // Se o campo é nome mas encontrar descrição já preenchida, pula
    if (prop === 'nome' && produto.descricao) continue
    // Se o campo é codigo mas já tem, não sobrescrever
    if (prop === 'codigo' && produto.codigo) continue

    ;(produto as any)[prop] = value
  }

  // Garantir defaults numéricos
  if (produto.estoque_minimo == null) produto.estoque_minimo = 0
  if (produto.saldo_inicial == null) produto.saldo_inicial = 0
  if (!produto.unidade) produto.unidade = 'UN'

  // Se não tem código, gerar a partir do nome
  if (!produto.codigo && produto.nome) {
    produto.codigo = produto.nome
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '-')
      .substring(0, 20)
  }

  // Se não tem nome mas tem descrição, usar descrição como nome
  if (!produto.nome && produto.descricao) {
    produto.nome = produto.descricao
  }

  return produto
}

export function validateRow(row: ImportRow, linha: number): ImportValidationError[] {
  const erros: ImportValidationError[] = []

  // Nome obrigatório (agora que pode gerar código do nome)
  if (!row.nome || String(row.nome).trim() === '') {
    erros.push({
      linha,
      coluna: 'Nome/Descrição',
      valor: row.nome,
      mensagem: 'Nome ou Descrição é obrigatório'
    })
  }

  // Preço não negativo
  if (row.preco_custo != null && row.preco_custo < 0) {
    erros.push({
      linha,
      coluna: 'Preço Custo',
      valor: row.preco_custo,
      mensagem: 'Preço não pode ser negativo'
    })
  }

  if (row.preco_venda != null && row.preco_venda < 0) {
    erros.push({
      linha,
      coluna: 'Preço Venda',
      valor: row.preco_venda,
      mensagem: 'Preço não pode ser negativo'
    })
  }

  if (row.saldo_inicial != null && row.saldo_inicial < 0) {
    erros.push({
      linha,
      coluna: 'Saldo Inicial',
      valor: row.saldo_inicial,
      mensagem: 'Saldo inicial não pode ser negativo'
    })
  }

  // NCM formato
  if (row.ncm && !/^\d{4}\.\d{2}\.\d{2}$/.test(row.ncm)) {
    erros.push({
      linha,
      coluna: 'NCM',
      valor: row.ncm,
      mensagem: 'NCM deve estar no formato 0000.00.00'
    })
  }

  return erros
}

/**
 * Verifica se já existe produto ATIVO com este código na empresa.
 * Usado no momento da inserção para resolver colisão de código: cada linha
 * da planilha é um item físico independente, mesmo quando o código repete
 * (a planilha do Marcos usa numeração sequencial por bloco/aba).
 */
async function codigoExiste(codigo: string, empresaId: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('codigo', codigo)
    .eq('ativo', true)
    .limit(1)

  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function processImport(
  buffer: Buffer,
  empresaId: number = 1,
  dryRun: boolean = true,
  sheetName?: string
): Promise<ImportResult> {
  const parsed = parseExcel(buffer)

  // Selecionar aba específica ou usar a primeira
  let targetSheet = parsed.allSheets[0]
  if (sheetName) {
    targetSheet = parsed.allSheets.find(s =>
      s.name.toLowerCase() === sheetName.toLowerCase()
    ) || parsed.allSheets[0]
  }

  const { categoria } = parseSheetName(targetSheet.name)
  const rows = targetSheet.rows

  if (rows.length === 0) {
    return {
      total: 0,
      importados: 0,
      duplicados: 0,
      erros: [{ linha: 0, coluna: '', mensagem: 'Nenhum dado encontrado na planilha' }],
      produtos: [],
      sheet: targetSheet.name
    }
  }

  const duplicadosExcel: ImportValidationError[] = []

  const produtos: ImportRow[] = []
  const erros: ImportValidationError[] = []
  let duplicados = 0

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i]
    const row = mapRowToProduto(rawRow, categoria)
    const linha = i + 2 // +2 porque header é linha 1 e Excel é 1-indexed

    // Se não tem nome válido, pular
    if (!row.nome || String(row.nome).trim() === '') {
      continue
    }

    // Cada linha da planilha é um produto independente.
    // Mesmo que código+nome sejam iguais (acontece por causa da estrutura de blocos
    // da planilha), cada linha representa um item físico diferente.
    // Não dedupliamos aqui — deixamos o banco criar e o usuário revisa depois.

    // Validar
    const validacaoErros = validateRow(row, linha)
    if (validacaoErros.length > 0) {
      erros.push(...validacaoErros)
      continue
    }

    produtos.push({ ...row, _linha: linha })
  }

  // Importar se não for dry-run
  let importados = 0
  if (!dryRun) {
    for (const produto of produtos) {
      const linha = produto._linha ?? 0

      // Resolver colisão de código no momento da inserção, não antes.
      // Se consultássemos o banco para todas as linhas antes de inserir
      // qualquer uma, duas linhas com o mesmo código na mesma planilha
      // passariam as duas pela verificação e a segunda falharia com 23505.
      const codigoOriginal = String(produto.codigo || '').trim()
      let codigoFinal = codigoOriginal || produto.nome!.substring(0, 20)

      if (codigoOriginal) {
        let suffix = 2
        while (await codigoExiste(codigoFinal, empresaId)) {
          codigoFinal = `${codigoOriginal}-${suffix}`
          suffix++
        }
      }

      try {
        const novo = await createProduto({
          empresa_id: empresaId,
          codigo: codigoFinal,
          nome: produto.nome!,
          descricao: produto.descricao,
          unidade: produto.unidade,
          categoria: produto.categoria,
          ncm: produto.ncm,
          gtin: produto.gtin,
          preco_custo: produto.preco_custo,
          preco_venda: produto.preco_venda,
          estoque_minimo: produto.estoque_minimo,
          localizacao: produto.localizacao,
          fonte_id: 2, // excel
        })

        // Saldo físico da planilha entra como movimentação de inventário.
        // A trigger `trg_atualizar_saldo` é a única a escrever
        // produtos.saldo_atual — escrever a coluna direto causaria drift
        // entre o saldo e o histórico.
        const saldoInicial = Number(produto.saldo_inicial || 0)
        if (saldoInicial > 0 && novo && typeof novo.id === 'number') {
          await criarMovimentacao({
            empresa_id: empresaId,
            produto_id: novo.id,
            tipo: 'inventario',
            quantidade: saldoInicial,
            documento: 'Importação Excel',
            observacao: `Saldo inicial importado da planilha (linha ${linha})`,
          })
        }

        importados++
      } catch (err: any) {
        // 23505 = código já existe (resolvido pelo loop codigoExiste,
        // só chega aqui se um insert paralelo ou a constraint derrubar a corrida).
        // Pulamos silenciosamente em vez de poluir o relatório de erros.
        const msg = String(err?.message || '')
        const isDup = msg.includes('Código do produto já existe') ||
                      (err?.cause && String(err.cause.message || '').includes('duplicate key'))
        if (isDup) {
          // Ignorar
        } else {
          erros.push({
            linha,
            coluna: 'Importação',
            mensagem: `Erro ao importar ${produto.nome}: ${err.message}`
          })
        }
      }
    }
  }

  return {
    total: rows.length,
    importados: dryRun ? produtos.length : importados,
    duplicados: duplicados + duplicadosExcel.length,
    erros: [...duplicadosExcel, ...erros],
    produtos: dryRun ? produtos.slice(0, 10) : [], // Retornar só os primeiros 10 no dry-run
    sheet: targetSheet.name
  }
}

export async function processAllSheets(
  buffer: Buffer,
  empresaId: number = 1,
  dryRun: boolean = true
): Promise<{ results: ImportResult[]; summary: { total: number; importados: number; erros: number } }> {
  const parsed = parseExcel(buffer)
  const results: ImportResult[] = []
  let totalImportados = 0
  let totalErros = 0

  for (const sheet of parsed.allSheets) {
    // Ignorar abas vazias ou de programação
    if (sheet.rows.length === 0) continue
    if (sheet.name.toLowerCase().includes('programação') || sheet.name.toLowerCase().includes('programacao')) continue

    const result = await processImport(buffer, empresaId, dryRun, sheet.name)
    results.push(result)
    totalImportados += result.importados
    totalErros += result.erros.length
  }

  return {
    results,
    summary: {
      total: results.reduce((acc, r) => acc + r.total, 0),
      importados: totalImportados,
      erros: totalErros
    }
  }
}

export function generateTemplateBuffer(): Buffer {
  const data = [
    {
      'Código': 'FLT-001',
      'Nome': 'Filtro de Entrada 10 Pol',
      'Descrição': 'Filtro para entrada de água',
      'Unidade': 'UN',
      'Categoria': 'Filtros',
      'NCM': '8421.21.00',
      'GTIN/EAN': '7891234567890',
      'Preço Custo': '45.90',
      'Preço Venda': '89.90',
      'Estoque Mínimo': '10',
      'Localização': 'Prateleira A-1'
    },
    {
      'Código': 'REF-002',
      'Nome': 'Refil Purificador PP-10',
      'Descrição': 'Refil de polipropileno',
      'Unidade': 'UN',
      'Categoria': 'Refis',
      'NCM': '8421.21.00',
      'GTIN/EAN': '7891234567891',
      'Preço Custo': '29.90',
      'Preço Venda': '59.90',
      'Estoque Mínimo': '20',
      'Localização': 'Prateleira B-2'
    }
  ]

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as unknown as Buffer
}

export function generateTDFTemplateBuffer(): Buffer {
  // Template específico para a planilha da TDF
  const data = [
    {
      'Código': 'AREIA-001',
      'Nome': 'Areia Grossa - Quartzo I',
      'Descrição': 'Areia grossa para filtro',
      'Unidade': 'KG',
      'Categoria': 'elementos',
      'Estoque Mínimo': '100',
      'Localização': 'ALMOXARIFADO'
    },
    {
      'Código': 'PUR-001',
      'Nome': 'Purificador Vittax 1500',
      'Descrição': 'Purificador de água branco',
      'Unidade': 'UN',
      'Categoria': 'purificadores',
      'Estoque Mínimo': '5',
      'Localização': 'A01A1'
    },
    {
      'Código': 'REF-001',
      'Nome': 'Refil Sanalux',
      'Descrição': 'Refil purificador Sanalux',
      'Unidade': 'UN',
      'Categoria': 'refis',
      'Estoque Mínimo': '10',
      'Localização': 'B-01'
    }
  ]

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as unknown as Buffer
}
