import * as fs from 'fs'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '../src/db'
const ARQ = 'C:/Users/User/OneDrive/Área de Trabalho/Dashboard - Comercial/INVENTARIO OUTUBRO-2026.xlsx'
const wb = XLSX.read(fs.readFileSync(ARQ), { type: 'buffer' })
const rowsOf = (n: string) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null }) as any[]
const dump = (n: string, max = 30) => {
  const r = rowsOf(n)
  console.log('### ' + n)
  r.slice(0, max).forEach((x, i) => console.log('  ' + String(i+1).padStart(2) + ' | ' + x.map(c => c == null ? '' : String(c)).join(' | ').slice(0,150)))
}
dump('ELEMENTOS', 26)
dump('REFIL PURIFICADOR', 8)
console.log('### VISÃO DA PROGRAMAÇÃO')
rowsOf('VISÃO DA PROGRAMAÇÃO').slice(0, 20).forEach((x, i) => console.log('  ' + (i+1) + ' | ' + x.map(c => c == null ? '' : String(c)).join(' | ').slice(0,150)))
console.log('\n### TABELAS')
for (const tb of ['movimentacoes','categorias','localizacoes','relatorio_saved']) {
  const { data, error } = await supabaseAdmin.from(tb as any).select('*').limit(1)
  console.log('  ' + tb + ': ' + (error ? 'AUSENTE: ' + error.message.slice(0,80) : 'OK linhas=' + data.length))
}
const { data: m } = await supabaseAdmin.from('movimentacoes' as any).select('*').limit(3)
console.log('  amostra movimentacoes: ' + JSON.stringify(m))
