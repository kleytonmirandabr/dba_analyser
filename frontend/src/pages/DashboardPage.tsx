import { useState, useEffect } from 'react'
import { Database, Plug, Activity, Shield, Terminal, GitCompareArrows, ArrowUpRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, RadialBarChart, RadialBar } from 'recharts'
import api from '../lib/api'

// Health Score Gauge
function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  const data = [{ value: score, fill: color }]
  return (
    <div className="relative w-32 h-32 mx-auto">
      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={data} barSize={10}>
        <RadialBar dataKey="value" cornerRadius={5} background={{ fill: 'rgba(100,100,100,0.15)' }} />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <span className="text-2xl font-bold text-gray-800 dark:text-white">{score}%</span>
        <span className="text-[10px] text-gray-500">Saúde Geral</span>
      </div>
    </div>
  )
}

// Status Donut
function StatusDonut({ active, inactive }: { active: number; inactive: number }) {
  const data = [
    { name: 'Ativas', value: active },
    { name: 'Inativas', value: inactive },
  ]
  const colors = ['#3b82f6', '#374151']
  return (
    <div className="relative w-24 h-24 mx-auto">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} innerRadius={28} outerRadius={38} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
            {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-800 dark:text-white">{active}</span>
        <span className="text-[9px] text-gray-500">ativas</span>
      </div>
    </div>
  )
}

// Mini Sparkline
function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#grad-${color.replace('#','')})`} />
          <Tooltip contentStyle={{ display: 'none' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Status Badge
function StatusBadge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return (
    <div className="flex items-center gap-1.5 text-gray-400">
      <AlertTriangle className="w-3.5 h-3.5" /><span className="text-xs">{label}</span>
    </div>
  )
  return ok ? (
    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
      <CheckCircle2 className="w-3.5 h-3.5" /><span className="text-xs font-medium">{label}</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
      <XCircle className="w-3.5 h-3.5" /><span className="text-xs font-medium">{label}</span>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ connections: 0, pendingExec: 0, vpnConnected: false })
  const [healthScore, setHealthScore] = useState(0)

  useEffect(() => {
    Promise.all([
      api.get('/api/connections').then(r => r.data.data).catch(() => []),
      api.get('/api/execution?status=pending').then(r => r.data.data.length).catch(() => 0),
      api.get('/api/vpn/status').then(r => r.data.data.connected).catch(() => false),
      api.get('/api/health/score').then(r => r.data.data.score).catch(() => 72),
    ]).then(([connections, pendingExec, vpnConnected, score]) => {
      const connArr = Array.isArray(connections) ? connections : []
      setStats({ connections: connArr.length, pendingExec, vpnConnected })
      setHealthScore(score || 72)
    })
  }, [])

  // Simulated sparkline data (would come from /api/metrics/history in production)
  const queryTrend = [12, 19, 14, 22, 18, 25, 30, 28, 35, 32, 40, 38]
  const execTrend = [3, 5, 2, 4, 6, 3, 7, 5, 4, 6, 3, 2]

  const quickActions = [
    { label: 'Nova Query', icon: Terminal, to: '/query' },
    { label: 'Explorer', icon: Database, to: '/explorer' },
    { label: 'Comparar', icon: GitCompareArrows, to: '/compare' },
    { label: 'Audit Log', icon: Shield, to: '/audit' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>

      {/* Top Row: Health + Connections + VPN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health Score */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Saúde do Ambiente</p>
          <HealthGauge score={healthScore} />
          <div className="flex justify-center gap-4 mt-3">
            <StatusBadge ok={stats.vpnConnected} label="VPN" />
            <StatusBadge ok={stats.connections > 0} label="Conexões" />
            <StatusBadge ok={stats.pendingExec === 0} label="Fila limpa" />
          </div>
        </div>

        {/* Connections Donut */}
        <Link to="/connections" className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Conexões</p>
            <ArrowUpRight className="w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-blue-500 transition" />
          </div>
          <StatusDonut active={stats.connections} inactive={Math.max(0, 5 - stats.connections)} />
          <p className="text-center text-xs text-gray-500 mt-2">{stats.connections} de {Math.max(stats.connections, 5)} slots em uso</p>
        </Link>

        {/* Executions Pending */}
        <Link to="/executions" className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-amber-300 dark:hover:border-amber-700 transition group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Execuções Pendentes</p>
            <ArrowUpRight className="w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-amber-500 transition" />
          </div>
          <div className="flex items-center justify-center my-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
              stats.pendingExec === 0
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            }`}>
              {stats.pendingExec}
            </div>
          </div>
          <p className="text-center text-xs text-gray-500">
            {stats.pendingExec === 0 ? '✓ Nenhuma pendência' : `${stats.pendingExec} aguardando aprovação`}
          </p>
        </Link>
      </div>

      {/* Sparklines Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Queries (últimas 12h)</p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">{queryTrend[queryTrend.length - 1]}</p>
          <Sparkline data={queryTrend} color="#3b82f6" />
        </div>
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Execuções (últimas 12h)</p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">{execTrend[execTrend.length - 1]}</p>
          <Sparkline data={execTrend} color="#f59e0b" />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Acesso Rápido</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((a, i) => (
            <Link key={i} to={a.to} className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/5 transition text-center">
              <a.icon className="w-6 h-6 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 dark:text-gray-400">{a.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
