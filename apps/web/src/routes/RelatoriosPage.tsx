import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, BarChart3, AlertTriangle, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import {
  TabsInner,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui/tabs'
import {
  api,
  type AlertaEstoqueMinimo,
  type ResumoPorCategoria,
  type ResumoPorLocalizacao,
  type ResumoMovimentacao,
  getToken,
} from '../lib/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const formatNumber = (n: number | undefined | null) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(n || 0))

const formatBRL = (n: number | undefined | null) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(n || 0))

/** Download de relatório — abre em nova aba para o backend streamar o arquivo. */
async function downloadRelatorio(
  endpoint: string,
  params: Record<string, string | number>
) {
  const url = new URL(`${API_URL}${endpoint}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== undefined && v !== null) url.searchParams.set(k, String(v))
  })
  const token = getToken()
  const resp = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) {
    alert('Erro ao gerar relatório')
    return
  }
  const blob = await resp.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const dispoHeader = resp.headers.get('content-disposition')
  const match = dispoHeader?.match(/filename="(.+)"/)
  a.download = match?.[1] || 'relatorio.xlsx'
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function RelatoriosPage() {
  const hoje = new Date().toISOString().slice(0, 10)
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [filtros, setFiltros] = useState({
    de: trintaDiasAtras,
    ate: hoje,
    categoria: '',
    localizacao: '',
    tipo: '',
  })

  // Alertas (abaixo do mínimo)
  const { data: alertas } = useQuery({
    queryKey: ['relatorio-alertas'],
    queryFn: () => api<{ alertas: AlertaEstoqueMinimo[]; total: number }>(
      '/api/relatorios/estoque-minimo'
    ),
  })

  // Por categoria
  const { data: categorias } = useQuery({
    queryKey: ['relatorio-categorias'],
    queryFn: () =>
      api<{ categorias: ResumoPorCategoria[]; total: number }>('/api/relatorios/por-categoria'),
  })

  // Por localização
  const { data: localizacoes } = useQuery({
    queryKey: ['relatorio-localizacoes'],
    queryFn: () =>
      api<{ localizacoes: ResumoPorLocalizacao[]; total: number }>(
        '/api/relatorios/por-localizacao'
      ),
  })

  // Resumo de movimentações (filtrado)
  const params = new URLSearchParams()
  if (filtros.de) params.set('de', filtros.de)
  if (filtros.ate) params.set('ate', filtros.ate)
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.categoria) params.set('categoria', filtros.categoria)

  const { data: resumMov } = useQuery({
    queryKey: ['relatorio-mov', filtros],
    queryFn: () =>
      api<{
        resumo: ResumoMovimentacao[]
        por_dia: Array<{ dia: string; entrada: number; saida: number }>
      }>(`/api/relatorios/resumo-movimentacoes?${params.toString()}`),
  })

  const handleDownload = (tipo: string) => {
    downloadRelatorio(`/api/relatorios/export/${tipo}`, {
      de: filtros.de,
      ate: filtros.ate,
      categoria: filtros.categoria,
      localizacao: filtros.localizacao,
      tipo: filtros.tipo,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-sm text-slate-500">
          Análises de estoque, movimentações e posições
        </p>
      </div>

      {/* Filtros comuns */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="de">De</Label>
              <input
                type="date"
                id="de"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={filtros.de}
                onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ate">Até</Label>
              <input
                type="date"
                id="ate"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={filtros.ate}
                onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <input
                type="text"
                id="categoria"
                placeholder="Ex: purificadores"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={filtros.categoria}
                onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="localizacao">Localização</Label>
              <input
                type="text"
                id="localizacao"
                placeholder="Ex: A1-2"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={filtros.localizacao}
                onChange={(e) => setFiltros((f) => ({ ...f, localizacao: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <select
                id="tipo"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={filtros.tipo}
                onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste</option>
                <option value="inventario">Inventário</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <TabsInner defaultValue="movimentacoes">
        <TabsList>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          <TabsTrigger value="alertas">Abaixo do Mínimo</TabsTrigger>
          <TabsTrigger value="categorias">Por Categoria</TabsTrigger>
          <TabsTrigger value="localizacoes">Por Localização</TabsTrigger>
        </TabsList>

        <TabsContent value="movimentacoes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5" />
                Resumo de Movimentações
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleDownload('movimentacoes')}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </CardHeader>
            <CardContent>
              {!resumMov?.resumo?.length ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Nenhuma movimentação no período
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {resumMov.resumo.map((r) => (
                      <div
                        key={r.tipo}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          {r.tipo}
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {formatNumber(r.total_quantidade)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {r.total_movimentos} movimentos
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Estoque Abaixo do Mínimo ({alertas?.total || 0})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleDownload('alertas')}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!alertas?.alertas?.length ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Nenhum produto abaixo do mínimo
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                          Código
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                          Nome
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                          Categoria
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                          Saldo
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                          Mínimo
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                          Déficit
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {alertas.alertas.map((a) => (
                        <tr key={a.id}>
                          <td className="px-4 py-2 font-mono text-xs">{a.codigo}</td>
                          <td className="px-4 py-2">{a.nome}</td>
                          <td className="px-4 py-2 text-slate-500">{a.categoria || '—'}</td>
                          <td className="px-4 py-2 text-right font-medium">
                            {formatNumber(a.saldo_atual)} {a.unidade}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-500">
                            {formatNumber(a.estoque_minimo)} {a.unidade}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Badge variant="danger">
                              {formatNumber(a.deficit)} {a.unidade}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5" />
                Estoque por Categoria ({categorias?.total || 0})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleDownload('categorias')}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!categorias?.categorias?.length ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Sem dados
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                        Categoria
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                        Produtos
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                        Estoque Total
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {categorias.categorias.map((c) => (
                      <tr key={c.categoria}>
                        <td className="px-4 py-2 font-medium">{c.categoria}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(c.total_produtos)}</td>
                        <td className="px-4 py-2 text-right text-slate-500">
                          {formatNumber(c.total_estoque)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {formatBRL(c.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="localizacoes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5" />
                Estoque por Localização ({localizacoes?.total || 0})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleDownload('localizacoes')}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!localizacoes?.localizacoes?.length ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Nenhuma localização cadastrada
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                        Localização
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                        Produtos
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                        Estoque Total
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {localizacoes.localizacoes.map((l) => (
                      <tr key={l.localizacao}>
                        <td className="px-4 py-2 font-medium">{l.localizacao}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(l.total_produtos)}</td>
                        <td className="px-4 py-2 text-right text-slate-500">
                          {formatNumber(l.total_estoque)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {formatBRL(l.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </TabsInner>
    </div>
  )
}