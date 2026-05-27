import { useState, useEffect, useRef } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2, RefreshCw, Settings2, Database, X, BarChart3, Search, Filter, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react'
import api from '../lib/api'

interface GrowthTable {
  schema: string; table: string; currentRows: number; currentSize: number;
  dailyDelta: number; avgDailyGrowth: number; sparkline: number[]; history: { date: string; rows: number; size: number }[];
}
interface Anomaly { schemaName: string; tableName: string; type: string; severity: string; delta: number; avgDailyGrowth: number; ratio: number; message: string; }
interface Connection { id: string; name: string; dbType: string; databaseName: string; }

type SortCol = 'table' | 'rows' | 'size' | 'delta' | 'avg'
type SortDir = 'asc' | 'desc'

export default function GrowthPage() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [data, setData] = useState<GrowthTable[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshotting, setSnapshotting] = useState(false)
  const [snapProgress, setSnapProgress] = useState<{ pct: number; current: string; done: number; total: number } | null>(null)
  const [lastSnapshotTime, setLastSnapshotTime] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [ruleModal, setRuleModal] = useState<GrowthTable | null>(null)
  const [historyModal, setHistoryModal] = useState<GrowthTable | null>(null)

  // Search & Sort & Filter
  const [globalSearch, setGlobalSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('delta')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [filterInputs, setFilterInputs] = useState<Record<string, string>>({})
  const filterRef = useRef<HTMLDivElement>(null)

  // Close filter on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setActiveFilter(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    setSnapProgress({ pct: 0, current: 'Conectando...', done: 0, total: 0 })
    try {
      const token = localStorage.getItem('dba_token')
      const response = await fetch('/api/growth/snapshot/stream', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok || !response.body) {
        await api.post('/api/growth/snapshot')
      } else {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                if (event.type === 'progress') setSnapProgress({ pct: event.pct, current: event.current, done: event.done, total: event.total })
                else if (event.type === 'start') setSnapProgress({ pct: 0, current: 'Iniciando...', done: 0, total: event.total })
                else if (event.type === 'done') setSnapProgress({ pct: 100, current: t('growth.completed'), done: event.total, total: event.total })
              } catch {}
            }
          }
        }
      }
      const [growthRes, anomalyRes] = await Promise.all([
        api.get(`/api/growth/${selectedConn}`),
        api.get(`/api/growth/${selectedConn}/anomalies`)
      ])
      setData(growthRes.data.data || [])
      setAnomalies(anomalyRes.data.data || [])
      setToast({ message: `Snapshot concluído com sucesso às ${new Date().toLocaleTimeString()}!`, type: 'success' })
    } catch (err: any) {
      setToast({ message: 'Erro ao realizar snapshot: ' + (err?.message || 'desconhecido'), type: 'error' })
    }
    setSnapshotting(false)
    setLastSnapshotTime(new Date().toLocaleTimeString())
    setTimeout(() => { setSnapProgress(null); setToast(null) }, 5000)
  }

  // Filtering & sorting
  const getValue = (t: GrowthTable, col: SortCol): string | number => {
    switch (col) {
      case 'table': return `${t.schema}.${t.table}`
      case 'rows': return t.currentRows
      case 'size': return t.currentSize
      case 'delta': return t.dailyDelta
      case 'avg': return t.avgDailyGrowth
    }
  }

  const processed = data
    .filter(t => {
      const name = `${t.schema}.${t.table}`.toLowerCase()
      if (globalSearch && !name.includes(globalSearch.toLowerCase()) && !t.currentRows.toString().includes(globalSearch)) return false
      for (const [col, val] of Object.entries(filterInputs)) {
        if (!val) continue
        const v = getValue(t, col as SortCol)
        if (typeof v === 'string' && !v.toLowerCase().includes(val.toLowerCase())) return false
        if (typeof v === 'number' && !v.toString().includes(val)) return false
      }
      return true
    })
    .sort((a, b) => {
      const va = getValue(a, sortCol)
      const vb = getValue(b, sortCol)
      if (sortCol === 'delta') return sortDir === 'desc' ? Math.abs(vb as number) - Math.abs(va as number) : Math.abs(va as number) - Math.abs(vb as number)
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const hasActiveFilters = Object.values(filterInputs).some(v => v)
  const totalRows = data.reduce((sum, t) => sum + t.currentRows, 0)

  const columns: { key: SortCol; label: string; align?: string }[] = [
    { key: 'table', label: 'Tabela' },
    { key: 'rows', label: 'Rows Atual', align: 'right' },
    { key: 'size', label: 'Tamanho', align: 'right' },
    { key: 'delta', label: 'Delta (hoje)', align: 'right' },
    { key: 'avg', label: t('growth.avgPerDay'), align: 'right' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-400" /> Crescimento de Tabelas
        </h1>
        <div className="flex items-center gap-3">
          <SearchableSelect
            value={selectedConn}
            onChange={setSelectedConn}
            placeholder="Select connection..."
            options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.databaseName})` }))}
            className="min-w-[200px]"
          />
          <div className="flex items-center gap-2">
            {lastSnapshotTime && !snapshotting && (
              <span className="text-[10px] text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-2 py-1 rounded-full">
                ✓ {lastSnapshotTime}
              </span>
            )}
            <button onClick={triggerSnapshot} disabled={snapshotting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white font-medium rounded-lg transition shadow-lg shadow-blue-900/20">
              {snapshotting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {snapshotting ? 'Capturando...' : 'Snapshot Agora'}
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {snapProgress && (
        <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-900/80 border border-border rounded-xl backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary font-medium">
              {snapProgress.pct < 100
                ? `⏳ Capturando ${snapProgress.done}/${snapProgress.total} databases...`
                : t('growth.snapshotDone')}
            </span>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">{snapProgress.pct}%</span>
          </div>
          <div className="w-full h-2.5 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${snapProgress.pct >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`}
              style={{ width: `${snapProgress.pct}%` }}
            />
          </div>
          {snapProgress.pct < 100 && (
            <p className="text-[11px] text-text-tertiary mt-1.5 font-mono truncate">→ {snapProgress.current}</p>
          )}
        </div>
      )}

      {/* Stats bar */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-border/50 rounded-xl p-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Total Tabelas</p>
            <p className="text-xl font-bold text-text-primary mt-0.5">{data.length}</p>
          </div>
          <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-border/50 rounded-xl p-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Total Rows</p>
            <p className="text-xl font-bold text-text-primary mt-0.5">{totalRows.toLocaleString()}</p>
          </div>
          <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-border/50 rounded-xl p-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Cresceram Hoje</p>
            <p className="text-xl font-bold text-green-400 mt-0.5">{data.filter(t => t.dailyDelta > 0).length}</p>
          </div>
          <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-border/50 rounded-xl p-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Anomalias</p>
            <p className={`text-xl font-bold mt-0.5 ${anomalies.length > 0 ? 'text-red-400' : 'text-text-tertiary'}`}>{anomalies.length}</p>
          </div>
        </div>
      )}

      {/* Anomalies Banner */}
      {anomalies.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl">
          <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {anomalies.length} anomalia{anomalies.length > 1 ? 's' : ''} detectada{anomalies.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-1.5">
            {anomalies.map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm bg-red-950/20 rounded-lg px-3 py-1.5">
                <span>{a.type === 'spike' ? '🔺' : a.type === 'data_loss' ? '⚠️' : '🔻'}</span>
                <span className="font-mono text-text-primary text-xs">{a.schemaName}.{a.tableName}</span>
                <span className="text-text-secondary text-xs">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* First snapshot banner */}
      {data.length > 0 && data.every(t => t.dailyDelta === 0 && t.avgDailyGrowth === 0) && !loading && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-xl flex items-start gap-3">
          <span className="text-xl">📊</span>
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Primeiro snapshot coletado!</p>
            <p className="text-xs text-text-secondary mt-1">
              Os dados de <strong>Delta</strong>, <strong>Média/dia</strong> e <strong>Tendência</strong> aparecerão a partir do próximo snapshot.
              O sistema coleta automaticamente à meia-noite (UTC).
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter bar */}
      {!loading && data.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Pesquisar tabela ou valor..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
            />
            {globalSearch && (
              <button onClick={() => setGlobalSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              {Object.entries(filterInputs).filter(([,v]) => v).map(([col, val]) => (
                <span key={col} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/40 rounded-full text-[11px] text-blue-700 dark:text-blue-300">
                  {columns.find(c => c.key === col)?.label}: <span className="text-text-primary font-medium">"{val}"</span>
                  <button onClick={() => setFilterInputs(f => { const n = {...f}; delete n[col]; return n })} className="hover:text-red-400 transition">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button onClick={() => setFilterInputs({})} className="text-[10px] text-text-tertiary hover:text-red-400 transition underline underline-offset-2">
                Limpar filtros
              </button>
            </div>
          )}
          <span className="text-[11px] text-text-tertiary ml-auto">
            {processed.length === data.length ? `${data.length} tabelas` : `${processed.length} de ${data.length} tabelas`}
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : data.length === 0 ? (
        <div className="p-8 bg-white dark:bg-gray-900/50 border border-border rounded-xl text-center">
          <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-text-secondary">{t('growth.noSnapshots')}</p>
          <p className="text-xs text-gray-600 mt-1">Clique "Snapshot Agora" para coletar o primeiro.</p>
        </div>
      ) : (
        <div className="bg-gray-100/30 dark:bg-gray-900/30 border border-border/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text-tertiary border-b border-border bg-gray-100/50 dark:bg-gray-900/50">
                  {columns.map(col => (
                    <th key={col.key} className={`py-3 px-4 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'} relative select-none`}>
                      <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                        <button
                          onClick={() => handleSort(col.key)}
                          className={`flex items-center gap-1 hover:text-text-primary transition-colors ${sortCol === col.key ? 'text-blue-400' : ''}`}
                        >
                          {col.label}
                          {sortCol === col.key ? (
                            sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveFilter(f => f === col.key ? null : col.key) }}
                          className={`p-0.5 rounded hover:bg-surface-active transition ${filterInputs[col.key] ? 'text-blue-400' : 'text-gray-600 hover:text-text-secondary'}`}
                          title={`Filtrar por ${col.label}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Filter dropdown */}
                      {activeFilter === col.key && (
                        <div ref={filterRef} className="absolute top-full left-0 mt-1 z-50 bg-surface-elevated border border-border rounded-xl shadow-2xl p-3 min-w-[220px] animate-in fade-in slide-in-from-top-1 duration-150"
                          onClick={e => e.stopPropagation()}>
                          <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">Filtrar: {col.label}</p>
                          <input
                            autoFocus
                            type="text"
                            placeholder="Digite para filtrar..."
                            value={filterInputs[col.key] || ''}
                            onChange={e => setFilterInputs(f => ({...f, [col.key]: e.target.value}))}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setActiveFilter(null) }}
                            className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-text-primary placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                          />
                          <div className="flex items-center gap-2 mt-2.5">
                            <button onClick={() => setActiveFilter(null)} className="flex-1 px-3 py-1.5 text-[11px] font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition">
                              Aplicar
                            </button>
                            <button onClick={() => { setFilterInputs(f => { const n = {...f}; delete n[col.key]; return n }); setActiveFilter(null) }}
                              className="flex-1 px-3 py-1.5 text-[11px] font-medium bg-gray-700 hover:bg-gray-600 text-text-secondary rounded-lg transition">
                              Limpar
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-center font-medium">Tendência</th>
                  <th className="py-3 px-4 text-center font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {processed.map((t, i) => {
                  const isAnomaly = anomalies.some(a => a.tableName === t.table && a.schemaName === t.schema)
                  const ratio = t.avgDailyGrowth > 0 ? t.dailyDelta / t.avgDailyGrowth : 0
                  return (
                    <tr key={i} className={`group hover:bg-gray-100/30 dark:hover:bg-gray-800/30 transition-colors ${isAnomaly ? 'bg-red-950/10 hover:bg-red-950/20' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isAnomaly && <span className="text-red-400 text-xs">⚠️</span>}
                          <span className="font-mono text-text-primary text-xs">{t.schema}.<strong>{t.table}</strong></span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-text-secondary">{t.currentRows.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-text-tertiary">{formatBytes(t.currentSize)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-mono font-medium ${
                          t.dailyDelta > 0 ? 'text-green-400' : t.dailyDelta < 0 ? 'text-red-400' : 'text-gray-600'
                        }`}>
                          {t.dailyDelta > 0 ? <TrendingUp className="w-3 h-3" /> : t.dailyDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {t.dailyDelta > 0 ? '+' : ''}{t.dailyDelta.toLocaleString()}
                          {ratio > 3 && <span className="ml-1 text-[9px] bg-red-900/50 text-red-300 px-1 py-0.5 rounded font-bold">{ratio.toFixed(1)}x</span>}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`text-xs ${t.avgDailyGrowth > 0 ? 'text-text-secondary' : t.avgDailyGrowth < 0 ? 'text-red-400/70' : 'text-gray-600'}`}>
                          {t.avgDailyGrowth > 0 ? '+' : ''}{t.avgDailyGrowth.toLocaleString()}/dia
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Sparkline data={t.sparkline} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setHistoryModal(t)} className="p-1.5 text-text-secondary hover:text-green-400 hover:bg-green-900/20 rounded-lg transition" title="Ver histórico">
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setRuleModal(t)} className="p-1.5 text-text-secondary hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition" title="Regras de alerta">
                            <Settings2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {processed.length === 0 && (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-text-tertiary text-sm">{t('growth.noTablesFiltered')}</p>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-sm transition-all ${
          toast.type === 'success' ? 'bg-green-950/90 border-green-800 text-green-200' : 'bg-red-950/90 border-red-800 text-red-200'
        }`}>
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {ruleModal && <RuleModal table={ruleModal} connectionId={selectedConn} onClose={() => setRuleModal(null)} />}
      {historyModal && <HistoryModal table={historyModal} onClose={() => setHistoryModal(null)} />}
    </div>
  )
}

// ─── History Modal ───────────────────────────────────────────────────────────
function HistoryModal({ table, onClose }: { table: GrowthTable; onClose: () => void }) {
  const history = table.history || []
  const maxRows = Math.max(...history.map(h => h.rows), 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-[620px] max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-text-primary font-semibold text-lg">📊 Histórico de Snapshots</h3>
            <p className="text-xs text-text-secondary font-mono mt-0.5">{table.schema}.{table.table}</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-border/30">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Rows Atual</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{table.currentRows.toLocaleString()}</p>
            </div>
            <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-border/30">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Delta Hoje</p>
              <p className={`text-2xl font-bold mt-1 ${table.dailyDelta > 0 ? 'text-green-400' : table.dailyDelta < 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
                {table.dailyDelta > 0 ? '+' : ''}{table.dailyDelta.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-border/30">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Média 7d</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{table.avgDailyGrowth > 0 ? '+' : ''}{table.avgDailyGrowth.toLocaleString()}/dia</p>
            </div>
          </div>
          {history.length > 1 ? (
            <div>
              <p className="text-xs text-text-tertiary mb-3 font-medium">Evolução diária:</p>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                {history.map((h, i) => {
                  const prev = i > 0 ? history[i-1].rows : h.rows
                  const delta = h.rows - prev
                  const pct = (h.rows / maxRows) * 100
                  return (
                    <div key={h.date} className="flex items-center gap-3 text-xs group hover:bg-gray-100/30 dark:hover:bg-gray-800/30 rounded-lg px-2 py-1 transition">
                      <span className="text-text-tertiary font-mono w-16 flex-shrink-0">{h.date.slice(5)}</span>
                      <div className="flex-1 h-6 bg-gray-100/60 dark:bg-gray-800/60 rounded-lg overflow-hidden relative">
                        <div className={`h-full rounded-lg transition-all ${delta >= 0 ? 'bg-blue-600/40' : 'bg-red-600/30'}`} style={{ width: `${pct}%` }} />
                        <span className="absolute inset-0 flex items-center px-2.5 text-[11px] text-text-primary font-mono">
                          {h.rows.toLocaleString()}
                        </span>
                      </div>
                      <span className={`w-20 text-right flex-shrink-0 font-mono font-medium ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                        {i === 0 ? '—' : (delta > 0 ? '+' : '') + delta.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-gray-800/20 rounded-xl border border-border/50">
              <Database className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-text-secondary text-sm">Ainda não há histórico suficiente.</p>
              <p className="text-gray-600 text-xs mt-1">Volte amanhã para ver a comparação entre snapshots.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span className="text-gray-700 text-xs">—</span>
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 72, h = 24
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  const trending = data[data.length - 1] >= data[0]
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={trending ? '#34d399' : '#f87171'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// ─── Rule Modal ──────────────────────────────────────────────────────────────
function RuleModal({ table, connectionId, onClose }: { table: GrowthTable; connectionId: string; onClose: () => void }) {
  const [maxGrowthPct, setMaxGrowthPct] = useState(300)
  const [maxShrinkPct, setMaxShrinkPct] = useState(10)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/api/growth/${connectionId}/rules`, {
        schemaName: table.schema, tableName: table.table,
        maxDailyGrowthPct: maxGrowthPct, maxShrinkPct: maxShrinkPct
      })
      onClose()
    } catch {}
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-text-primary font-semibold">⚙️ Regras de Alerta</h3>
            <p className="text-xs text-text-secondary font-mono mt-0.5">{table.schema}.{table.table}</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1.5">Crescimento máximo (% da média diária)</label>
            <input type="number" value={maxGrowthPct} onChange={e => setMaxGrowthPct(Number(e.target.value))}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-blue-500" />
            <p className="text-[10px] text-gray-600 mt-1">Alerta se crescer mais que {maxGrowthPct}% da média</p>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1.5">Redução máxima (%)</label>
            <input type="number" value={maxShrinkPct} onChange={e => setMaxShrinkPct(Number(e.target.value))}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-blue-500" />
            <p className="text-[10px] text-gray-600 mt-1">Alerta se encolher mais que {maxShrinkPct}%</p>
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm bg-surface-elevated hover:bg-surface-active text-text-secondary rounded-lg transition">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
