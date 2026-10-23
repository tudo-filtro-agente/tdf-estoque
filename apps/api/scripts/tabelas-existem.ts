import { supabaseAdmin } from '../src/db'
async function main() {
  for (const t of ['movimentacoes', 'categorias', 'localizacoes']) {
    const { error } = await supabaseAdmin.from(t as any).select('*').limit(1)
    console.log(t + ' -> ' + (error ? 'NAO EXISTE (' + error.message + ')' : 'existe'))
  }
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1) })
