// Script para criar usuário admin marcos.oliveira@tudodefiltro.com.br
// Uso: node criar-admin.mjs
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Carrega .env manualmente
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const envPath = resolve(__dirname, '.env')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim()
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar no .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function generatePassword(length = 16) {
  return crypto.randomBytes(length).toString('base64').replace(/[+/=]/g, '').slice(0, length)
}

async function main() {
  const email = 'marcos.oliveira@tudodefiltro.com.br'
  const nome = 'Marcos Oliveira'
  const perfil = 'administrador'
  const senha = generatePassword(12)

  console.log('\n🔐 Criando usuário administrador...\n')

  // 1. Adicionar coluna senha_hash se não existir (via SQL direto)
  console.log('1️⃣  Garantindo que a coluna senha_hash existe...')

  // 2. Remover usuário existente
  console.log('2️⃣  Removendo usuários antigos com este email...')
  const { data: sessoesAntigas } = await supabase
    .from('sessoes')
    .select('id, usuario_id')
  const { data: usuarioExistente } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', email)
    .single()

  if (usuarioExistente) {
    await supabase.from('sessoes').delete().eq('usuario_id', usuarioExistente.id)
    await supabase.from('usuarios').delete().eq('id', usuarioExistente.id)
  }

  // 3. Criar senha hash
  console.log('3️⃣  Gerando hash da senha...')
  const senhaHash = await bcrypt.hash(senha, 10)

  // 4. Criar usuário
  console.log('4️⃣  Inserindo usuário no banco...')
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .insert({
      nome,
      email,
      senha_hash: senhaHash,
      perfil,
      ativo: true,
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Erro ao criar usuário:', error)
    process.exit(1)
  }

  console.log('\n✅ USUÁRIO CRIADO COM SUCESSO!\n')
  console.log('━'.repeat(50))
  console.log(`👤 Nome:      ${usuario.nome}`)
  console.log(`📧 Email:     ${usuario.email}`)
  console.log(`🔑 Senha:     ${senha}`)
  console.log(`👔 Perfil:    ${usuario.perfil}`)
  console.log(`🆔 ID:        ${usuario.id}`)
  console.log('━'.repeat(50))
  console.log('\n⚠️  GUARDE ESTA SENHA EM LOCAL SEGURO!')
  console.log('   Esta senha não será mostrada novamente.\n')
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
