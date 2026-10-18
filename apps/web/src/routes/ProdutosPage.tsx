import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Produto } from '../lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react'

// Componente Modal de Produto (simplificado)
function ProdutoModal({
  produto,
  onClose,
  onSave
}: {
  produto?: Produto
  onClose: () => void
  onSave: () => void
}) {
  const [form, setForm] = useState({
    codigo: produto?.codigo || '',
    nome: produto?.nome || '',
    descricao: produto?.descricao || '',
    unidade: produto?.unidade || 'UN',
    categoria: produto?.categoria || '',
    ncm: produto?.ncm || '',
    preco_custo: produto?.preco_custo || 0,
    preco_venda: produto?.preco_venda || 0,
    estoque_minimo: produto?.estoque_minimo || 0,
    localizacao: produto?.localizacao || '',
  })

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (produto) {
        return api<Produto>(`/api/produtos/${produto.id}`, {
          method: 'PUT',
          body: data,
        })
      } else {
        return api<Produto>('/api/produtos', {
          method: 'POST',
          body: data,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      onSave()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{produto ? 'Editar Produto' : 'Novo Produto'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Código *</label>
                <Input value={form.codigo} onChange={(e) => setForm({...form, codigo: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Unidade</label>
                <select
                  value={form.unidade}
                  onChange={(e) => setForm({...form, unidade: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="UN">UN - Unidade</option>
                  <option value="KG">KG - Quilograma</option>
                  <option value="LT">LT - Litro</option>
                  <option value="MT">MT - Metro</option>
                  <option value="M2">M2 - Metro Quadrado</option>
                  <option value="M3">M3 - Metro Cúbico</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <textarea
                value={form.descricao}
                onChange={(e) => setForm({...form, descricao: e.target.value})}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria</label>
                <Input value={form.categoria} onChange={(e) => setForm({...form, categoria: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">NCM</label>
                <Input value={form.ncm} onChange={(e) => setForm({...form, ncm: e.target.value})} placeholder="0000.00.00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Preço Custo (R$)</label>
                <Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({...form, preco_custo: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Preço Venda (R$)</label>
                <Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({...form, preco_venda: parseFloat(e.target.value) || 0})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Estoque Mínimo</label>
                <Input type="number" value={form.estoque_minimo} onChange={(e) => setForm({...form, estoque_minimo: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Localização</label>
                <Input value={form.localizacao} onChange={(e) => setForm({...form, localizacao: e.target.value})} placeholder="Prateleira A-1" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ProdutosPage() {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<Produto | undefined>()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['produtos', busca, categoria],
    queryFn: () => api<{ data: Produto[], total: number }>('/api/produtos', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      }
    }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/api/produtos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
    },
  })

  const produtos = data?.data || []
  const categorias = [...new Set(produtos.map(p => p.categoria).filter(Boolean))]

  const formatCurrency = (value?: number) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-sm text-slate-500">{data?.total || 0} produtos cadastrados</p>
        </div>
        <Button onClick={() => { setProdutoEditando(undefined); setModalOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas as categorias</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : produtos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900">Nenhum produto encontrado</h3>
              <p className="text-sm text-slate-500 mt-1">
                Comece cadastrando seu primeiro produto
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Categoria</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Un</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Custo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Venda</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {produtos.map((produto) => (
                    <tr key={produto.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium">{produto.codigo}</td>
                      <td className="px-4 py-3 text-sm">{produto.nome}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{produto.categoria || '-'}</td>
                      <td className="px-4 py-3 text-sm">{produto.unidade}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(produto.preco_custo)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(produto.preco_venda)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={produto.ativo ? 'success' : 'danger'}>
                          {produto.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setProdutoEditando(produto); setModalOpen(true) }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Tem certeza que deseja excluir este produto?')) {
                                deleteMutation.mutate(produto.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {modalOpen && (
        <ProdutoModal
          produto={produtoEditando}
          onClose={() => setModalOpen(false)}
          onSave={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
