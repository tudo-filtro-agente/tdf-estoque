import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import { api, type Localizacao, type Unidade } from '../lib/api'

export default function CadastrosPage() {
  const queryClient = useQueryClient()

  const { data: locData } = useQuery({
    queryKey: ['localizacoes'],
    queryFn: () => api<{ localizacoes: Localizacao[] }>('/api/localizacoes'),
  })

  const { data: unData } = useQuery({
    queryKey: ['unidades'],
    queryFn: () => api<{ unidades: Unidade[] }>('/api/unidades'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cadastros Auxiliares</h1>
        <p className="text-sm text-slate-500">
          Localizações e unidades de medida usadas nos produtos
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <LocalizacoesBloco
          localizacoes={locData?.localizacoes || []}
          onMudou={() => queryClient.invalidateQueries({ queryKey: ['localizacoes'] })}
        />

        <UnidadesBloco
          unidades={unData?.unidades || []}
          onMudou={() => queryClient.invalidateQueries({ queryKey: ['unidades'] })}
        />
      </div>
    </div>
  )
}

// ============================================================

function LocalizacoesBloco({
  localizacoes,
  onMudou,
}: {
  localizacoes: Localizacao[]
  onMudou: () => void
}) {
  const [nova, setNova] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState('')

  const criar = useMutation({
    mutationFn: () =>
      api<Localizacao>('/api/localizacoes', {
        method: 'POST',
        body: { codigo: nova.trim(), descricao: descricao.trim() || undefined },
      }),
    onSuccess: () => {
      onMudou()
      setNova('')
      setDescricao('')
      setErro('')
    },
    onError: (e: Error) => setErro(e.message),
  })

  const deletar = useMutation({
    mutationFn: (id: number) => api(`/api/localizacoes/${id}`, { method: 'DELETE' }),
    onSuccess: () => onMudou(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-5 w-5" />
          Localizações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!nova.trim()) {
              setErro('Informe o código')
              return
            }
            criar.mutate()
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="loc-codigo" className="sr-only">Código</Label>
              <Input
                id="loc-codigo"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                placeholder="Ex: A1-2, Prateleira B, etc."
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="loc-desc" className="sr-only">Descrição</Label>
              <Input
                id="loc-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição (opcional)"
              />
            </div>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Button type="submit" disabled={criar.isPending} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            {criar.isPending ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </form>

        <div className="mt-4">
          {localizacoes.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Nenhuma localização cadastrada
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {localizacoes.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-mono font-medium">{l.codigo}</span>
                    {l.descricao && (
                      <span className="ml-2 text-slate-500">— {l.descricao}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {l.uso_count !== undefined && (
                      <Badge variant="outline">{l.uso_count} produto(s)</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Excluir ${l.codigo}?`)) deletar.mutate(l.id)
                      }}
                      disabled={deletar.isPending || (l.uso_count || 0) > 0}
                      title={
                        (l.uso_count || 0) > 0
                          ? 'Localização em uso não pode ser excluída'
                          : 'Excluir'
                      }
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================

function UnidadesBloco({
  unidades,
  onMudou,
}: {
  unidades: Unidade[]
  onMudou: () => void
}) {
  const [nova, setNova] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState('')

  const criar = useMutation({
    mutationFn: () =>
      api<Unidade>('/api/unidades', {
        method: 'POST',
        body: { sigla: nova.trim(), descricao: descricao.trim() || undefined },
      }),
    onSuccess: () => {
      onMudou()
      setNova('')
      setDescricao('')
      setErro('')
    },
    onError: (e: Error) => setErro(e.message),
  })

  const deletar = useMutation({
    mutationFn: (id: number) => api(`/api/unidades/${id}`, { method: 'DELETE' }),
    onSuccess: () => onMudou(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-5 w-5" />
          Unidades de Medida
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!nova.trim()) {
              setErro('Informe a sigla')
              return
            }
            criar.mutate()
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="un-sigla" className="sr-only">Sigla</Label>
              <Input
                id="un-sigla"
                value={nova}
                onChange={(e) => setNova(e.target.value.toUpperCase())}
                placeholder="Ex: CX (caixa), M, KG"
                maxLength={6}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="un-desc" className="sr-only">Descrição</Label>
              <Input
                id="un-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição (opcional)"
              />
            </div>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Button type="submit" disabled={criar.isPending} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            {criar.isPending ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </form>

        <div className="mt-4">
          {unidades.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Nenhuma unidade cadastrada
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {unidades.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div>
                    <Badge>{u.sigla}</Badge>
                    {u.descricao && (
                      <span className="ml-2 text-slate-500">{u.descricao}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {u.uso_count !== undefined && (
                      <Badge variant="outline">{u.uso_count} produto(s)</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Excluir ${u.sigla}?`)) deletar.mutate(u.id)
                      }}
                      disabled={deletar.isPending || (u.uso_count || 0) > 0}
                      title={
                        (u.uso_count || 0) > 0 ? 'Unidade em uso' : 'Excluir'
                      }
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}