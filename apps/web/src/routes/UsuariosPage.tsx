import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, UserCog, ToggleLeft, ToggleRight } from 'lucide-react'
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
import { api, type UsuarioGerenciado, PERFIS_META } from '../lib/api'

interface FormState {
  id?: number
  nome: string
  email: string
  senha?: string
  perfil: UsuarioGerenciado['perfil']
  ativo: boolean
}

const FORM_VAZIO: FormState = {
  nome: '',
  email: '',
  senha: '',
  perfil: 'estoquista',
  ativo: true,
}

export default function UsuariosPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [erro, setErro] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<UsuarioGerenciado | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api<{ usuarios: UsuarioGerenciado[] }>('/api/usuarios'),
  })

  const usuarios = data?.usuarios || []

  const salvarMutation = useMutation({
    mutationFn: (f: FormState) =>
      f.id
        ? // PUT: senha é opcional (só envia se foi preenchida)
          api<UsuarioGerenciado>(`/api/usuarios/${f.id}`, {
            method: 'PUT',
            body: { ...f, senha: f.senha || undefined },
          })
        : api<UsuarioGerenciado>('/api/usuarios', { method: 'POST', body: f }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setDialogOpen(false)
      setForm(FORM_VAZIO)
      setErro('')
    },
    onError: (e: Error) => setErro(e.message),
  })

  const deletarMutation = useMutation({
    mutationFn: (id: number) => api(`/api/usuarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setConfirmDelete(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      api(`/api/usuarios/${id}`, {
        method: 'PATCH',
        body: { ativo },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const abrirNova = () => {
    setForm(FORM_VAZIO)
    setErro('')
    setDialogOpen(true)
  }

  const abrirEdicao = (u: UsuarioGerenciado) => {
    setForm({
      id: u.id,
      nome: u.nome,
      email: u.email,
      senha: '',
      perfil: u.perfil,
      ativo: u.ativo,
    })
    setErro('')
    setDialogOpen(true)
  }

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim()) {
      setErro('Nome e e-mail são obrigatórios')
      return
    }
    if (!form.id && (!form.senha || form.senha.length < 6)) {
      setErro('Senha deve ter pelo menos 6 caracteres')
      return
    }
    salvarMutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500">
            Gerencie quem tem acesso ao sistema e seus perfis
          </p>
        </div>
        <Button onClick={abrirNova}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserCog className="h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">Nenhum usuário cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell className="text-sm text-slate-500">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.perfil === 'administrador' ? 'default' : 'secondary'}>
                          {u.perfil}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.ativo ? 'success' : 'secondary'}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {u.ultimo_login
                          ? new Date(u.ultimo_login).toLocaleString('pt-BR')
                          : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              toggleMutation.mutate({ id: u.id, ativo: !u.ativo })
                            }
                            title={u.ativo ? 'Desativar' : 'Ativar'}
                            disabled={toggleMutation.isPending}
                          >
                            {u.ativo ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-slate-400" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => abrirEdicao(u)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(u)}
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
            <DialogTitle>{form.id ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>
              {form.id
                ? 'Atualize os dados do usuário'
                : 'Crie um novo acesso. O e-mail deve ser @tudodefiltro.com.br'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSalvar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">{form.id ? 'Nova Senha' : 'Senha *'}</Label>
              <Input
                id="senha"
                type="password"
                value={form.senha || ''}
                onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                placeholder={form.id ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="perfil">Perfil</Label>
                <select
                  id="perfil"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={form.perfil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, perfil: e.target.value as UsuarioGerenciado['perfil'] }))
                  }
                >
                  {PERFIS_META.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ativo">Status</Label>
                <div className="flex h-10 items-center gap-2">
                  <input
                    id="ativo"
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="ativo" className="text-sm">
                    Ativo
                  </label>
                </div>
              </div>
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
            <DialogTitle>Excluir usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{confirmDelete?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deletarMutation.mutate(confirmDelete.id)}
              disabled={deletarMutation.isPending}
            >
              {deletarMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}