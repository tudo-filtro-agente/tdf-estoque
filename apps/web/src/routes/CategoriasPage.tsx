import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Tags } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { api, type Categoria } from '../lib/api'

interface FormState {
  id?: number
  nome: string
  descricao: string
  ativa: boolean
}

const FORM_VAZIO: FormState = { nome: '', descricao: '', ativa: true }

export default function CategoriasPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [erro, setErro] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Categoria | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api<{ categorias: Categoria[] }>('/api/categorias'),
  })

  const categorias = data?.categorias || []

  const salvarMutation = useMutation({
    mutationFn: (f: FormState) =>
      f.id
        ? api<Categoria>(`/api/categorias/${f.id}`, { method: 'PUT', body: f })
        : api<Categoria>('/api/categorias', { method: 'POST', body: f }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      setDialogOpen(false)
      setForm(FORM_VAZIO)
      setErro('')
    },
    onError: (e: Error) => setErro(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/api/categorias/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      setConfirmDelete(null)
    },
  })

  const abrirNova = () => {
    setForm(FORM_VAZIO)
    setErro('')
    setDialogOpen(true)
  }

  const abrirEdicao = (c: Categoria) => {
    setForm({ id: c.id, nome: c.nome, descricao: c.descricao || '', ativa: c.ativa })
    setErro('')
    setDialogOpen(true)
  }

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) {
      setErro('O nome é obrigatório')
      return
    }
    salvarMutation.mutate({ ...form, nome: form.nome.trim() })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
          <p className="text-sm text-slate-500">Organize os produtos em grupos</p>
        </div>
        <Button onClick={abrirNova}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : categorias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tags className="h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">Nenhuma categoria cadastrada</p>
              <Button className="mt-4" onClick={abrirNova}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeira categoria
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorias.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {c.descricao || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.ativa ? 'success' : 'secondary'}>
                          {c.ativa ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => abrirEdicao(c)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(c)}
                            className="text-red-600 hover:text-red-700"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            <DialogDescription>
              {form.id ? 'Atualize os dados da categoria' : 'Crie uma nova categoria de produtos'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSalvar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Purificadores"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Opcional"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="ativa"
                type="checkbox"
                checked={form.ativa}
                onChange={(e) => setForm((f) => ({ ...f, ativa: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="ativa">Categoria ativa</Label>
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvarMutation.isPending}>
                {salvarMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir categoria</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir &quot;{confirmDelete?.nome}&quot;? Esta ação não
              pode ser desfeita. Produtos desta categoria não serão alterados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}