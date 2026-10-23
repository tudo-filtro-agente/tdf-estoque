import { supabaseAdmin } from '../src/db'
;(async () => {
  const t = await supabaseAdmin.from('informacao_schema_tables').select('*').limit(0)
  console.log('info_schema erro (esperado):', t.error?.message?.slice(0,60))
  for (const tabela of ['movimentacoes','categorias','localizacoes','relatorio_saved','sessoes']) {
    const { error, count } = await supabaseAdmin.from(tabela as any).select('id', { count: 'exact', head: true })
    console.log('tabela', tabela, '->', error ? 'NAO EXISTE' : 'ok linhas=' + count)
  }
  const { data, error } = await supabaseAdmin.from('produtos').select('*').limit(1)
  console.log('colunas produtos:', error ? error.message : Object.keys(data![0]).join(', '))
})()
