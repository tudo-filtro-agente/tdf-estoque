import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Database, RefreshCw, Plug } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
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
import { api, type Fonte, type FonteFormData } from '../lib/api'

const TIPOS_META: Array<{ value: Fonte['tipo']; label: string }> = [
  { value: 'api', label: 'API' },
  { value: 'arquivo', label: 'Arquivo' },
  { value: 'manual', label: 'Manual' },
]

const TIPO_BADGE: Record<Fonte['tipo'], 'default' | 'secondary' | 'outline'> = {
  api: 'default',
  arquivo: 'secondary',
  manual: 'outline',
}

export default function FontesPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FonteFormData>({ codigo: '', nome: '', tipo: 'arquivo', base_url: '', ativa: true })
  const [editando, setEditando] = useState<number | null>(null)
  const [erro, setErro] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Fonte | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['fontes'],
    queryFn: () => api<{ fontes: Fonte[] }>('/api/fontes'),
  })

  const fontes = data?.fontes || []

  const salvarMutation = useMutation({
    mutationFn: (f: FonteFormData) =>
      editando
        ? api<Fonte>(`/api/fontes/${editando}`, { method: 'PUT', body: f })
        : api<Fonte>('/api/fontes', { method: 'POST', body: f }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fontes'] })
      setDialogOpen(false)
      setErro('')
    },
    onError: (e: Error) => setErro(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/api/fontes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fontes'] })
      setConfirmDelete(null)
    },
  })

  const syncMutation = useMutation({
    mutationFn: (id: number) => api(`/api/fontes/${id}/sync`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fontes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
    },
  })

  const abrirNova = () => {
    setEditando(null)
    setForm({ codigo: '', nome: '', tipo: 'arquivo', base_url: '', ativa: true })
    setErro('')
    setDialogOpen(true)
  }

  const abrirEdicao = (f: Fonte) => {
    setEditando(f.id)
    setForm({
      codigo: f.codigo,
      nome: f.nome,
      tipo: f.tipo,
      base_url: f.base_url || '',
      ativa: f.ativa,
    })
    setErro('')
    setDialogOpen(true)
  }

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.codigo.trim() || !form.nome.trim()) {
      setErro('Código e nome são obrigatórios')
      return
    }
    salvarMutation.mutate({
      ...form,
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      base_url: form.base_url?.trim() || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fontes</h1>
          <p className="text-sm text-slate-500">
            Configure de onde os produtos vêm: planilha, API ou cadastro manual
          </p>
        </div>
        <Button onClick={abrirNova}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Fonte
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : fontes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Database className="h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">Nenhuma fonte configurada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>URL Base</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Sync</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fontes.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">{f.codigo}</TableCell>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell>
                        <Badge variant={TIPO_BADGE[f.tipo]}>
                          {TIPOS_META.find((t) => t.value === f.tipo)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-slate-500">
                        {f.base_url || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.ativa ? 'success' : 'secondary'}>
                          {f.ativa ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {f.ultimo_sync
                          ? new Date(f.ultimo_sync).toLocaleString('pt-BR')
                          : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          {f.tipo === 'api' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => syncMutation.mutate(f.id)}
                              title="Sincronizar agora"
                              disabled={syncMutation.isPending}
                            >
                              <RefreshCw
                                className={`h-4 w-4 text-blue-600 ${
                                  syncMutation.isPending ? 'animate-spin' : ''
                                }`}
                              />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => abrirEdicao(f)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(f)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Fonte' : 'Nova Fonte'}</DialogTitle>
            <DialogDescription>
              {editando
                ? 'Atualize a configuração da fonte'
                : 'Adicione uma nova origem de dados para produtos'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSalvar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                  placeholder="Ex: omie"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as Fonte['tipo'] }))}
                >
                  {TIPOS_META.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Planilha de Inventário"
                required
              />
            </div>
            {form.tipo === 'api' && (
              <div className="space-y-2">
                <Label htmlFor="base_url" className="flex items-center gap-1">
                  <Plug className="h-3 w-3" />
                  URL Base
                </Label>
                <Input
                  id="base_url"
                  value={form.base_url}
                  onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                  placeholder="https://api.exemplo.com/v1"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                id="ativa"
                type="checkbox"
                checked={form.ativa}
                onChange={(e) => setForm((f) => ({ ...f, ativa: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="ativa">Fonte ativa</Label>
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

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir fonte</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{confirmDelete?.nome}</strong>?
              Esta ação não pode ser desfeita. Os produtos importados desta fonte
              não serão removidos.
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