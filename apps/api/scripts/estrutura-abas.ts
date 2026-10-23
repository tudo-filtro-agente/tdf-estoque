/**
 * Diagnóstico: imprime a estrutura bruta (cabeçalhos + primeiras linhas)
 * de cada aba da planilha de inventário.
 * Uso: npx tsx scripts/estrutura-abas.ts
 */
import * as fs from 'fs'
import * as XLSX from 'xlsx'

const ARQ = 'C:/Users/User/OneDrive/Área de Trabalho/Dashboard - Comercial/INVENTARIO OUTUBRO-2026.xlsx'

const wb = XLSX.read(fs.readFileSync(ARQ), { type: 'buffer' })

for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) as any[][]
  console.log('='.repeat(78))
  console.log(`ABA "${name}"  (${rows.length} linhas, ${rows[0]?.length ?? 0} colunas)`)
  const limite = name.toUpperCase().includes('ELEMENTOS') ? 26 : 12
  for (let i = 0; i < Math.min(rows.length, limite); i++) {
    const vals = (rows[i] ?? []).map(v => (v == null ? '' : String(v))).slice(0, 16)
    console.log(`  L${String(i + 1).padStart(2)} | ${vals.join(' | ')}`)
  }
}
