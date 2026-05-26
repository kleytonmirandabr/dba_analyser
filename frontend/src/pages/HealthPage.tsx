import { useState, useEffect } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Activity, Database, Search, Gauge, Settings, AlertTriangle, CheckCircle2, XCircle, Loader2, Clock, HardDrive, Zap, TrendingUp, Trash2 } from 'lucide-react'
import api from '../lib/api'

type Tab = 'overview' | 'tables' | 'queries' | 'indexes' | 'config'

interface Connection { id: string; name: string; dbType: string; environment: string; databaseName: string; }

export default function HealthPage() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState<string>('')
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/connections').then(({ data }) => {
      setConnections(data.data)
      if (data.data.length > 0) setSelectedConn(data.data[0].id)
      setLoading(false)
    })
  }, [])

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: t('health.overview'), icon: Gauge },
    { id: 'tables', label: 'Tabelas', icon: Database },
    { id: 'queries', label: 'Queries Lentas', icon: Clock },
    { id: 'indexes', label: t('health.indexes'), icon: Search },
    { id: 'config', label: t('health.configuration'), icon: Settings },
  ]

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><Activity className="w-6 h-6 text-green-400" /> Health Monitor</h1>
        <SearchableSelect
          value={selectedConn}
          onChange={setSelectedConn}
          placeholder="Select connection..."
          options={connections.map(c => ({ value: c.id, label: `${c.name} ${c.databaseName ? '(' + c.databaseName + ')' : ''}` }))}
          className="min-w-[200px]"
        />
      </div>

      <div className="flex gap-1 mb-6 bg-surface p-1 rounded-lg border border-border">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-text-secondary hover:text-white hover:bg-surface-elevated'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {selectedConn && (
        <>
          {activeTab === 'overview' && <OverviewTab connId={selectedConn} />}
          {activeTab === 'tables' && <TablesTab connId={selectedConn} />}
          {activeTab === 'queries' && <QueriesTab connId={selectedConn} />}
          {activeTab === 'indexes' && <IndexesTab connId={selectedConn} />}
          {activeTab === 'config' && <ConfigTab connId={selectedConn} />}
        </>
      )}
    </div>
  )
}

function OverviewTab({ connId }: { connId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true); setError('')
    api.get(`/api/connections/${connId}/health/overview`)
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false))
  }, [connId])

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto mt-10" />
  if (error) return <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
  if (!data) return null

  const cards = [
    { label: 'Tabelas', value: data.totalTables, icon: Database, color: 'blue' },
    { label: 'Tamanho Total', value: formatBytes(data.totalSizeBytes), icon: HardDrive, color: 'purple' },
    { label: 'Cache Hit', value: (data.cacheHitRatio * 100).toFixed(1) + '%', icon: Zap, color: data.cacheHitRatio > 0.95 ? 'green' : 'yellow' },
    { label: t('health.connections'), value: `${data.activeConnections}/${data.maxConnections}`, icon: Activity, color: 'blue' },
    { label: 'Tabelas Inchadas', value: data.bloatedTables, icon: AlertTriangle, color: data.bloatedTables > 0 ? 'red' : 'green' },
    { label: t('health.unusedIndexes'), value: data.unusedIndexes, icon: Trash2, color: data.unusedIndexes > 5 ? 'yellow' : 'green' },
    { label: t('health.longTransactions'), value: data.longTransactions, icon: Clock, color: data.longTransactions > 0 ? 'red' : 'green' },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
    yellow: 'bg-yellow-900/30 border-yellow-800 text-yellow-400',
    red: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400',
  }

  return (
    <div>
      <div className="mb-4 p-3 bg-surface border border-border rounded-lg">
        <p className="text-xs text-text-tertiary">Versão</p>
        <p className="text-sm text-text-primary font-mono">{data.version}</p>
        {data.uptime && <p className="text-xs text-text-tertiary mt-1">Uptime: {data.uptime}</p>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`p-4 rounded-xl border ${colorMap[card.color]}`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-4 h-4" />
              <span className="text-xs opacity-80">{card.label}</span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TablesTab({ connId }: { connId: string }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/connections/${connId}/health/tables`).then(r => setData(r.data.data)).finally(() => setLoading(false))
  }, [connId])

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto mt-10" />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-text-tertiary border-b border-border">
            <th className="pb-2 pr-4">Tabela</th>
            <th className="pb-2 pr-4">Tamanho</th>
            <th className="pb-2 pr-4">Linhas</th>
            <th className="pb-2 pr-4">Dead Tuples</th>
            <th className="pb-2 pr-4">Bloat %</th>
            <th className="pb-2 pr-4">Último Vacuum</th>
            <th className="pb-2 pr-4">Seq Scans</th>
            <th className="pb-2">Idx Scans</th>
          </tr>
        </thead>
        <tbody>
          {data.map((t, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-gray-100/50 dark:bg-gray-900/50">
              <td className="py-2 pr-4 font-mono text-text-primary">{t.schema}.{t.name}</td>
              <td className="py-2 pr-4 text-text-secondary">{formatBytes(t.sizeBytes)}</td>
              <td className="py-2 pr-4 text-text-secondary">{Number(t.rowEstimate).toLocaleString()}</td>
              <td className="py-2 pr-4">
                <span className={`${t.deadTuples > 10000 ? 'text-red-400' : t.deadTuples > 1000 ? 'text-yellow-400' : 'text-text-secondary'}`}>
                  {Number(t.deadTuples).toLocaleString()}
                </span>
              </td>
              <td className="py-2 pr-4">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  t.bloatRatio > 0.3 ? 'bg-red-900/30 text-red-400' : t.bloatRatio > 0.1 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400'
                }`}>
                  {(t.bloatRatio * 100).toFixed(1)}%
                </span>
              </td>
              <td className="py-2 pr-4 text-xs text-text-tertiary">{t.lastVacuum ? new Date(t.lastVacuum).toLocaleDateString() : t.lastAutoVacuum ? new Date(t.lastAutoVacuum).toLocaleDateString() : '—'}</td>
              <td className="py-2 pr-4 text-text-secondary">{Number(t.seqScans).toLocaleString()}</td>
              <td className="py-2 text-text-secondary">{Number(t.idxScans).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <p className="text-center text-text-tertiary py-8">{t('health.noTables')}</p>}
    </div>
  )
}

function QueriesTab({ connId }: { connId: string }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true); setError('')
    api.get(`/api/connections/${connId}/health/slow-queries`)
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.error || t('health.pgStatNotEnabled')))
      .finally(() => setLoading(false))
  }, [connId])

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto mt-10" />
  if (error) return (
    <div className="p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg text-yellow-400 text-sm">
      <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
      <p className="mt-2 text-xs text-text-tertiary">Para habilitar: adicione <code className="bg-surface-elevated px-1 rounded">shared_preload_libraries = 'pg_stat_statements'</code> no postgresql.conf</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {data.map((q, i) => (
        <div key={i} className="p-4 bg-surface border border-border rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap flex-1 max-h-20 overflow-hidden">{q.query}</pre>
            <div className="flex gap-4 shrink-0 text-right">
              <div>
                <p className="text-xs text-text-tertiary">Tempo Total</p>
                <p className="text-sm font-bold text-red-400">{formatMs(q.totalTimeMs)}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Média</p>
                <p className="text-sm font-bold text-yellow-400">{formatMs(q.meanTimeMs)}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Chamadas</p>
                <p className="text-sm font-bold text-blue-400">{Number(q.calls).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-center text-text-tertiary py-8">{t('health.noSlowQueries')}</p>}
    </div>
  )
}

function IndexesTab({ connId }: { connId: string }) {
  const [unused, setUnused] = useState<any[]>([])
  const [missing, setMissing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/connections/${connId}/health/indexes`).then(r => {
      setUnused(r.data.data.unused || [])
      setMissing(r.data.data.missing || [])
    }).finally(() => setLoading(false))
  }, [connId])

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto mt-10" />

  return (
    <div className="space-y-8">
      {/* Unused Indexes */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-400" /> Índices Sem Uso ({unused.length})
        </h3>
        {unused.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-tertiary border-b border-border">
                  <th className="pb-2 pr-4">Tabela</th>
                  <th className="pb-2 pr-4">Índice</th>
                  <th className="pb-2 pr-4">Tamanho</th>
                  <th className="pb-2">Scans</th>
                </tr>
              </thead>
              <tbody>
                {unused.map((idx, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-text-secondary">{idx.schema}.{idx.table}</td>
                    <td className="py-2 pr-4 font-mono text-red-300">{idx.indexName}</td>
                    <td className="py-2 pr-4 text-text-secondary">{formatBytes(idx.indexSizeBytes)}</td>
                    <td className="py-2 text-red-400 font-bold">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-text-tertiary text-sm">{t('health.noUnusedIndexes')}</p>}
      </div>

      {/* Missing Indexes */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" /> Sugestões de Índices ({missing.length})
        </h3>
        {missing.length > 0 ? (
          <div className="space-y-2">
            {missing.map((m, i) => (
              <div key={i} className="p-3 bg-green-900/10 border border-green-900/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-text-primary">{m.schema}.{m.table}</span>
                  <span className="text-xs text-green-400">{m.estimatedImpact || `${Number(m.seqScans).toLocaleString()} seq scans`}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{m.reason}</p>
                {m.suggestedColumns && <p className="text-xs text-green-300 mt-1 font-mono">Colunas sugeridas: {m.suggestedColumns}</p>}
              </div>
            ))}
          </div>
        ) : <p className="text-text-tertiary text-sm">{t('health.noIndexSuggestions')}</p>}
      </div>
    </div>
  )
}

function ConfigTab({ connId }: { connId: string }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/connections/${connId}/health/config`).then(r => setData(r.data.data)).finally(() => setLoading(false))
  }, [connId])

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto mt-10" />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-text-tertiary border-b border-border">
            <th className="pb-2 pr-4">Parâmetro</th>
            <th className="pb-2 pr-4">Valor Atual</th>
            <th className="pb-2 pr-4">Unidade</th>
            <th className="pb-2 pr-4">Categoria</th>
            <th className="pb-2">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {data.map((param, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-gray-100/50 dark:bg-gray-900/50">
              <td className="py-2 pr-4 font-mono text-text-primary text-xs">{param.name}</td>
              <td className="py-2 pr-4 font-mono text-blue-300">{param.currentValue}</td>
              <td className="py-2 pr-4 text-text-tertiary text-xs">{param.unit || '—'}</td>
              <td className="py-2 pr-4 text-text-tertiary text-xs">{param.category}</td>
              <td className="py-2 text-text-tertiary text-xs truncate max-w-xs">{param.description || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Utility functions
function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatMs(ms: number): string {
  if (!ms) return '0ms'
  if (ms < 1000) return ms.toFixed(0) + 'ms'
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's'
  if (ms < 3600000) return (ms / 60000).toFixed(1) + 'min'
  return (ms / 3600000).toFixed(1) + 'h'
}
