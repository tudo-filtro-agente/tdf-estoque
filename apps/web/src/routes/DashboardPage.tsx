import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Tags,
  Activity,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  api,
  type DashboardKpis,
  type AlertaEstoqueMinimo,
  type Movimentacao,
  type MovimentacaoPorDia,
  type ResumoMovimentacao,
  type ResumoPorCategoria,
} from '../lib/api'

const formatBRL = (n: number | undefined | null) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(n || 0))

const formatNumber = (n: number | undefined | null) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(n || 0))

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function DashboardPage() {
  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => api<DashboardKpis>('/api/dashboard/kpis'),
  })

  const { data: graficos } = useQuery({
    queryKey: ['dashboard-graficos'],
    queryFn: () =>
      api<{
        por_dia: MovimentacaoPorDia[]
        resumo: ResumoMovimentacao[]
      }>('/api/dashboard/graficos?dias=30'),
  })

  const { data: alertas } = useQuery({
    queryKey: ['dashboard-alertas'],
    queryFn: () => api<{ alertas: AlertaEstoqueMinimo[] }>('/api/dashboard/alertas?limite=10'),
  })

  const { data: categorias } = useQuery({
    queryKey: ['dashboard-categorias'],
    queryFn: () => api<{ categorias: ResumoPorCategoria[] }>('/api/dashboard/por-categoria'),
  })

  const { data: recentes } = useQuery({
    queryKey: ['dashboard-recentes'],
    queryFn: () =>
      api<{ movimentacoes: Movimentacao[] }>('/api/dashboard/recentes?limite=8'),
  })

  const totais = (graficos?.resumo || []).reduce(
    (acc, r) => {
      if (r.tipo === 'entrada') acc.entradas = r.total_quantidade
      if (r.tipo === 'saida') acc.saidas = r.total_quantidade
      return acc
    },
    { entradas: 0, saidas: 0 }
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Visão geral do estoque e movimentações dos últimos 30 dias</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          icon={<Package className="h-5 w-5" />}
          titulo="Produtos Ativos"
          valor={kpis ? formatNumber(kpis.total_produtos_ativos) : '—'}
          cor="primary"
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          titulo="Valor em Estoque"
          valor={kpis ? formatBRL(kpis.valor_total_estoque) : '—'}
          cor="green"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          titulo="Abaixo do Mínimo"
          valor={kpis ? formatNumber(kpis.total_abaixo_minimo) : '—'}
          cor="red"
          alerta={(kpis?.total_abaixo_minimo || 0) > 0}
        />
        <KpiCard
          icon={<Tags className="h-5 w-5" />}
          titulo="Categorias"
          valor={kpis ? formatNumber(kpis.total_categorias) : '—'}
          cor="blue"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          icon={<Activity className="h-5 w-5" />}
          titulo="Movim. (30d)"
          valor={kpis ? formatNumber(kpis.total_movimentacoes_30d) : '—'}
          cor="primary"
          pequeno
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          titulo="Entradas (30d)"
          valor={kpis ? formatNumber(kpis.total_entradas_30d) : '—'}
          cor="green"
          pequeno
        />
        <KpiCard
          icon={<TrendingDown className="h-5 w-5" />}
          titulo="Saídas (30d)"
          valor={kpis ? formatNumber(kpis.total_saidas_30d) : '—'}
          cor="red"
          pequeno
        />
        <KpiCard
          icon={<Package className="h-5 w-5" />}
          titulo="S/ Movimento (30d)"
          valor={kpis ? formatNumber(kpis.total_sem_movimento_30d) : '—'}
          cor="amber"
          pequeno
        />
      </div>

      {/* Gráfico de tendência (simples, CSS-only) */}
      {graficos?.por_dia && graficos.por_dia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" />
              Movimentações dos últimos 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TendenciaSimples
              dados={graficos.por_dia}
              entradas={totais.entradas}
              saidas={totais.saidas}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Alertas de estoque mínimo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Abaixo do Mínimo
            </CardTitle>
            <Link to="/movimentacoes">
              <Button variant="ghost" size="sm">
                Ver tudo <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {!alertas?.alertas?.length ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500">
                Nenhum produto abaixo do mínimo
              </div>
            ) : (
              <ul className="divide-y">
                {alertas.alertas.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-6 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {a.nome}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {a.codigo} • {a.categoria || 'sem categoria'} • {a.localizacao || 'sem localização'}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <Badge variant="danger">
                        {formatNumber(a.saldo_atual)} / mín {formatNumber(a.estoque_minimo)} {a.unidade}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Estoque por categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="h-5 w-5" />
              Estoque por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!categorias?.categorias?.length ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Nenhuma categoria cadastrada
              </div>
            ) : (
              <div className="space-y-2">
                {categorias.categorias
                  .sort((a, b) => b.valor_total - a.valor_total)
                  .slice(0, 7)
                  .map((c) => (
                    <div
                      key={c.categoria}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-700">{c.categoria}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-slate-500">{formatNumber(c.total_estoque)} un</span>
                        <span className="font-semibold text-slate-900">{formatBRL(c.valor_total)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movimentações recentes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" />
            Atividade Recente
          </CardTitle>
          <Link to="/movimentacoes">
            <Button variant="ghost" size="sm">
              Ver tudo <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {!recentes?.movimentacoes?.length ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Nenhuma movimentação registrada
            </div>
          ) : (
            <ul className="divide-y">
              {recentes.movimentacoes.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    {m.tipo === 'entrada' || m.tipo === 'inventario' ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : m.tipo === 'saida' ? (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    ) : (
                      <Activity className="h-4 w-4 text-amber-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{m.produto?.nome || '—'}</p>
                      <p className="text-xs text-slate-500 font-mono">{m.produto?.codigo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {m.tipo === 'saida' ? '−' : '+'}
                      {formatNumber(m.quantidade)} {m.produto?.unidade}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(m.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Subcomponentes locais
// ============================================================

function KpiCard({
  icon,
  titulo,
  valor,
  cor,
  alerta,
  pequeno,
}: {
  icon: React.ReactNode
  titulo: string
  valor: string
  cor: 'primary' | 'green' | 'red' | 'blue' | 'amber'
  alerta?: boolean
  pequeno?: boolean
}) {
  const cores = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
  }
  return (
    <Card className={alerta ? 'border-red-200' : ''}>
      <CardContent className={pequeno ? 'pt-4' : 'pt-6'}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cores[cor]}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">{titulo}</p>
            <p className={`font-bold text-slate-900 ${pequeno ? 'text-lg' : 'text-2xl'}`}>
              {valor}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Mini-gráfico de tendência que usa apenas CSS — não é uma lib de charts,
 * não tem tooltips, mas tem densidade e clareza para um dashboard rápido.
 * Cada barra representa um dia; mostra entradas e saídas lado a lado.
 */
function TendenciaSimples({
  dados,
  entradas,
  saidas,
}: {
  dados: MovimentacaoPorDia[]
  entradas: number
  saidas: number
}) {
  const maximo = Math.max(
    ...dados.map((d) => Math.max(d.entrada, d.saida)),
    1
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-500">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />
            Entradas: <strong className="text-slate-700">{entradas}</strong>
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
            Saídas: <strong className="text-slate-700">{saidas}</strong>
          </span>
        </div>
        <span className="text-slate-400">
          {dados.length} dias • max/dia: {maximo}
        </span>
      </div>
      <div className="flex h-32 items-end gap-0.5">
        {dados.map((d) => {
          const hE = (d.entrada / maximo) * 100
          const hS = (d.saida / maximo) * 100
          return (
            <div
              key={d.dia}
              className="group relative flex h-full w-full items-end justify-center"
              title={`${d.dia}: +${d.entrada} / −${d.saida}`}
            >
              <div
                className="w-1/2 bg-green-500 opacity-80 first:rounded-t-sm"
                style={{ height: `${hE}%` }}
              />
              <div
                className="w-1/2 bg-red-500 opacity-80 rounded-t-sm"
                style={{ height: `${hS}%` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
