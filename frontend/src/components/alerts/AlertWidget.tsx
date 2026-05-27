import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, X, TrendingUp, BarChart3, Activity, Gauge, Hash } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadialBarChart, RadialBar, PieChart, Pie, Cell } from 'recharts'

export type ChartType = 'area' | 'line' | 'bar' | 'gauge' | 'stat'
export type TimePeriod = '1h' | '6h' | '24h' | '7d' | '30d'

export interface WidgetConfig {
  chartType: ChartType
  period: TimePeriod
  showLegend: boolean
}

interface AlertWidgetProps {
  id: string
  name: string
  severity: string
  currentStatus: string
  connectionName: string
  databaseName: string
  lastCheckedAt: string
  stats: { totalChecks: number; triggeredCount: number; errorCount: number; okCount: number; avgExecutionMs: number }
  timeline: { time: string; ok: number; triggered: number; error: number }[]
  lastValues: { time: string; value: number | null; status: string }[]
  config: WidgetConfig
  onConfigChange: (id: string, config: WidgetConfig) => void
  compact?: boolean
}

const CHART_TYPES: { value: ChartType; label: string; icon: any }[] = [
  { value: 'area', label: 'Área', icon: Activity },
  { value: 'line', label: 'Linha', icon: TrendingUp },
  { value: 'bar', label: 'Barras', icon: BarChart3 },
  { value: 'gauge', label: 'Gauge', icon: Gauge },
  { value: 'stat', label: 'Estatísticas', icon: Hash },
]

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

const STATUS_COLORS = {
  ok: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400' },
  triggered: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400' },
  error: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400' },
  pending: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', dot: 'bg-gray-400' },
}

export default function AlertWidget({ id, name, severity, currentStatus, connectionName, databaseName, lastCheckedAt, stats, timeline, lastValues, config, onConfigChange, compact }: AlertWidgetProps) {
  const { t } = useTranslation()
  const [showSettings, setShowSettings] = useState(false)
  const colors = STATUS_COLORS[currentStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending

  const renderChart = () => {
    const data = timeline.length > 1 ? timeline : []
    if (data.length < 2 && config.chartType !== 'stat' && config.chartType !== 'gauge') {
      return <div className="h-full flex items-center justify-center text-text-tertiary text-xs"><Activity className="w-4 h-4 mr-2" />Coletando dados...</div>
    }

    switch (config.chartType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} tickFormatter={t => t.slice(11, 16)} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} width={30} />
              <Tooltip contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '11px' }} />
              <Area type="monotone" dataKey="ok" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.3} />
              <Area type="monotone" dataKey="triggered" stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.3} />
              <Area type="monotone" dataKey="error" stackId="1" stroke="#f87171" fill="#f87171" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        )
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lastValues.length > 2 ? lastValues : data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} tickFormatter={t => {
                const d = new Date(t); return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0')
              }} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} width={30} />
              <Tooltip contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '11px' }} />
              {lastValues.length > 2 
                ? <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} dot={false} />
                : <>
                    <Line type="monotone" dataKey="ok" stroke="#34d399" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="triggered" stroke="#fbbf24" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="error" stroke="#f87171" strokeWidth={1.5} dot={false} />
                  </>
              }
            </LineChart>
          </ResponsiveContainer>
        )
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} tickFormatter={t => t.slice(11, 16)} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} width={30} />
              <Tooltip contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '11px' }} />
              <Bar dataKey="ok" stackId="1" fill="#34d399" radius={[2, 2, 0, 0]} />
              <Bar dataKey="triggered" stackId="1" fill="#fbbf24" radius={[2, 2, 0, 0]} />
              <Bar dataKey="error" stackId="1" fill="#f87171" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'gauge': {
        const total = stats.totalChecks || 1
        const okPct = Math.round((stats.okCount / total) * 100)
        const gaugeData = [{ name: 'OK', value: okPct, fill: '#34d399' }]
        return (
          <div className="h-full flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={compact ? 80 : 100}>
              <RadialBarChart cx="50%" cy="100%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} barSize={10} data={gaugeData}>
                <RadialBar background={{ fill: 'var(--color-surface)' }} dataKey="value" cornerRadius={5} />
              </RadialBarChart>
            </ResponsiveContainer>
            <p className="text-2xl font-bold text-green-400 -mt-4">{okPct}%</p>
            <p className="text-[10px] text-text-tertiary">Disponibilidade</p>
          </div>
        )
      }
      case 'stat':
        return (
          <div className="h-full grid grid-cols-2 gap-2 p-2">
            <div className="flex flex-col items-center justify-center bg-green-500/5 rounded-lg border border-green-500/20 p-2">
              <p className="text-xl font-bold text-green-400">{stats.okCount}</p>
              <p className="text-[9px] text-text-tertiary uppercase">OK</p>
            </div>
            <div className="flex flex-col items-center justify-center bg-amber-500/5 rounded-lg border border-amber-500/20 p-2">
              <p className="text-xl font-bold text-amber-400">{stats.triggeredCount}</p>
              <p className="text-[9px] text-text-tertiary uppercase">Alertas</p>
            </div>
            <div className="flex flex-col items-center justify-center bg-red-500/5 rounded-lg border border-red-500/20 p-2">
              <p className="text-xl font-bold text-red-400">{stats.errorCount}</p>
              <p className="text-[9px] text-text-tertiary uppercase">Erros</p>
            </div>
            <div className="flex flex-col items-center justify-center bg-blue-500/5 rounded-lg border border-blue-500/20 p-2">
              <p className="text-xl font-bold text-blue-400">{stats.avgExecutionMs}ms</p>
              <p className="text-[9px] text-text-tertiary uppercase">Média</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className={`h-full flex flex-col bg-surface border ${colors.border} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-surface-elevated/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full ${colors.dot} animate-pulse`} />
          <span className="text-xs font-semibold text-text-primary truncate">{name}</span>
          <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase ${
            severity === 'critical' ? 'bg-red-900/40 text-red-400' :
            severity === 'warning' ? 'bg-amber-900/40 text-amber-400' :
            'bg-blue-900/40 text-blue-400'
          }`}>{severity}</span>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-1 text-text-tertiary hover:text-text-primary rounded transition">
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-3 py-2 border-b border-border/50 bg-surface-elevated/30 space-y-2">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-text-tertiary w-12">Gráfico:</span>
            <div className="flex gap-0.5">
              {CHART_TYPES.map(ct => (
                <button key={ct.value} onClick={() => onConfigChange(id, { ...config, chartType: ct.value })}
                  className={`p-1 rounded text-[9px] flex items-center gap-0.5 ${config.chartType === ct.value ? 'bg-blue-600 text-white' : 'text-text-tertiary hover:bg-surface-elevated'}`}
                  title={ct.label}>
                  <ct.icon className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-text-tertiary w-12">Período:</span>
            <div className="flex gap-0.5">
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => onConfigChange(id, { ...config, period: p.value })}
                  className={`px-1.5 py-0.5 rounded text-[9px] ${config.period === p.value ? 'bg-blue-600 text-white' : 'text-text-tertiary hover:bg-surface-elevated'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart area */}
      <div className="flex-1 min-h-0 p-2">
        {renderChart()}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border/50 flex items-center justify-between text-[9px] text-text-tertiary">
        <span>{connectionName}</span>
        <span>{lastCheckedAt ? new Date(lastCheckedAt).toLocaleTimeString().slice(0, 5) : '—'}</span>
      </div>
    </div>
  )
}
