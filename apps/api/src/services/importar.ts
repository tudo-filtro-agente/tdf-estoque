import * as XLSX from 'xlsx'
import { supabaseAdmin } from '../db'
import { createProduto } from './produtos'

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
  estoque_minimo?: number
  localizacao?: string
  observacao?: string
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

  // Estoque
  'estoque mínimo': 'estoque_minimo',
  'estoque_minimo': 'estoque_minimo',
  'minimo': 'estoque_minimo',
  'estoque': 'estoque_minimo',
  'qtde': 'estoque_minimo',
  'quantidade': 'estoque_minimo',
  'total': 'estoque_minimo',
  'qty': 'estoque_minimo',

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

function parseSheetName(sheetName: string): { categoria: string; originalName: string } {
  const normalized = sheetName.trim()
  const categoria = SHEET_CATEGORIA_MAP[normalized] || SHEET_CATEGORIA_MAP[normalized.toUpperCase()] || 'outros'
  return { categoria, originalName: normalized }
}

export function parseExcel(buffer: Buffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const allSheets: ParsedExcel['allSheets'] = []

  // Parsear todas as abas
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[]

    if (rows.length === 0) continue

    // Encontrar a linha do header (primeira linha com dados)
    let headerRowIndex = 0
    const headers = (rows[0] as string[]).map((h, i) => ({
      original: h || '',
      normalized: normalizeHeader(h || ''),
      index: i
    })).filter(h => h.original != null && h.original !== '')

    // Se não encontrar headers, usar padrão baseado no nome da aba
    const { categoria } = parseSheetName(sheetName)

    // Converter linhas em objetos
    const dataRows = rows.slice(1).map(row => {
      const obj: Record<string, any> = {}
      headers.forEach(header => {
        const value = row[header.index]
        obj[header.original] = value
        obj[header.normalized] = value // também guardar normalizado
      })
      return obj
    }).filter(row => Object.values(row).some(v => v != null && v !== ''))

    allSheets.push({
      name: sheetName,
      headers: headers.map(h => h.original),
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
    estoque_minimo: 0,
  }

  // Tentar encontrar cada campo no row
  for (const [excelCol, prop] of Object.entries(COLUMN_MAP)) {
    // Buscar a coluna no row (case insensitive e normalizado)
    const key = Object.keys(row).find(k => {
      const rowKeyNormalized = normalizeHeader(k)
      return rowKeyNormalized === excelCol || rowKeyNormalized === excelCol.toLowerCase()
    })

    if (key && row[key] != null && row[key] !== '') {
      let value: any = row[key]

      // Conversões de tipo
      if (prop.includes('preco') || prop.includes('custo') || prop.includes('venda')) {
        if (typeof value === 'string') {
          value = parseFloat(value.replace(/[R$\s]/g, '').replace(',', '.'))
        }
      }

      if (prop === 'estoque_minimo' || prop === 'codigo') {
        if (typeof value === 'string') {
          value = parseFloat(value.replace(',', '.')) || value
        }
      }

      // Se o campo é nome mas encontrar descrição, usar descrição
      if (prop === 'nome' && produto.descricao) continue

      // Se o campo é codigo mas estiver vazio, não sobrescrever
      if (prop === 'codigo' && !produto.codigo) {
        (produto as any)[prop] = String(value).trim()
      } else if (prop === 'codigo' && !value) {
        // deixa o que já tem
      } else {
        (produto as any)[prop] = value
      }
    }
  }

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

  // Verificar códigos duplicados no Excel
  const codigosExcel = new Set<string>()
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

    // Verificar duplicado no Excel
    if (row.codigo && codigosExcel.has(String(row.codigo).toLowerCase())) {
      duplicadosExcel.push({
        linha,
        coluna: 'Código',
        valor: row.codigo,
        mensagem: 'Código duplicado na planilha'
      })
      duplicados++
      continue
    }

    if (row.codigo) {
      codigosExcel.add(String(row.codigo).toLowerCase())
    }

    // Validar
    const validacaoErros = validateRow(row, linha)
    if (validacaoErros.length > 0) {
      erros.push(...validacaoErros)
      continue
    }

    // Se não for dry-run, verificar duplicado no banco
    if (!dryRun) {
      const { data: existente } = await supabaseAdmin
        .from('produtos')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('codigo', row.codigo)
        .eq('ativo', true)
        .single()

      if (existente) {
        erros.push({
          linha,
          coluna: 'Código',
          valor: row.codigo,
          mensagem: 'Código já existe no sistema'
        })
        duplicados++
        continue
      }
    }

    produtos.push(row)
  }

  // Importar se não for dry-run
  let importados = 0
  if (!dryRun) {
    for (const produto of produtos) {
      try {
        await createProduto({
          empresa_id: empresaId,
          codigo: produto.codigo || produto.nome!.substring(0, 20),
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
        importados++
      } catch (err: any) {
        erros.push({
          linha: 0,
          coluna: 'Importação',
          mensagem: `Erro ao importar ${produto.codigo || produto.nome}: ${err.message}`
        })
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
