import { useState, useEffect, useRef } from 'react'
import { Activity, Skull, Lock, RefreshCw, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import DbSelector from '../components/monitor/DbSelector'
import StatsOverview from '../components/monitor/StatsOverview'
import DbaPanels from '../components/monitor/DbaPanels'
import QueryDetailModal from '../components/monitor/QueryDetailModal'

interface Connection { id: string; name: string; environment: string; databaseName?: string }
interface ActiveQuery { pid: number; username: string; database: string; state: string; query: string; durationMs: number; waitEvent?: string; connId?: string; connName?: string }
interface LockInfo { blockedPid: number; blockedQuery: string; blockingPid: number; blockingQuery: string; lockType: string; durationMs?: number; connName?: string }
interface ConnStats { connId: string; connName: string; databaseSize: number; activeConnections: number; totalConnections: number; cacheHitRatio: number }

export default function MonitorPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConns, setSelectedConns] = useState<string[]>([])
  const [queries, setQueries] = useState<ActiveQuery[]>([])
  const [locks, setLocks] = useState<LockInfo[]>([])
  const [allStats, setAllStats] = useState<ConnStats[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedQuery, setSelectedQuery] = useState<ActiveQuery | null>(null)
  const [dbaStats, setDbaStats] = useState<any>({})
  const [queriesCollapsed, setQueriesCollapsed] = useState(false)
  const [queryFilter, setQueryFilter] = useState('')
  const [enabledPanels, setEnabledPanels] = useState<Set<string>>(new Set(['longQueries', 'waitStats', 'memory', 'idleSessions', 'sessionsByApp']))
  const intervalRef = useRef<any>(null)
  const dbaIntervalRef = useRef<any>(null)

  useEffect(() => {
    api.get('/api/connections').then(r => {
      setConnections(r.data.data.filter((c: any) => c.databaseName))
    }).catch(() => {})
  }, [])

  const refresh = async (connIds?: string[]) => {
    const ids = connIds || selectedConns
    if (ids.length === 0) return
    setLoading(true)
    try {
      const results = await Promise.all(ids.map(async (id) => {
        const conn = connections.find(c => c.id === id)
        const name = conn?.name || id
        const [q, l, s] = await Promise.all([
          api.get(`/api/monitor/${id}/queries`).catch(() => ({ data: { data: [] } })),
          api.get(`/api/monitor/${id}/locks`).catch(() => ({ data: { data: [] } })),
          api.get(`/api/monitor/${id}/stats`).catch(() => ({ data: { data: null } })),
        ])
        return {
          connId: id, connName: name,
          queries: (q.data.data || []).map((qq: any) => ({ ...qq, connId: id, connName: name })),
          locks: (l.data.data || []).map((ll: any) => ({ ...ll, connName: name })),
          stats: s.data.data ? { connId: id, connName: name, ...s.data.data } : null,
        }
      }))
      setQueries(results.flatMap(r => r.queries))
      setLocks(results.flatMap(r => r.locks))
      setAllStats(results.filter(r => r.stats).map(r => r.stats!) as ConnStats[])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (selectedConns.length > 0 && autoRefresh) {
      refresh()
      intervalRef.current = setInterval(() => refresh(), 5000)
      return () => clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [selectedConns, autoRefresh])

  useEffect(() => {
    if (selectedConns.length > 0 && !autoRefresh) refresh()
  }, [selectedConns])

  const fetchDbaStats = () => {
    if (selectedConns.length === 0 || enabledPanels.size === 0) return
    api.get(`/api/monitor/${selectedConns[0]}/dba-stats?panels=all`)
      .then(r => setDbaStats(r.data.data)).catch(() => {})
  }

  useEffect(() => {
    if (selectedConns.length > 0 && enabledPanels.size > 0) {
      fetchDbaStats()
      dbaIntervalRef.current = setInterval(fetchDbaStats, 10000)
      return () => clearInterval(dbaIntervalRef.current)
    }
    return () => clearInterval(dbaIntervalRef.current)
  }, [selectedConns.length > 0, enabledPanels])

  useEffect(() => {
    if (selectedConns.length > 0 && enabledPanels.size > 0) fetchDbaStats()
  }, [enabledPanels])

  const killQuery = async (connId: string, pid: number) => {
    if (!confirm(`Tem certeza que deseja matar o processo PID ${pid}?`)) return
    await api.post(`/api/monitor/${connId}/kill/${pid}`)
    refresh()
  }

  const formatMs = (ms: number) => ms > 60000 ? `${(ms / 60000).toFixed(1)}min` : ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
  const formatBytes = (b: number) => b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`

  const filteredQueries = queries.filter(q => {
    if (!queryFilter) return true
    const f = queryFilter.toLowerCase()
    return (q.query || '').toLowerCase().includes(f) || (q.username || '').toLowerCase().includes(f) || (q.connName || '').toLowerCase().includes(f) || String(q.pid).includes(f)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monitor</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto (5s)
          </label>
          <button onClick={() => refresh()} className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition">
            <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <DbSelector connections={connections} selectedConns={selectedConns} setSelectedConns={setSelectedConns} />

      {allStats.length > 0 && <StatsOverview allStats={allStats} formatBytes={formatBytes} />}

      {/* Active queries */}
      {selectedConns.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <button onClick={() => setQueriesCollapsed(!queriesCollapsed)} className="flex items-center gap-2 hover:opacity-80 transition">
              {queriesCollapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              <Activity className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Queries Ativas ({queries.length})</h2>
            </button>
            {!queriesCollapsed && (
              <input type="text" value={queryFilter} onChange={e => setQueryFilter(e.target.value)}
                placeholder="Filtrar por query, user, banco..."
                className="ml-auto px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white w-64 placeholder-gray-400 dark:placeholder-gray-600 focus:border-blue-500 outline-none" />
            )}
          </div>
          {!queriesCollapsed && (filteredQueries.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">{queryFilter ? `Nenhuma query com "${queryFilter}"` : 'Nenhuma query ativa'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-200 dark:border-gray-800">
                  {selectedConns.length > 1 && <th className="text-left py-2 px-3 text-gray-500">Banco</th>}
                  <th className="text-left py-2 px-3 text-gray-500">PID</th>
                  <th className="text-left py-2 px-3 text-gray-500">User</th>
                  <th className="text-left py-2 px-3 text-gray-500">Estado</th>
                  <th className="text-left py-2 px-3 text-gray-500">Duração</th>
                  <th className="text-left py-2 px-3 text-gray-500">Query</th>
                  <th className="py-2 px-3"></th>
                </tr></thead>
                <tbody>
                  {filteredQueries.sort((a, b) => b.durationMs - a.durationMs).map((q, i) => (
                    <tr key={`${q.connId}-${q.pid}-${i}`} className={`border-b border-gray-100 dark:border-gray-900 ${q.durationMs > 30000 ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                      {selectedConns.length > 1 && <td className="py-2 px-3 text-purple-500 dark:text-purple-400 text-[10px]">{q.connName}</td>}
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300 font-mono">{q.pid}</td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{q.username}</td>
                      <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${q.state === 'active' || q.state === 'running' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>{q.state}</span></td>
                      <td className={`py-2 px-3 font-mono ${q.durationMs > 10000 ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{formatMs(q.durationMs)}</td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400 font-mono max-w-md truncate cursor-pointer hover:text-gray-900 dark:hover:text-white" onClick={() => setSelectedQuery(q)} title="Clique para ver completa">{q.query}</td>
                      <td className="py-2 px-3">
                        <button onClick={() => killQuery(q.connId!, q.pid)} className="p-1 text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400" title="Kill">
                          <Skull className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Locks */}
      {locks.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/30 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Locks Detectados ({locks.length})</h2>
            <AlertTriangle className="w-4 h-4 text-amber-400 ml-auto" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-200 dark:border-gray-800">
                {selectedConns.length > 1 && <th className="text-left py-2 px-3 text-gray-500">Banco</th>}
                <th className="text-left py-2 px-3 text-gray-500">Bloqueado (PID)</th>
                <th className="text-left py-2 px-3 text-gray-500">Bloqueando (PID)</th>
                <th className="text-left py-2 px-3 text-gray-500">Tipo</th>
                <th className="text-left py-2 px-3 text-gray-500">Duração</th>
                <th className="text-left py-2 px-3 text-gray-500">Query Bloqueada</th>
              </tr></thead>
              <tbody>
                {locks.map((l, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-900">
                    {selectedConns.length > 1 && <td className="py-2 px-3 text-purple-500 dark:text-purple-400 text-[10px]">{l.connName}</td>}
                    <td className="py-2 px-3 text-red-500 dark:text-red-400 font-mono">{l.blockedPid}</td>
                    <td className="py-2 px-3 text-amber-500 dark:text-amber-400 font-mono">{l.blockingPid}</td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{l.lockType}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{l.durationMs ? formatMs(l.durationMs) : '-'}</td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400 font-mono max-w-sm truncate">{l.blockedQuery}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DBA Panels */}
      {selectedConns.length > 0 && (
        <DbaPanels dbaStats={dbaStats} enabledPanels={enabledPanels} setEnabledPanels={setEnabledPanels} />
      )}

      {selectedConns.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500 dark:text-gray-600">Selecione um ou mais bancos para monitorar</p>
        </div>
      )}

      {/* Query Detail Modal */}
      {selectedQuery && <QueryDetailModal query={selectedQuery} onClose={() => setSelectedQuery(null)} formatMs={formatMs} />}
    </div>
  )
}
