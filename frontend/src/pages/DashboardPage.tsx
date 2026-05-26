import { useState, useEffect } from 'react'
import { Database, Plug, Activity, Shield, Terminal, GitCompareArrows, ArrowUpRight, CheckCircle2, XCircle, AlertTriangle, Info, HelpCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, RadialBarChart, RadialBar } from 'recharts'
import api from '../lib/api'

// Tooltip info component
function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-block">
      <HelpCircle 
        className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 hover:text-blue-400 dark:hover:text-blue-400 cursor-help transition"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 dark:bg-gray-700 border border-gray-700 dark:border-gray-600 rounded-lg shadow-xl">
          <p className="text-xs text-gray-200 leading-relaxed">{text}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45 -mt-1"></div>
        </div>
      )}
    </div>
  )
}

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
function StatusDonut({ active, total }: { active: number; total: number }) {
  const inactive = total - active
  const data = [
    { name: 'Ativas', value: active },
    { name: 'Inativas', value: Math.max(inactive, 0) },
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
  const gradId = `grad-${color.replace('#','')}-${Math.random().toString(36).slice(2,6)}`
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} />
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
  const [stats, setStats] = useState({ connections: 0, totalConnections: 0, pendingExec: 0, vpnConnected: false })
  const [healthScore, setHealthScore] = useState(0)
  const [queryCount, setQueryCount] = useState(0)
  const [execCount, setExecCount] = useState(0)
  const [queryTrend, setQueryTrend] = useState<number[]>([0,0,0,0,0,0,0,0,0,0,0,0])
  const [execTrend, setExecTrend] = useState<number[]>([0,0,0,0,0,0,0,0,0,0,0,0])

  useEffect(() => {
    Promise.all([
      api.get('/api/connections').then(r => r.data.data).catch(() => []),
      api.get('/api/execution?status=pending').then(r => r.data.data).catch(() => []),
      api.get('/api/vpn/status').then(r => r.data.data.connected).catch(() => false),
      api.get('/api/health/score').then(r => r.data.data?.score).catch(() => null),
      api.get('/api/audit?limit=500').then(r => r.data.data).catch(() => []),
    ]).then(([connections, pendingExec, vpnConnected, score, auditLogs]) => {
      const connArr = Array.isArray(connections) ? connections : []
      const activeConns = connArr.filter((c: any) => c.isActive)
      const pendingArr = Array.isArray(pendingExec) ? pendingExec : []
      
      setStats({ 
        connections: activeConns.length, 
        totalConnections: connArr.length,
        pendingExec: pendingArr.length, 
        vpnConnected 
      })

      // Calculate health score from real data or use returned score
      if (score !== null && score !== undefined) {
        setHealthScore(score)
      } else {
        // Heuristic: VPN + connections + no pending = good
        let s = 50
        if (vpnConnected) s += 20
        if (activeConns.length > 0) s += 15
        if (pendingArr.length === 0) s += 15
        setHealthScore(Math.min(s, 100))
      }

      // Process audit logs for trends
      if (Array.isArray(auditLogs) && auditLogs.length > 0) {
        const now = Date.now()
        const last12h = auditLogs.filter((l: any) => {
          const t = new Date(l.createdAt).getTime()
          return now - t < 12 * 60 * 60 * 1000
        })
        
        // Split into 12 buckets (1h each)
        const qBuckets = new Array(12).fill(0)
        const eBuckets = new Array(12).fill(0)
        last12h.forEach((l: any) => {
          const hoursAgo = Math.floor((now - new Date(l.createdAt).getTime()) / (60 * 60 * 1000))
          const bucket = Math.min(11, Math.max(0, 11 - hoursAgo))
          if (l.action === 'query_execute' || l.action === 'query') qBuckets[bucket]++
          if (l.action === 'execution_approve' || l.action === 'execution_run' || l.action === 'execute') eBuckets[bucket]++
        })
        setQueryTrend(qBuckets)
        setExecTrend(eBuckets)
        setQueryCount(qBuckets.reduce((a, b) => a + b, 0))
        setExecCount(eBuckets.reduce((a, b) => a + b, 0))
      }
    })
  }, [])

  const quickActions = [
    { label: 'Nova Query', icon: Terminal, to: '/query', desc: 'Executar SQL' },
    { label: 'Explorer', icon: Database, to: '/explorer', desc: 'Catálogo de objetos' },
    { label: 'Comparar', icon: GitCompareArrows, to: '/compare', desc: 'Diff entre bancos' },
    { label: 'Audit Log', icon: Shield, to: '/audit', desc: 'Histórico de ações' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Visão geral do ambiente de bancos de dados monitorados</p>
      </div>

      {/* Top Row: Health + Connections + Pending */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health Score */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Saúde do Ambiente</p>
            <InfoTip text="Indicador calculado com base no status da VPN, conexões ativas, execuções pendentes e métricas coletadas dos bancos (cache hit ratio, locks, queries lentas). Atualizado a cada hora pelo Health Collector." />
          </div>
          <HealthGauge score={healthScore} />
          <div className="flex justify-center gap-4 mt-3">
            <StatusBadge ok={stats.vpnConnected} label="VPN" />
            <StatusBadge ok={stats.connections > 0} label="Conexões" />
            <StatusBadge ok={stats.pendingExec === 0} label="Fila limpa" />
          </div>
        </div>

        {/* Connections Donut */}
        <Link to="/connections" className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition group">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Conexões</p>
            <InfoTip text="Total de conexões de banco de dados cadastradas e ativas no sistema. Inclui todas as instâncias (PostgreSQL, SQL Server, MySQL) acessíveis via VPN. Cada database monitorado conta como uma conexão." />
            <ArrowUpRight className="w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-blue-500 transition ml-auto" />
          </div>
          <StatusDonut active={stats.connections} total={stats.totalConnections} />
          <p className="text-center text-xs text-gray-500 mt-2">{stats.connections} de {stats.totalConnections} conexões ativas</p>
        </Link>

        {/* Executions Pending */}
        <Link to="/executions" className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-amber-300 dark:hover:border-amber-700 transition group">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Execuções Pendentes</p>
            <InfoTip text="Scripts SQL submetidos por DBAs aguardando aprovação de um administrador antes de serem executados nos bancos. Em ambientes DEV com auto-approve, execuções são aplicadas automaticamente." />
            <ArrowUpRight className="w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-amber-500 transition ml-auto" />
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
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Queries (últimas 12h)</p>
            <InfoTip text="Quantidade de consultas SQL executadas manualmente pelo editor de queries nas últimas 12 horas. Cada ponto do gráfico representa 1 hora. Fonte: Audit Log do sistema." />
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-white">{queryCount}</p>
          <Sparkline data={queryTrend} color="#3b82f6" />
        </div>
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Execuções (últimas 12h)</p>
            <InfoTip text="Scripts DDL/DML aprovados e executados nos bancos nas últimas 12 horas (ALTER, CREATE, INSERT, UPDATE, etc). Inclui execuções manuais e auto-aprovadas. Fonte: Audit Log do sistema." />
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-white">{execCount}</p>
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
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{a.label}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}