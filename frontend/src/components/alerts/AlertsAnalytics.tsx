import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Database, Clock, AlertTriangle, RefreshCw, Calendar } from 'lucide-react'
import api from '../../lib/api'

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899']

export default function AlertsAnalytics() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get(`/api/alerts/analytics?days=${days}`)
      setData(res.data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [days])

  if (loading) return <div className="flex items-center justify-center py-20 text-text-tertiary"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Carregando analytics...</div>
  if (!data) return <div className="text-center py-20 text-text-tertiary">Sem dados</div>

  const { byDay, byConnection, byAlert, heatmap, executionTrend, totalExecutions } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-500" /> Analytics de Alertas</h2>
          <p className="text-xs text-text-tertiary mt-0.5">{totalExecutions} execuções nos últimos {days} dias</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="text-xs px-2 py-1 bg-surface-elevated border border-border rounded-lg text-text-primary">
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
          <button onClick={load} className="p-1.5 text-text-tertiary hover:text-blue-500 border border-border rounded-lg"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Row 1: Alertas por dia + Bancos com mais problemas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-500" /> Alertas por Dia</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ok" stackId="a" fill="#10b981" name="OK" radius={[0,0,0,0]} />
              <Bar dataKey="triggered" stackId="a" fill="#f59e0b" name="Disparados" radius={[0,0,0,0]} />
              <Bar dataKey="error" stackId="a" fill="#ef4444" name="Erro" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5"><Database className="w-4 h-4 text-purple-500" /> Bancos com Mais Problemas</h3>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {byConnection.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-surface rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{c.db || c.name}</p>
                  <p className="text-[10px] text-text-tertiary">{c.db ? c.name : ''}</p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-amber-600 font-bold">{c.triggered}</span>
                  <span className="text-red-500 font-bold">{c.error}</span>
                  <span className="text-green-600">{c.ok}</span>
                </div>
                <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${c.total > 0 ? (c.triggered / c.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {byConnection.length === 0 && <p className="text-xs text-text-tertiary text-center py-4">Sem dados</p>}
          </div>
        </div>
      </div>

      {/* Row 2: Tempo de execução + Ranking de alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5"><Clock className="w-4 h-4 text-green-500" /> Tempo de Execução (tendência)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={executionTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} unit="ms" />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="avgMs" stroke="#6366f1" name="Média (ms)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="maxMs" stroke="#ef4444" name="Máx (ms)" strokeWidth={1} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-500" /> Ranking de Alertas</h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {byAlert.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-surface rounded-lg">
                <span className="text-[10px] font-bold text-text-tertiary w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{a.name}</p>
                  <p className="text-[10px] text-text-tertiary">{a.total} checks • avg {a.avgMs}ms</p>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded font-bold ${a.severity === 'critical' ? 'bg-red-100 text-red-700' : a.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{a.triggered}</span>
                </div>
              </div>
            ))}
            {byAlert.length === 0 && <p className="text-xs text-text-tertiary text-center py-4">Sem dados</p>}
          </div>
        </div>
      </div>

      {/* Row 3: Heatmap */}
      {heatmap.length > 0 && (
        <div className="bg-surface dark:bg-surface-elevated border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">🔥 Heatmap — Horários com Mais Alertas Disparados</h3>
          <div className="overflow-x-auto">
            <div className="grid gap-0.5" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)', minWidth: '600px' }}>
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d, di) => (
                <div key={di} className="contents">
                  <span className="text-[9px] text-text-tertiary pr-1 flex items-center">{d}</span>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = heatmap.find((c: any) => c.dow === di && c.hour === h)
                    const count = cell?.count || 0
                    const maxCount = Math.max(...heatmap.map((c: any) => c.count), 1)
                    const intensity = count / maxCount
                    return (
                      <div key={h} title={`${d} ${h}h: ${count} alertas`}
                        className="w-full aspect-square rounded-sm"
                        style={{ backgroundColor: count === 0 ? 'var(--color-surface, #f3f4f6)' : `rgba(239, 68, 68, ${0.15 + intensity * 0.85})` }}
                      />
                    )
                  })}
                </div>
              ))}
              {/* Hour labels */}
              <div className="contents">
                <span />
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="text-[8px] text-text-tertiary text-center">{h}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
