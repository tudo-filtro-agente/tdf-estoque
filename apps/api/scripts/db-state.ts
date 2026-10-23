import { supabaseAdmin } from '../src/db'

const tabelas = ['movimentacoes', 'categorias', 'localizacoes', 'fontes', 'unidades']
for (const t of tabelas) {
  const r = await supabaseAdmin.from(t as any).select('*', { count: 'exact', head: true })
  console.log('tabela ' + t + ': ' + (r.error ? 'NAO EXISTE -> ' + r.error.message : (r.count ?? 0) + ' linhas'))
}

const { data: cols } = await supabaseAdmin.from('produtos').select('*').limit(1)
console.log('\ncolunas de produtos: ' + Object.keys(cols?.[0] || {}).join(', '))

const { data: el } = await supabaseAdmin
  .from('produtos')
  .select('id,nome,categoria,estoque_minimo,saldo_atual,estoque_maximo,ativo')
  .eq('categoria', 'elementos')
  .order('nome')
console.log('\nelementos na plataforma:')
el?.forEach(p => console.log('  ' + String(p.nome).padEnd(32) + ' estMin=' + p.estoque_minimo + ' saldo=' + p.saldo_atual + ' max=' + p.estoque_maximo))

const { data: rf } = await supabaseAdmin
  .from('produtos')
  .select('id,nome,codigo,estoque_minimo,saldo_atual')
  .eq('categoria', 'refis')
  .limit(6)
console.log('\namostra refis:')
rf?.forEach(p => console.log('  ' + String(p.nome).padEnd(40) + ' estMin=' + p.estoque_minimo + ' saldo=' + p.saldo_atual))

const { count: total } = await supabaseAdmin.from('produtos').select('*', { count: 'exact', head: true }).eq('ativo', true)
console.log('\ntotal produtos ativos: ' + total)
const { count: inativos } = await supabaseAdmin.from('produtos').select('*', { count: 'exact', head: true }).eq('ativo', false)
console.log('total produtos inativos: ' + inativos)
