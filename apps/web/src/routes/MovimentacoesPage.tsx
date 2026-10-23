import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Filter,
  Package,
} from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  api,
  type Movimentacao,
  type MovimentacaoFormData,
  type Produto,
  type TipoMovimentacao,
  TIPOS_MOVIMENTACAO_META,
} from '../lib/api'

const formatNumber = (n: number | undefined | null) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(n || 0))

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function tipoBadge(tipo: TipoMovimentacao) {
  switch (tipo) {
    case 'entrada':
      return <Badge variant="success">Entrada</Badge>
    case 'saida':
      return <Badge variant="danger">Saída</Badge>
    case 'ajuste':
      return <Badge variant="warning">Ajuste</Badge>
    case 'inventario':
      return <Badge>Inventário</Badge>
    default:
      return <Badge variant="outline">{tipo}</Badge>
  }
}

export default function MovimentacoesPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Filtros
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [produtoFiltro, setProdutoFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const limite = 50

  // Form state
  const [form, setForm] = useState<Partial<MovimentacaoFormData>>({
    tipo: 'entrada',
    quantidade: 0,
  })
  const [erroForm, setErroForm] = useState('')

  // Dados dos produtos (para o select)
  const { data: produtosData } = useQuery({
    queryKey: ['produtos-select'],
    queryFn: () => api<{ produtos: Produto[] }>('/api/produtos?limite=1000&ativo=true'),
  })

  const produtos = produtosData?.produtos || []

  // Query movimentações
  const params = new URLSearchParams()
  if (tipoFiltro) params.set('tipo', tipoFiltro)
  if (produtoFiltro) params.set('produtoId', produtoFiltro)
  params.set('pagina', String(pagina))
  params.set('limite', String(limite))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['movimentacoes', tipoFiltro, produtoFiltro, pagina],
    queryFn: () =>
      api<{
        movimentacoes: Movimentacao[]
        total: number
        pagina: number
        total_paginas: number
      }>(`/api/movimentacoes?${params.toString()}`),
  })

  const movimentacoes = data?.movimentacoes || []
  const totalPaginas = data?.total_paginas || 1

  // Filtrar por nome/código no client-side (limitado à página atual)
  const movimentacoesFiltradas = movimentacoes.filter((m) => {
    if (!busca) return true
    const termo = busca.toLowerCase()
    return (
      m.produto?.nome.toLowerCase().includes(termo) ||
      m.produto?.codigo.toLowerCase().includes(termo) ||
      (m.documento || '').toLowerCase().includes(termo) ||
      (m.observacao || '').toLowerCase().includes(termo)
    )
  })

  // Mutation criar
  const createMutation = useMutation({
    mutationFn: (data: MovimentacaoFormData) =>
      api<Movimentacao>('/api/movimentacoes', {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
      setForm({ tipo: 'entrada', quantidade: 0 })
      setErroForm('')
    },
    onError: (error: Error) => {
      setErroForm(error.message)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.produto_id || !form.tipo || !form.quantidade || form.quantidade <= 0) {
      setErroForm('Preencha produto, tipo e quantidade (maior que zero)')
      return
    }
    createMutation.mutate({
      produto_id: form.produto_id,
      tipo: form.tipo,
      quantidade: Number(form.quantidade),
      documento: form.documento,
      observacao: form.observacao,
    })
  }

  const produtoSelecionado = produtos.find((p) => p.id === form.produto_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Movimentações</h1>
          <p className="text-sm text-slate-500">Registre entradas e saídas de estoque</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Movimentação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Movimentação</DialogTitle>
              <DialogDescription>
                Registre uma entrada, saída ou ajuste no estoque
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="produto_id">Produto *</Label>
                <Select
                  id="produto_id"
                  value={form.produto_id?.toString() || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, produto_id: Number(e.target.value) || undefined }))
                  }
                  required
                >
                  <option value="">Selecione um produto...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} — {p.nome} (saldo: {formatNumber(p.saldo_atual)} {p.unidade})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    id="tipo"
                    value={form.tipo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tipo: e.target.value as TipoMovimentacao }))
                    }
                    required
                  >
                    {TIPOS_MOVIMENTACAO_META.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.quantidade || ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantidade: Number(e.target.value) }))
                    }
                    required
                  />
                </div>
              </div>

              {produtoSelecionado && (
                <div className="rounded-md bg-slate-50 p-3 text-sm">
                  <p className="text-slate-500">Saldo atual:</p>
                  <p className="font-semibold text-slate-900">
                    {formatNumber(produtoSelecionado.saldo_atual)} {produtoSelecionado.unidade}
                  </p>
                  {form.tipo === 'entrada' && (
                    <p className="mt-1 text-green-700">
                      Novo saldo: {formatNumber(Number(produtoSelecionado.saldo_atual || 0) + Number(form.quantidade || 0))} {produtoSelecionado.unidade}
                    </p>
                  )}
                  {form.tipo === 'saida' && (
                    <p className="mt-1 text-red-700">
                      Novo saldo: {formatNumber(Number(produtoSelecionado.saldo_atual || 0) - Number(form.quantidade || 0))} {produtoSelecionado.unidade}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="documento">Documento</Label>
                <Input
                  id="documento"
                  value={form.documento || ''}
                  onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
                  placeholder="Ex: NF-00123, OS-456"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacao">Observação</Label>
                <Textarea
                  id="observacao"
                  value={form.observacao || ''}
                  onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                  placeholder="Motivo da movimentação..."
                  rows={3}
                />
              </div>

              {erroForm && (
                <p className="text-sm text-red-600">{erroForm}</p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Salvando...' : 'Registrar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowDownToLine className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-slate-500">Total de Movimentos</p>
                <p className="text-2xl font-bold text-slate-900">{data?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-slate-500">Página</p>
                <p className="text-2xl font-bold text-slate-900">
                  {pagina} / {totalPaginas}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowUpFromLine className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-slate-500">Exibindo</p>
                <p className="text-2xl font-bold text-slate-900">
                  {movimentacoesFiltradas.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="busca">Buscar</Label>
              <Input
                id="busca"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, código ou documento..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo_filtro">Tipo</Label>
              <Select
                id="tipo_filtro"
                value={tipoFiltro}
                onChange={(e) => {
                  setTipoFiltro(e.target.value)
                  setPagina(1)
                }}
              >
                <option value="">Todos</option>
                {TIPOS_MOVIMENTACAO_META.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="produto_filtro">Produto</Label>
              <Select
                id="produto_filtro"
                value={produtoFiltro}
                onChange={(e) => {
                  setProdutoFiltro(e.target.value)
                  setPagina(1)
                }}
              >
                <option value="">Todos</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.nome}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-red-600">
              Erro ao carregar movimentações
            </div>
          ) : movimentacoesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                Nenhuma movimentação encontrada
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Saldo Após</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoesFiltradas.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-sm text-slate-500">
                        {formatDateTime(m.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{m.produto?.nome || '—'}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {m.produto?.codigo || ''}
                        </div>
                      </TableCell>
                      <TableCell>{tipoBadge(m.tipo)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(m.quantidade)} {m.produto?.unidade}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {m.saldo_posterior !== undefined
                          ? `${formatNumber(m.saldo_posterior)} ${m.produto?.unidade}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {m.documento || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {m.usuario?.nome || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-slate-500">
            Página {pagina} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina >= totalPaginas}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}