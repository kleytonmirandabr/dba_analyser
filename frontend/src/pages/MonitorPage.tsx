import { useState, useEffect, useRef } from 'react'
import { Activity, Skull, Lock, RefreshCw, Loader2, AlertTriangle } from 'lucide-react'
import api from '../lib/api'

interface Connection { id: string; name: string; environment: string; }
interface ActiveQuery { pid: number; username: string; database: string; state: string; query: string; durationMs: number; waitEvent?: string; }
interface LockInfo { blockedPid: number; blockedQuery: string; blockingPid: number; blockingQuery: string; lockType: string; durationMs?: number; }

export default function MonitorPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [queries, setQueries] = useState<ActiveQuery[]>([])
  const [locks, setLocks] = useState<LockInfo[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef<any>(null)

  useEffect(() => {
    api.get('/api/connections').then(r => setConnections(r.data.data)).catch(() => {})
  }, [])

  const refresh = async (connId?: string) => {
    const id = connId || selectedConn
    if (!id) return
    setLoading(true)
    try {
      const [q, l, s] = await Promise.all([
        api.get(`/api/monitor/${id}/queries`),
        api.get(`/api/monitor/${id}/locks`),
        api.get(`/api/monitor/${id}/stats`),
      ])
      setQueries(q.data.data)
      setLocks(l.data.data)
      setStats(s.data.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (selectedConn && autoRefresh) {
      refresh()
      intervalRef.current = setInterval(() => refresh(), 5000)
      return () => clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [selectedConn, autoRefresh])

  const killQuery = async (pid: number) => {
    if (!confirm(`Tem certeza que deseja matar o processo PID ${pid}?`)) return
    await api.post(`/api/monitor/${selectedConn}/kill/${pid}`)
    refresh()
  }

  const formatMs = (ms: number) => ms > 60000 ? `${(ms / 60000).toFixed(1)}min` : ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
  const formatBytes = (b: number) => b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Monitor</h1>
        <div className="flex items-center gap-3">
          <select className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
            value={selectedConn} onChange={e => { setSelectedConn(e.target.value); refresh(e.target.value) }}>
            <option value="">Selecione conexão</option>
            {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto (5s)
          </label>
          <button onClick={() => refresh()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Tamanho DB', value: formatBytes(stats.databaseSize), color: 'blue' },
            { label: 'Conexões Ativas', value: stats.activeConnections, color: 'green' },
            { label: 'Total Conexões', value: stats.totalConnections, color: 'amber' },
            { label: 'Cache Hit', value: `${stats.cacheHitRatio}%`, color: 'purple' },
          ].map((s, i) => (
            <div key={i} className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 text-${s.color}-400`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active queries */}
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
                <th className="text-left py-2 px-3 text-gray-500">PID</th>
                <th className="text-left py-2 px-3 text-gray-500">User</th>
                <th className="text-left py-2 px-3 text-gray-500">Estado</th>
                <th className="text-left py-2 px-3 text-gray-500">Duração</th>
                <th className="text-left py-2 px-3 text-gray-500">Query</th>
                <th className="py-2 px-3"></th>
              </tr></thead>
              <tbody>
                {queries.map(q => (
                  <tr key={q.pid} className={`border-b border-gray-900 ${q.durationMs > 30000 ? 'bg-red-900/10' : ''}`}>
                    <td className="py-2 px-3 text-gray-300 font-mono">{q.pid}</td>
                    <td className="py-2 px-3 text-gray-400">{q.username}</td>
                    <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${q.state === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>{q.state}</span></td>
                    <td className={`py-2 px-3 font-mono ${q.durationMs > 10000 ? 'text-red-400' : 'text-gray-300'}`}>{formatMs(q.durationMs)}</td>
                    <td className="py-2 px-3 text-gray-400 font-mono max-w-md truncate">{q.query}</td>
                    <td className="py-2 px-3">
                      <button onClick={() => killQuery(q.pid)} className="p-1 text-gray-600 hover:text-red-400" title="Kill">
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
                <th className="text-left py-2 px-3 text-gray-500">Bloqueado (PID)</th>
                <th className="text-left py-2 px-3 text-gray-500">Bloqueando (PID)</th>
                <th className="text-left py-2 px-3 text-gray-500">Tipo</th>
                <th className="text-left py-2 px-3 text-gray-500">Duração</th>
                <th className="text-left py-2 px-3 text-gray-500">Query Bloqueada</th>
              </tr></thead>
              <tbody>
                {locks.map((l, i) => (
                  <tr key={i} className="border-b border-gray-900">
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

      {!selectedConn && (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-600">Selecione uma conexão para monitorar</p>
        </div>
      )}
    </div>
  )
}
