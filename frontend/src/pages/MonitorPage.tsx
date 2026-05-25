import { useState, useEffect, useRef } from 'react'
import { Activity, Skull, Lock, RefreshCw, Loader2, AlertTriangle, Database, X } from 'lucide-react'
import api from '../lib/api'

interface Connection { id: string; name: string; environment: string; databaseName?: string; }
interface ActiveQuery { pid: number; username: string; database: string; state: string; query: string; durationMs: number; waitEvent?: string; connId?: string; connName?: string; }
interface LockInfo { blockedPid: number; blockedQuery: string; blockingPid: number; blockingQuery: string; lockType: string; durationMs?: number; connName?: string; }
interface ConnStats { connId: string; connName: string; databaseSize: number; activeConnections: number; totalConnections: number; cacheHitRatio: number; }

export default function MonitorPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConns, setSelectedConns] = useState<string[]>([])
  const [queries, setQueries] = useState<ActiveQuery[]>([])
  const [locks, setLocks] = useState<LockInfo[]>([])
  const [allStats, setAllStats] = useState<ConnStats[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef<any>(null)

  useEffect(() => {
    api.get('/api/connections').then(r => {
      const conns = r.data.data.filter((c: any) => c.databaseName)
      setConnections(conns)
    }).catch(() => {})
  }, [])

  const toggleConn = (id: string) => {
    setSelectedConns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const selectAll = () => setSelectedConns(connections.map(c => c.id))
  const clearAll = () => { setSelectedConns([]); setQueries([]); setLocks([]); setAllStats([]) }

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

  const killQuery = async (connId: string, pid: number) => {
    if (!confirm(`Tem certeza que deseja matar o processo PID ${pid}?`)) return
    await api.post(`/api/monitor/${connId}/kill/${pid}`)
    refresh()
  }

  const formatMs = (ms: number) => ms > 60000 ? `${(ms / 60000).toFixed(1)}min` : ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
  const formatBytes = (b: number) => b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`

  const totalSize = allStats.reduce((a, s) => a + (s.databaseSize || 0), 0)
  const totalActive = allStats.reduce((a, s) => a + (s.activeConnections || 0), 0)
  const totalConns = allStats.reduce((a, s) => a + (s.totalConnections || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Monitor</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto (5s)
          </label>
          <button onClick={() => refresh()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Multi-select connections */}
      <div className="p-3 bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-gray-500 uppercase font-medium">Bancos monitorados ({selectedConns.length}/{connections.length})</p>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] text-blue-400 hover:text-blue-300">Selecionar todos</button>
            <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-gray-300">Limpar</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {connections.map(c => {
            const selected = selectedConns.includes(c.id)
            return (
              <button key={c.id} onClick={() => toggleConn(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition border ${selected ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                <Database className="w-3 h-3" />
                {c.name}
                {selected && <X className="w-3 h-3 ml-1" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Aggregated stats */}
      {allStats.length > 0 && (
        <div>
          {allStats.length > 1 && (
            <div className="grid grid-cols-4 gap-4 mb-3">
              {[
                { label: 'Tamanho Total', value: formatBytes(totalSize), color: 'text-blue-400' },
                { label: 'Conexões Ativas (total)', value: totalActive, color: 'text-green-400' },
                { label: 'Total Conexões', value: totalConns, color: 'text-amber-400' },
                { label: 'Bancos', value: allStats.length, color: 'text-purple-400' },
              ].map((s, i) => (
                <div key={i} className="p-3 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
          <div className={`grid gap-3 ${allStats.length === 1 ? 'grid-cols-4' : allStats.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {allStats.map(s => (
              <div key={s.connId} className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
                <p className="text-[10px] text-gray-500 truncate mb-1">{s.connName}</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-blue-400">{formatBytes(s.databaseSize)}</span>
                  <span className="text-[10px] text-green-400">{s.activeConnections} ativas</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active queries */}
      {selectedConns.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-semibold text-white">Queries Ativas ({queries.length})</h2>
          </div>
          {queries.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Nenhuma query ativa</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-800">
                  {selectedConns.length > 1 && <th className="text-left py-2 px-3 text-gray-500">Banco</th>}
                  <th className="text-left py-2 px-3 text-gray-500">PID</th>
                  <th className="text-left py-2 px-3 text-gray-500">User</th>
                  <th className="text-left py-2 px-3 text-gray-500">Estado</th>
                  <th className="text-left py-2 px-3 text-gray-500">Duração</th>
                  <th className="text-left py-2 px-3 text-gray-500">Query</th>
                  <th className="py-2 px-3"></th>
                </tr></thead>
                <tbody>
                  {queries.sort((a, b) => b.durationMs - a.durationMs).map((q, i) => (
                    <tr key={`${q.connId}-${q.pid}-${i}`} className={`border-b border-gray-900 ${q.durationMs > 30000 ? 'bg-red-900/10' : ''}`}>
                      {selectedConns.length > 1 && <td className="py-2 px-3 text-purple-400 text-[10px]">{q.connName}</td>}
                      <td className="py-2 px-3 text-gray-300 font-mono">{q.pid}</td>
                      <td className="py-2 px-3 text-gray-400">{q.username}</td>
                      <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${q.state === 'active' || q.state === 'running' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>{q.state}</span></td>
                      <td className={`py-2 px-3 font-mono ${q.durationMs > 10000 ? 'text-red-400' : 'text-gray-300'}`}>{formatMs(q.durationMs)}</td>
                      <td className="py-2 px-3 text-gray-400 font-mono max-w-md truncate">{q.query}</td>
                      <td className="py-2 px-3">
                        <button onClick={() => killQuery(q.connId!, q.pid)} className="p-1 text-gray-600 hover:text-red-400" title="Kill">
                          <Skull className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Locks */}
      {locks.length > 0 && (
        <div className="bg-gray-900 border border-red-900/30 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-white">Locks Detectados ({locks.length})</h2>
            <AlertTriangle className="w-4 h-4 text-amber-400 ml-auto" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-800">
                {selectedConns.length > 1 && <th className="text-left py-2 px-3 text-gray-500">Banco</th>}
                <th className="text-left py-2 px-3 text-gray-500">Bloqueado (PID)</th>
                <th className="text-left py-2 px-3 text-gray-500">Bloqueando (PID)</th>
                <th className="text-left py-2 px-3 text-gray-500">Tipo</th>
                <th className="text-left py-2 px-3 text-gray-500">Duração</th>
                <th className="text-left py-2 px-3 text-gray-500">Query Bloqueada</th>
              </tr></thead>
              <tbody>
                {locks.map((l, i) => (
                  <tr key={i} className="border-b border-gray-900">
                    {selectedConns.length > 1 && <td className="py-2 px-3 text-purple-400 text-[10px]">{l.connName}</td>}
                    <td className="py-2 px-3 text-red-400 font-mono">{l.blockedPid}</td>
                    <td className="py-2 px-3 text-amber-400 font-mono">{l.blockingPid}</td>
                    <td className="py-2 px-3 text-gray-400">{l.lockType}</td>
                    <td className="py-2 px-3 text-gray-300">{l.durationMs ? formatMs(l.durationMs) : '-'}</td>
                    <td className="py-2 px-3 text-gray-400 font-mono max-w-sm truncate">{l.blockedQuery}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedConns.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-600">Selecione um ou mais bancos para monitorar</p>
        </div>
      )}
    </div>
  )
}
