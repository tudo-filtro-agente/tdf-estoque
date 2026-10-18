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
}

export interface ParsedExcel {
  headers: string[]
  rows: Record<string, any>[]
}

// Mapeamento de colunas do Excel
const COLUMN_MAP: Record<string, keyof ImportRow> = {
  'código': 'codigo',
  'codigo': 'codigo',
  'sku': 'codigo',
  'nome': 'nome',
  'descrição': 'descricao',
  'descricao': 'descricao',
  'unidade': 'unidade',
  'categoria': 'categoria',
  'ncm': 'ncm',
  'gtin': 'gtin',
  'ean': 'gtin',
  'preço custo': 'preco_custo',
  'preco custo': 'preco_custo',
  'custo': 'preco_custo',
  'preço venda': 'preco_venda',
  'preco venda': 'preco_venda',
  'venda': 'preco_venda',
  'preço': 'preco_venda',
  'estoque mínimo': 'estoque_minimo',
  'estoque_minimo': 'estoque_minimo',
  'minimo': 'estoque_minimo',
  'localização': 'localizacao',
  'localizacao': 'localizacao',
  'local': 'localizacao',
  'prateleira': 'localizacao',
}

export function parseExcel(buffer: Buffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[]

  if (rows.length === 0) {
    return { headers: [], rows: [] }
  }

  // Normalizar headers
  const headers = (rows[0] as string[]).map(h => String(h || '').toLowerCase().trim())

  // Converter linhas em objetos
  const dataRows = rows.slice(1).map(row => {
    const obj: Record<string, any> = {}
    headers.forEach((header, index) => {
      const originalHeader = (rows[0] as string[])[index]
      obj[originalHeader || header] = row[index]
    })
    return obj
  }).filter(row => Object.values(row).some(v => v != null && v !== ''))

  return { headers, rows: dataRows }
}

export function mapRowToProduto(row: Record<string, any>): ImportRow {
  const produto: ImportRow = {
    unidade: 'UN',
    estoque_minimo: 0,
  }

  for (const [excelCol, prop] of Object.entries(COLUMN_MAP)) {
    // Buscar a coluna no row (case insensitive)
    const key = Object.keys(row).find(k =>
      k.toLowerCase().trim() === excelCol.toLowerCase()
    )

    if (key && row[key] != null && row[key] !== '') {
      let value: any = row[key]

      // Conversões de tipo
      if (prop.includes('preco') || prop.includes('custo') || prop.includes('venda')) {
        // Converter string brasileira para número
        if (typeof value === 'string') {
          value = parseFloat(value.replace(/[R$\s]/g, '').replace(',', '.'))
        }
      }

      if (prop === 'estoque_minimo') {
        value = parseFloat(String(value).replace(',', '.')) || 0
      }

      (produto as any)[prop] = value
    }
  }

  return produto
}

export function validateRow(row: ImportRow, linha: number): ImportValidationError[] {
  const erros: ImportValidationError[] = []

  // Código obrigatório
  if (!row.codigo || row.codigo.trim() === '') {
    erros.push({
      linha,
      coluna: 'Código',
      valor: row.codigo,
      mensagem: 'Código é obrigatório'
    })
  }

  // Nome obrigatório
  if (!row.nome || row.nome.trim() === '') {
    erros.push({
      linha,
      coluna: 'Nome',
      valor: row.nome,
      mensagem: 'Nome é obrigatório'
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
  dryRun: boolean = true
): Promise<ImportResult> {
  const parsed = parseExcel(buffer)

  if (parsed.rows.length === 0) {
    return {
      total: 0,
      importados: 0,
      duplicados: 0,
      erros: [{ linha: 0, coluna: '', mensagem: 'Nenhum dado encontrado na planilha' }],
      produtos: []
    }
  }

  // Verificar códigos duplicados no Excel
  const codigosExcel = new Set<string>()
  const duplicadosExcel: ImportValidationError[] = []

  const produtos: ImportRow[] = []
  const erros: ImportValidationError[] = []
  let duplicados = 0

  for (let i = 0; i < parsed.rows.length; i++) {
    const rawRow = parsed.rows[i]
    const row = mapRowToProduto(rawRow)
    const linha = i + 2 // +2 porque header é linha 1 e Excel é 1-indexed

    // Verificar duplicado no Excel
    if (row.codigo && codigosExcel.has(row.codigo.toLowerCase())) {
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
      codigosExcel.add(row.codigo.toLowerCase())
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
          codigo: produto.codigo!,
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
          mensagem: `Erro ao importar ${produto.codigo}: ${err.message}`
        })
      }
    }
  }

  return {
    total: parsed.rows.length,
    importados: dryRun ? produtos.length : importados,
    duplicados: duplicados + duplicadosExcel.length,
    erros: [...duplicadosExcel, ...erros],
    produtos: dryRun ? produtos : []
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
