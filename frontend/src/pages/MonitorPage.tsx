import { useState, useEffect, useRef } from 'react'
import { Activity, Skull, Lock, RefreshCw, Loader2, AlertTriangle, Database, X, Copy, Check, ExternalLink, Cpu, HardDrive, Clock, Users, Zap, ToggleLeft, ToggleRight, Timer } from 'lucide-react'
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
  const [selectedQuery, setSelectedQuery] = useState<ActiveQuery | null>(null)
  const [copied, setCopied] = useState(false)
  const [dbaStats, setDbaStats] = useState<any>({})
  const [enabledPanels, setEnabledPanels] = useState<Set<string>>(new Set(['longQueries', 'waitStats', 'memory', 'idleSessions', 'sessionsByApp']))
  const [showPanelConfig, setShowPanelConfig] = useState(false)
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

      // Fetch DBA stats for first selected connection (server-level metrics)
      if (ids.length > 0 && enabledPanels.size > 0) {
        const panels = [...enabledPanels].join(',')
        api.get(`/api/monitor/${ids[0]}/dba-stats?panels=${panels}`).then(r => setDbaStats(r.data.data)).catch(() => {})
      }
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

  const copyQuery = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openInQueryEditor = (q: ActiveQuery) => {
    // Store query in sessionStorage and navigate to Query page
    sessionStorage.setItem('dba_prefill_query', q.query)
    sessionStorage.setItem('dba_prefill_connId', q.connId || '')
    window.location.href = '/query'
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
                      <td className="py-2 px-3 text-gray-400 font-mono max-w-md truncate cursor-pointer hover:text-white" onClick={() => setSelectedQuery(q)} title="Clique para ver completa">{q.query}</td>
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

      {/* DBA Panels */}
      {selectedConns.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Painéis DBA
            </h2>
            <button onClick={() => setShowPanelConfig(!showPanelConfig)}
              className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1">
              {showPanelConfig ? <ToggleRight className="w-4 h-4 text-blue-400" /> : <ToggleLeft className="w-4 h-4" />}
              Configurar painéis
            </button>
          </div>

          {showPanelConfig && (
            <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg flex flex-wrap gap-2">
              {[
                { id: 'longQueries', label: 'Long Queries', icon: '🐌' },
                { id: 'waitStats', label: 'Wait Stats', icon: '⏳' },
                { id: 'memory', label: 'Memória / PLE', icon: '🧠' },
                { id: 'cpu', label: 'CPU', icon: '💻' },
                { id: 'io', label: 'IO Latency', icon: '💾' },
                { id: 'tempdb', label: 'TempDB', icon: '🗂️' },
                { id: 'idleSessions', label: 'Sessões Ociosas', icon: '😴' },
                { id: 'sessionsByApp', label: 'Sessões por App', icon: '📊' },
                { id: 'topConsumers', label: 'Top Consumers', icon: '🔥' },
                { id: 'deadlocks', label: 'Deadlocks', icon: '💀' },
                { id: 'logUsage', label: 'Log Usage', icon: '📜' },
              ].map(p => {
                const enabled = enabledPanels.has(p.id)
                return (
                  <button key={p.id} onClick={() => setEnabledPanels(prev => {
                    const n = new Set(prev); enabled ? n.delete(p.id) : n.add(p.id); return n
                  })} className={`px-3 py-1.5 rounded-lg text-xs border transition ${enabled ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}>
                    {p.icon} {p.label}
                  </button>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Long Running Queries */}
            {enabledPanels.has('longQueries') && dbaStats.longQueries && (
              <DbaPanel title="🐌 Long Running Queries" subtitle={`>\ 60s (${dbaStats.longQueries.length})`} alert={dbaStats.longQueries.length > 0}>
                {dbaStats.longQueries.length === 0 ? <p className="text-gray-500 text-xs">Nenhuma</p> : (
                  <div className="space-y-1">{dbaStats.longQueries.map((q: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-red-400 font-mono w-12">{q.durationSec}s</span>
                      <span className="text-gray-400">{q.username}</span>
                      <span className="text-gray-500 truncate flex-1 font-mono">{q.query?.slice(0, 80)}</span>
                    </div>
                  ))}</div>
                )}
              </DbaPanel>
            )}

            {/* Wait Stats */}
            {enabledPanels.has('waitStats') && dbaStats.waitStats && (
              <DbaPanel title="⏳ Wait Stats" subtitle="Top waits">
                <div className="space-y-1">{dbaStats.waitStats.slice(0, 8).map((w: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-amber-400 font-mono w-8 text-right">{i + 1}.</span>
                    <span className="text-gray-300 flex-1 font-mono text-[10px]">{w.waitType}</span>
                    <span className="text-gray-500">{Math.round(w.avgWaitMs || 0)}ms avg</span>
                    <span className="text-gray-600">{(w.waitCount || 0).toLocaleString()}x</span>
                  </div>
                ))}</div>
              </DbaPanel>
            )}

            {/* Memory */}
            {enabledPanels.has('memory') && dbaStats.memory?.[0] && (
              <DbaPanel title="🧠 Memória" subtitle="Page Life Expectancy" alert={(dbaStats.memory[0]?.pageLifeExpectancy || 999) < 300}>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className={`text-lg font-bold ${(dbaStats.memory[0]?.pageLifeExpectancy || 0) < 300 ? 'text-red-400' : 'text-green-400'}`}>{dbaStats.memory[0]?.pageLifeExpectancy || 0}</p>
                    <p className="text-[10px] text-gray-500">PLE (seg)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-400">{((dbaStats.memory[0]?.totalServerMemoryKB || 0) / 1048576).toFixed(1)}</p>
                    <p className="text-[10px] text-gray-500">Usado (GB)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-400">{((dbaStats.memory[0]?.targetServerMemoryKB || 0) / 1048576).toFixed(1)}</p>
                    <p className="text-[10px] text-gray-500">Target (GB)</p>
                  </div>
                </div>
              </DbaPanel>
            )}

            {/* CPU */}
            {enabledPanels.has('cpu') && dbaStats.cpu?.[0] && (
              <DbaPanel title="💻 CPU" alert={(dbaStats.cpu[0]?.sqlCpuPercent || 0) > 80}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${(dbaStats.cpu[0]?.sqlCpuPercent || 0) > 80 ? 'text-red-400' : (dbaStats.cpu[0]?.sqlCpuPercent || 0) > 50 ? 'text-amber-400' : 'text-green-400'}`}>{dbaStats.cpu[0]?.sqlCpuPercent || 0}%</p>
                    <p className="text-[10px] text-gray-500">SQL Server CPU</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-400">{dbaStats.cpu[0]?.totalCpuPercent || 0}%</p>
                    <p className="text-[10px] text-gray-500">Total Sistema</p>
                  </div>
                </div>
              </DbaPanel>
            )}

            {/* IO Latency */}
            {enabledPanels.has('io') && dbaStats.io && (
              <DbaPanel title="💾 IO Latency" subtitle="Por arquivo">
                <div className="space-y-1">{(dbaStats.io || []).map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-12 text-right font-mono ${(f.avgReadLatencyMs || 0) > 20 ? 'text-red-400' : 'text-green-400'}`}>{Math.round(f.avgReadLatencyMs || 0)}ms</span>
                    <span className="text-gray-600">R</span>
                    <span className={`w-12 text-right font-mono ${(f.avgWriteLatencyMs || 0) > 20 ? 'text-red-400' : 'text-green-400'}`}>{Math.round(f.avgWriteLatencyMs || 0)}ms</span>
                    <span className="text-gray-600">W</span>
                    <span className="text-[10px] text-gray-500">{f.fileType}</span>
                    <span className="text-[10px] text-gray-600 truncate flex-1">{f.fileName?.split('\\').pop()}</span>
                  </div>
                ))}</div>
              </DbaPanel>
            )}

            {/* TempDB */}
            {enabledPanels.has('tempdb') && dbaStats.tempdb?.[0] && (
              <DbaPanel title="🗂️ TempDB" alert={(dbaStats.tempdb[0]?.freeSpaceMB || 999) < 500}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Total:</span> <span className="text-gray-300 font-mono">{(dbaStats.tempdb[0]?.totalSizeMB || 0).toLocaleString()} MB</span></div>
                  <div><span className="text-gray-500">Livre:</span> <span className={`font-mono ${(dbaStats.tempdb[0]?.freeSpaceMB || 0) < 500 ? 'text-red-400' : 'text-green-400'}`}>{(dbaStats.tempdb[0]?.freeSpaceMB || 0).toLocaleString()} MB</span></div>
                  <div><span className="text-gray-500">User Obj:</span> <span className="text-gray-300 font-mono">{(dbaStats.tempdb[0]?.userObjectsMB || 0).toLocaleString()} MB</span></div>
                  <div><span className="text-gray-500">Version Store:</span> <span className="text-gray-300 font-mono">{(dbaStats.tempdb[0]?.versionStoreMB || 0).toLocaleString()} MB</span></div>
                </div>
              </DbaPanel>
            )}

            {/* Idle Sessions with open transactions */}
            {enabledPanels.has('idleSessions') && dbaStats.idleSessions && (
              <DbaPanel title="😴 Sessões Ociosas c/ Transação" subtitle={`${dbaStats.idleSessions.length} encontradas`} alert={dbaStats.idleSessions.length > 0}>
                {dbaStats.idleSessions.length === 0 ? <p className="text-gray-500 text-xs">Nenhuma</p> : (
                  <div className="space-y-1">{dbaStats.idleSessions.slice(0, 5).map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-amber-400 font-mono w-8">{s.pid}</span>
                      <span className="text-gray-400">{s.username}</span>
                      <span className="text-red-400 font-mono">{s.idleSec}s idle</span>
                      <span className="text-gray-600 truncate flex-1 text-[10px]">{s.appName}</span>
                    </div>
                  ))}</div>
                )}
              </DbaPanel>
            )}

            {/* Sessions by App */}
            {enabledPanels.has('sessionsByApp') && dbaStats.sessionsByApp && (
              <DbaPanel title="📊 Sessões por Aplicação">
                <div className="space-y-1">{(dbaStats.sessionsByApp || []).slice(0, 8).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-blue-400 font-mono w-6 text-right">{s.sessionCount}</span>
                    <span className="text-green-400 font-mono w-4">{s.activeCount}</span>
                    <span className="text-gray-400 truncate flex-1">{s.appName || '(sem nome)'}</span>
                    <span className="text-gray-600 text-[10px]">{Math.round(s.totalCpuMs / 1000)}s CPU</span>
                  </div>
                ))}</div>
              </DbaPanel>
            )}

            {/* Top Consumers */}
            {enabledPanels.has('topConsumers') && dbaStats.topConsumers && (
              <DbaPanel title="🔥 Top Consumers (CPU)">
                <div className="space-y-1">{(dbaStats.topConsumers || []).slice(0, 6).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-5">{i + 1}.</span>
                    <span className="text-gray-300 w-20 truncate">{s.username}</span>
                    <span className="text-amber-400 font-mono">{Math.round(s.cpuMs / 1000)}s</span>
                    <span className="text-gray-600 text-[10px]">{(s.logicalReads || 0).toLocaleString()} reads</span>
                    <span className="text-gray-600 truncate flex-1 text-[10px]">{s.appName}</span>
                  </div>
                ))}</div>
              </DbaPanel>
            )}

            {/* Deadlocks */}
            {enabledPanels.has('deadlocks') && dbaStats.deadlocks && (
              <DbaPanel title="💀 Deadlocks Recentes" alert={dbaStats.deadlocks.length > 0}>
                {dbaStats.deadlocks.length === 0 ? <p className="text-gray-500 text-xs">Nenhum deadlock recente</p> : (
                  <div className="space-y-1">{dbaStats.deadlocks.map((d: any, i: number) => (
                    <div key={i} className="text-xs text-red-400">{d.occurredAt}</div>
                  ))}</div>
                )}
              </DbaPanel>
            )}
          </div>
        </div>
      )}

      {selectedConns.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-600">Selecione um ou mais bancos para monitorar</p>
        </div>
      )}

      {/* Query Detail Modal */}
      {selectedQuery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedQuery(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-green-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Query Detalhada</h3>
                  <p className="text-[10px] text-gray-500">PID {selectedQuery.pid} • {selectedQuery.username} • {selectedQuery.connName} • {formatMs(selectedQuery.durationMs)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copyQuery(selectedQuery.query)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
                <button onClick={() => openInQueryEditor(selectedQuery)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs text-white transition">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir no Editor
                </button>
                <button onClick={() => setSelectedQuery(null)} className="p-1.5 text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <div className="flex mb-3 gap-4 text-xs">
                <span className="text-gray-500">Estado: <span className={`${selectedQuery.state === 'running' ? 'text-green-400' : 'text-gray-300'}`}>{selectedQuery.state}</span></span>
                {selectedQuery.waitEvent && <span className="text-gray-500">Wait: <span className="text-amber-400">{selectedQuery.waitEvent}</span></span>}
              </div>
              <pre className="text-sm text-gray-200 font-mono bg-gray-950 border border-gray-800 rounded-lg p-4 whitespace-pre-wrap break-words leading-relaxed">
                {selectedQuery.query}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DbaPanel({ title, subtitle, alert, children }: { title: string; subtitle?: string; alert?: boolean; children: React.ReactNode }) {
  return (
    <div className={`p-4 bg-gray-900 border rounded-xl ${alert ? 'border-red-900/50' : 'border-gray-800'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-white">{title}</h3>
        {subtitle && <span className="text-[10px] text-gray-500">{subtitle}</span>}
        {alert && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
      </div>
      {children}
    </div>
  )
}
