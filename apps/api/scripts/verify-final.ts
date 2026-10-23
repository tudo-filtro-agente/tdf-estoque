import * as fs from 'fs'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '../src/db'
const ARQ = 'C:/Users/User/OneDrive/Área de Trabalho/Dashboard - Comercial/INVENTARIO OUTUBRO-2026.xlsx'
const wb = XLSX.read(fs.readFileSync(ARQ), { type: 'buffer' })
const rowsOf = (n: string) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null }) as any[]

// ELEMENTOS: bloco 1 (L3-L14) coluna 'Estoque' (indice 9) = saldo real
const el = rowsOf('ELEMENTOS')
console.log('=== ELEMENTOS: planilha Estoque(col9) vs TOTAL DE MATERIAL(col11) ===')
for (let i = 3; i <= 13; i++) {
  const r = el[i]
  console.log('  ' + String(r[0]).padEnd(18) + ' estoque=' + String(r[9]) + '  totalMaterial=' + String(r[11]))
}

// REFIL: achar PP 20
console.log('=== REFIL: linhas com "PP 20" ===')
rowsOf('REFIL PURIFICADOR').forEach((r, i) => {
  if (r && r.some(c => String(c || '').includes('PP 20'))) console.log('  linha ' + (i+1) + ': ' + r.map(c => c==null?'':String(c)).join(' | '))
})

// plataforma
const { data: prods } = await supabaseAdmin.from('produtos').select('id,codigo,nome,categoria,estoque_minimo,ativo').eq('ativo', true)
const byCat: Record<string, any[]> = {}
;(prods||[]).forEach(p => { (byCat[p.categoria||'null'] ||= []).push(p) })
console.log('=== PLATAFORMA por categoria ===')
for (const k of Object.keys(byCat).sort()) console.log('  ' + k + ': ' + byCat[k].length)
console.log('=== PLATAFORMA valvulas (nome | estoque_minimo) ===')
byCat['valvulas']?.forEach(p => console.log('  ' + p.codigo + ' | ' + p.nome + ' | ' + p.estoque_minimo))
console.log('=== PLATAFORMA conexoes ===')
byCat['conexoes']?.forEach(p => console.log('  ' + p.codigo + ' | ' + p.nome + ' | ' + p.estoque_minimo))
console.log('=== PLATAFORMA elementos ===')
byCat['elementos']?.forEach(p => console.log('  ' + p.codigo + ' | ' + p.nome + ' | ' + p.estoque_minimo))
console.log('=== PLATAFORMA nao classificados ===')
byCat['null']?.forEach(p => console.log('  ' + p.codigo + ' | ' + p.nome + ' | ' + p.estoque_minimo))
