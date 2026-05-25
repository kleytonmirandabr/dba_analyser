import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2, RefreshCw, Settings2, Database } from 'lucide-react'
import api from '../lib/api'

interface GrowthTable {
  schema: string; table: string; currentRows: number; currentSize: number;
  dailyDelta: number; avgDailyGrowth: number; sparkline: number[]; history: { date: string; rows: number; size: number }[];
}
interface Anomaly { schemaName: string; tableName: string; type: string; severity: string; delta: number; avgDailyGrowth: number; ratio: number; message: string; }
interface Connection { id: string; name: string; dbType: string; databaseName: string; }

export default function GrowthPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [data, setData] = useState<GrowthTable[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshotting, setSnapshotting] = useState(false)
  const [ruleModal, setRuleModal] = useState<GrowthTable | null>(null)

  useEffect(() => {
    api.get('/api/connections').then(r => {
      const conns = r.data.data.filter((c: any) => c.databaseName)
      setConnections(conns)
      if (conns.length > 0) setSelectedConn(conns[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedConn) return
    setLoading(true)
    Promise.all([
      api.get(`/api/growth/${selectedConn}`),
      api.get(`/api/growth/${selectedConn}/anomalies`)
    ]).then(([growthRes, anomalyRes]) => {
      setData(growthRes.data.data || [])
      setAnomalies(anomalyRes.data.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [selectedConn])

  const triggerSnapshot = async () => {
    setSnapshotting(true)
    try {
      await api.post('/api/growth/snapshot')
      // Reload data
      const [growthRes, anomalyRes] = await Promise.all([
        api.get(`/api/growth/${selectedConn}`),
        api.get(`/api/growth/${selectedConn}/anomalies`)
      ])
      setData(growthRes.data.data || [])
      setAnomalies(anomalyRes.data.data || [])
    } catch {}
    setSnapshotting(false)
  }

  const anomalyIcon = (type: string) => {
    switch (type) {
      case 'spike': return '🔺'
      case 'stopped': return '🔻'
      case 'data_loss': return '⚠️'
      default: return '📈'
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-400" /> Crescimento de Tabelas
        </h1>
        <div className="flex items-center gap-3">
          <select value={selectedConn} onChange={e => setSelectedConn(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.databaseName})</option>)}
          </select>
          <button onClick={triggerSnapshot} disabled={snapshotting}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition">
            {snapshotting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Snapshot Agora
          </button>
        </div>
      </div>

      {/* Anomalies Banner */}
      {anomalies.length > 0 && (
        <div className="mb-6 p-4 bg-red-900/10 border border-red-900/30 rounded-xl">
          <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {anomalies.length} anomalia{anomalies.length > 1 ? 's' : ''} detectada{anomalies.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {anomalies.map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span>{anomalyIcon(a.type)}</span>
                <span className="font-mono text-white">{a.schemaName}.{a.tableName}</span>
                <span className="text-gray-400">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : data.length === 0 ? (
        <div className="p-8 bg-gray-900 border border-gray-800 rounded-xl text-center">
          <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum snapshot disponível ainda.</p>
          <p className="text-xs text-gray-600 mt-1">O primeiro snapshot é coletado à meia-noite UTC ou clique "Snapshot Agora".</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4">Tabela</th>
                <th className="pb-2 pr-4">Rows Atual</th>
                <th className="pb-2 pr-4">Tamanho</th>
                <th className="pb-2 pr-4">Delta (hoje)</th>
                <th className="pb-2 pr-4">Média/dia (7d)</th>
                <th className="pb-2 pr-4">Tendência</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.sort((a, b) => Math.abs(b.dailyDelta) - Math.abs(a.dailyDelta)).map((t, i) => {
                const isAnomaly = anomalies.some(a => a.tableName === t.table && a.schemaName === t.schema)
                const ratio = t.avgDailyGrowth > 0 ? t.dailyDelta / t.avgDailyGrowth : 0
                return (
                  <tr key={i} className={`border-b border-gray-800/50 hover:bg-gray-900/50 ${isAnomaly ? 'bg-red-900/5' : ''}`}>
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-white">{t.schema}.{t.table}</span>
                      {isAnomaly && <span className="ml-2 text-red-400">⚠️</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{Number(t.currentRows).toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-gray-400">{formatBytes(t.currentSize)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`flex items-center gap-1 ${t.dailyDelta > 0 ? 'text-green-400' : t.dailyDelta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {t.dailyDelta > 0 ? <TrendingUp className="w-3 h-3" /> : t.dailyDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {t.dailyDelta > 0 ? '+' : ''}{t.dailyDelta.toLocaleString()}
                        {ratio > 3 && <span className="ml-1 text-[10px] text-red-400 font-bold">{ratio.toFixed(1)}x</span>}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">
                      {t.avgDailyGrowth > 0 ? '+' : ''}{t.avgDailyGrowth.toLocaleString()}/dia
                    </td>
                    <td className="py-2.5 pr-4">
                      <Sparkline data={t.sparkline} />
                    </td>
                    <td className="py-2.5">
                      <button onClick={() => setRuleModal(t)} className="p-1 text-gray-500 hover:text-blue-400 transition" title="Configurar regras">
                        <Settings2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {ruleModal && <RuleModal table={ruleModal} connectionId={selectedConn} onClose={() => setRuleModal(null)} />}
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span className="text-gray-600 text-xs">—</span>

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 80
  const height = 20

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400" />
    </svg>
  )
}

function RuleModal({ table, connectionId, onClose }: { table: GrowthTable; connectionId: string; onClose: () => void }) {
  const [form, setForm] = useState({
    maxDailyGrowthPct: 300,
    maxDailyGrowthRows: '',
    minDailyGrowthRows: '',
    maxShrinkPct: 10,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(`/api/growth/${connectionId}/rules`).then(r => {
      const rule = r.data.data.find((r: any) => r.tableName === table.table && r.schemaName === table.schema)
      if (rule) {
        setForm({
          maxDailyGrowthPct: rule.maxDailyGrowthPct || 300,
          maxDailyGrowthRows: rule.maxDailyGrowthRows || '',
          minDailyGrowthRows: rule.minDailyGrowthRows || '',
          maxShrinkPct: rule.maxShrinkPct || 10,
        })
      }
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await api.post(`/api/growth/${connectionId}/rules`, {
      schemaName: table.schema,
      tableName: table.table,
      maxDailyGrowthPct: Number(form.maxDailyGrowthPct),
      maxDailyGrowthRows: form.maxDailyGrowthRows ? Number(form.maxDailyGrowthRows) : null,
      minDailyGrowthRows: form.minDailyGrowthRows ? Number(form.minDailyGrowthRows) : null,
      maxShrinkPct: Number(form.maxShrinkPct),
    })
    setSaving(false)
    onClose()
  }

  const inputCls = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
  const labelCls = "block text-xs font-medium text-gray-400 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-white mb-1">Regras de Crescimento</h2>
        <p className="text-xs text-gray-500 mb-4 font-mono">{table.schema}.{table.table}</p>
        <p className="text-xs text-gray-600 mb-4">Média atual: {table.avgDailyGrowth > 0 ? '+' : ''}{table.avgDailyGrowth.toLocaleString()} rows/dia</p>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Alertar se crescer mais que X% vs média 7 dias</label>
            <input type="number" className={inputCls} value={form.maxDailyGrowthPct} onChange={e => setForm(f => ({ ...f, maxDailyGrowthPct: +e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Alertar se crescer mais que N rows/dia (absoluto)</label>
            <input type="number" className={inputCls} value={form.maxDailyGrowthRows} onChange={e => setForm(f => ({ ...f, maxDailyGrowthRows: e.target.value }))} placeholder="Deixe vazio para usar apenas %" />
          </div>
          <div>
            <label className={labelCls}>Alertar se crescer MENOS que N rows/dia</label>
            <input type="number" className={inputCls} value={form.minDailyGrowthRows} onChange={e => setForm(f => ({ ...f, minDailyGrowthRows: e.target.value }))} placeholder="Deixe vazio para não verificar" />
          </div>
          <div>
            <label className={labelCls}>Alertar se encolher mais que X%</label>
            <input type="number" className={inputCls} value={form.maxShrinkPct} onChange={e => setForm(f => ({ ...f, maxShrinkPct: +e.target.value }))} />
          </div>
        </div>

        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-800 rounded-lg transition">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar Regras
          </button>
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}
