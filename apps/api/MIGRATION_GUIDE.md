# Guia de Migração - TDF Estoque

## Aplicar o Schema

1. Acesse o Supabase Dashboard do projeto
2. Vá em SQL Editor
3. Copie o conteúdo de `supabase/migrations/001_initial_schema.sql`
4. Execute o SQL

## Verificar

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

Deve retornar: empresas, fontes, usuarios, sessoes, produtos
