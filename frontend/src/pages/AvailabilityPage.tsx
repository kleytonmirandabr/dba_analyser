import { useState, useEffect } from 'react'
import { Activity, RefreshCw, Clock, Server, TrendingUp, AlertTriangle, CheckCircle, Timer } from 'lucide-react'
import api from '../lib/api'

interface ConnAvailability {
  connId: string
  connName: string
  databaseName: string
  totalChecks: number
  okChecks: number
  triggeredChecks: number
  errorChecks: number
  availability: number // percentage
  monitoringSince: string // first check timestamp
  monitoringHours: number
  currentStatus: 'ok' | 'triggered' | 'error' | 'unknown'
  currentStreakMinutes: number // how long in current state
  currentStreakStart: string
  lastCheckAt: string
  // Timeline: array of hourly statuses for visual bar
  timeline: { hour: string; status: 'ok' | 'triggered' | 'error' | 'mixed' }[]
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return minutes + 'min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return h + 'h' + (m > 0 ? ' ' + m + 'min' : '')
  const d = Math.floor(h / 24)
  const rh = h % 24
  return d + 'd ' + rh + 'h'
}

function formatHours(hours: number): string {
  if (hours < 24) return Math.round(hours) + 'h'
  const d = Math.floor(hours / 24)
  const h = Math.round(hours % 24)
  return d + 'd ' + h + 'h'
}

export default function AvailabilityPage() {
  const [data, setData] = useState<ConnAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(24) // hours
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = async () => {
    try {
      const { data: res } = await api.get(`/api/alerts/availability?hours=${period}`)
      setData(res.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [period])
  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(load, 30000) // 30s refresh
    return () => clearInterval(iv)
  }, [autoRefresh, period])

  const totalAvg = data.length > 0 ? (data.reduce((s, d) => s + d.availability, 0) / data.length) : 100
  const downCount = data.filter(d => d.currentStatus === 'triggered' || d.currentStatus === 'error').length
  const upCount = data.filter(d => d.currentStatus === 'ok').length

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Activity className="w-6 h-6 text-green-500" /> Disponibilidade
          </h1>
          <p className="text-xs text-text-tertiary mt-0.5">Monitoramento de uptime por banco de dados</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(Number(e.target.value))} className="text-xs px-3 py-1.5 bg-surface-elevated border border-border rounded-lg text-text-primary">
            <option value={1}>Última 1h</option>
            <option value={6}>Últimas 6h</option>
            <option value={12}>Últimas 12h</option>
            <option value={24}>Últimas 24h</option>
            <option value={72}>Últimos 3 dias</option>
            <option value={168}>Última semana</option>
            <option value={720}>Último mês</option>
          </select>
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-lg border transition ${autoRefresh ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-border text-text-tertiary'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {autoRefresh ? '30s' : 'Auto'}
          </button>
          <button onClick={load} className="p-1.5 text-text-tertiary hover:text-blue-500 border border-border rounded-lg"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4">
          <p className="text-[10px] text-text-tertiary uppercase font-medium">Disponibilidade Geral</p>
          <p className={`text-3xl font-bold mt-1 ${totalAvg >= 99 ? 'text-green-600' : totalAvg >= 95 ? 'text-amber-600' : 'text-red-600'}`}>{totalAvg.toFixed(1)}%</p>
        </div>
        <div className="bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4">
          <p className="text-[10px] text-text-tertiary uppercase font-medium">Bancos Monitorados</p>
          <p className="text-3xl font-bold mt-1 text-text-primary">{data.length}</p>
        </div>
        <div className="bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4">
          <p className="text-[10px] text-text-tertiary uppercase font-medium">Online Agora</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{upCount}</p>
        </div>
        <div className="bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4">
          <p className="text-[10px] text-text-tertiary uppercase font-medium">Com Problema</p>
          <p className={`text-3xl font-bold mt-1 ${downCount > 0 ? 'text-red-600' : 'text-text-primary'}`}>{downCount}</p>
        </div>
      </div>

      {/* Availability table */}
      {loading ? (
        <div className="text-center py-16 text-text-tertiary"><RefreshCw className="w-5 h-5 animate-spin inline mr-2" /> Carregando...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-xl">
          <Activity className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">Nenhum dado de disponibilidade</p>
          <p className="text-xs text-text-tertiary mt-1">Configure alertas do tipo "Deve retornar linhas" para monitorar bancos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.sort((a, b) => a.availability - b.availability).map(item => (
            <div key={item.connId} className="bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4 hover:shadow-md transition">
              <div className="flex items-center gap-4">
                {/* Status dot + name */}
                <div className="flex items-center gap-3 w-64 min-w-0">
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    item.currentStatus === 'ok' ? 'bg-green-500' :
                    item.currentStatus === 'triggered' ? 'bg-amber-500 animate-pulse' :
                    'bg-red-500 animate-pulse'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{item.databaseName || item.connName}</p>
                    <p className="text-[10px] text-text-tertiary">{item.connName}</p>
                  </div>
                </div>

                {/* Availability percentage */}
                <div className="w-24 text-center">
                  <p className={`text-lg font-bold ${
                    item.availability >= 99 ? 'text-green-600 dark:text-green-400' :
                    item.availability >= 95 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>{item.availability.toFixed(1)}%</p>
                  <p className="text-[9px] text-text-tertiary">disponível</p>
                </div>

                {/* Timeline bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex gap-px h-6 rounded overflow-hidden">
                    {item.timeline.map((t, i) => (
                      <div key={i} title={`${t.hour}: ${t.status === 'ok' ? 'OK' : t.status === 'triggered' ? 'Problema' : 'Erro'}`}
                        className={`flex-1 ${
                          t.status === 'ok' ? 'bg-green-400 dark:bg-green-600' :
                          t.status === 'triggered' ? 'bg-amber-400 dark:bg-amber-500' :
                          t.status === 'error' ? 'bg-red-400 dark:bg-red-500' :
                          'bg-amber-300 dark:bg-amber-600'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[8px] text-text-tertiary">{formatHours(item.monitoringHours)} atrás</span>
                    <span className="text-[8px] text-text-tertiary">agora</span>
                  </div>
                </div>

                {/* Current streak */}
                <div className="w-36 text-right">
                  <div className={`flex items-center justify-end gap-1 ${
                    item.currentStatus === 'ok' ? 'text-green-600 dark:text-green-400' :
                    'text-amber-600 dark:text-amber-400'
                  }`}>
                    {item.currentStatus === 'ok' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    <span className="text-xs font-bold">{item.currentStatus === 'ok' ? 'Online' : 'Offline'}</span>
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-0.5">
                    <Timer className="w-2.5 h-2.5 inline mr-0.5" />
                    há {formatDuration(item.currentStreakMinutes)}
                  </p>
                </div>

                {/* Stats */}
                <div className="w-28 text-right text-[10px] text-text-tertiary">
                  <p>Monitorando: {formatHours(item.monitoringHours)}</p>
                  <p>{item.totalChecks} checks</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-text-tertiary">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Online</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> Problema (triggered)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Erro</span>
        <span className="ml-auto">Auto-refresh: 30s | Dados baseados nos alertas configurados</span>
      </div>
    </div>
  )
}
