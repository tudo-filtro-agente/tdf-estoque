import * as fs from 'fs'
import * as XLSX from 'xlsx'
const ARQ = 'C:/Users/User/OneDrive/Área de Trabalho/Dashboard - Comercial/INVENTARIO OUTUBRO-2026.xlsx'
const wb = XLSX.read(fs.readFileSync(ARQ), { type: 'buffer' })
const rowsOf = (n: string) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null }) as any[]
const num = (v: any) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n }
const norm = (s: any) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// ELEMENTOS: bloco esquerdo col TOTAL (idx 4) e bloco direito col Estoque (idx 8)
const el = rowsOf('ELEMENTOS')
console.log('=== ELEMENTOS (TOTAL esquerda idx4 | Estoque direita idx8) ===')
const elTruth = new Map<string, number>()
for (let i = 3; i <= 13; i++) {
  const d = norm(el[i]?.[0]); const tot = num(el[i]?.[4]); const est = num(el[i]?.[8])
  if (d) { elTruth.set(d, tot ?? est ?? 0); console.log('  ' + d.padEnd(32) + ' TOTAL=' + tot + '  Estoque=' + est + (tot === est ? '' : '   <<< DIVERGE')) }
}
// VISÃO DA PROGRAMAÇÃO -> codigos dos elementos
const vp = rowsOf('VISÃO DA PROGRAMAÇÃO')
console.log('\n=== CODIGOS REAIS (VISÃO DA PROGRAMAÇÃO) ===')
for (let i = 3; i < vp.length; i++) { const c = vp[i]?.[0], d = vp[i]?.[1]; if (c) console.log('  ' + String(c).padEnd(10) + ' | ' + d) }

// TANK: total idx 8, nome = idx1(+idx2 se idx1 comecar com 'Color'/'Blue')
const tk = rowsOf('TANK')
console.log('\n=== TANK (col TOTAL idx8) ===')
for (let i = 4; i < tk.length; i++) {
  const nome = tk[i]?.[1]; const esp = tk[i]?.[2]; const tot = num(tk[i]?.[8])
  if (nome && tot != null) console.log('  ' + String(nome).trim().padEnd(46) + ' | ' + String(esp ?? '').padEnd(9) + ' | ' + tot)
}
// VALVULAS: col Qtde idx4 ; nome = idx1 ;续行 concatenadas
const vl = rowsOf('VALVULAS')
console.log('\n=== VALVULAS ===')
for (let i = 2; i < vl.length; i++) {
  const nome = vl[i]?.[1]; const espec = vl[i]?.[2]; const unit = vl[i]?.[3]; const q = num(vl[i]?.[4])
  if (nome && q != null) console.log('  ' + String(nome).trim().padEnd(30) + ' | ' + String(espec ?? '').padEnd(7) + ' | ' + String(unit ?? '').padEnd(4) + ' | ' + q)
}
