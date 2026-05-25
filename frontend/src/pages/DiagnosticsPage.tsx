import { useState, useEffect } from 'react'
import { Stethoscope, Play, Loader2, AlertTriangle, AlertCircle, Info, Database, ChevronDown, ChevronRight, Copy, Check, TrendingUp } from 'lucide-react'
import api from '../lib/api'

interface Connection { id: string; name: string; dbType: string; environment: string; databaseName: string }
interface Diagnostic {
  severity: 'critical' | 'warning' | 'info'
  category: string; symptom: string; cause: string; action: string
  sql?: string; impact: number; metric?: string; value?: number; threshold?: number
}
interface Report { score: number; diagnostics: Diagnostic[]; metrics: Record<string, any>; collectedAt: string }

export default function DiagnosticsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConns, setSelectedConns] = useState<string[]>([])
  const [reports, setReports] = useState<Record<string, Report>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/api/diagnostics/connections').then(r => setConnections(r.data.data.filter((c: Connection) => c.databaseName))).catch(() => {})
  }, [])

  const toggleConn = (id: string) => setSelectedConns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  const selectAll = () => setSelectedConns(connections.map(c => c.id))

  const analyze = async (connId: string) => {
    setLoading(l => ({ ...l, [connId]: true }))
    try {
      const { data } = await api.post(`/api/diagnostics/${connId}/analyze`)
      setReports(r => ({ ...r, [connId]: data.data }))
    } catch {}
    setLoading(l => ({ ...l, [connId]: false }))
  }

  const analyzeAll = async () => {
    for (const id of selectedConns) {
      await analyze(id)
    }
  }

  const filtered = connections.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'border-green-500/30 bg-green-950/20'
    if (score >= 60) return 'border-yellow-500/30 bg-yellow-950/20'
    return 'border-red-500/30 bg-red-950/20'
  }

  const getSevIcon = (sev: string) => {
    if (sev === 'critical') return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
    if (sev === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
    return <Info className="w-4 h-4 text-blue-400 shrink-0" />
  }

  const getSevBg = (sev: string) => {
    if (sev === 'critical') return 'border-red-800/50 bg-red-950/20'
    if (sev === 'warning') return 'border-yellow-800/50 bg-yellow-950/20'
    return 'border-blue-800/50 bg-blue-950/20'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-emerald-400" /> Diagnóstico
        </h1>
        {selectedConns.length > 0 && (
          <button onClick={analyzeAll} disabled={Object.values(loading).some(Boolean)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition">
            {Object.values(loading).some(Boolean) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Analisar {selectedConns.length} banco(s)
          </button>
        )}
      </div>

      {/* Connection selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 hover:opacity-80">
            {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-white">{selectedConns.length} de {connections.length} bancos selecionados</span>
          </button>
          <button onClick={selectAll} className="text-[10px] text-emerald-400 hover:text-emerald-300">Todos</button>
        </div>
        {expanded && (
          <div className="px-4 pb-3 border-t border-gray-800 pt-3">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar banco..." className="w-full px-3 py-1.5 mb-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-600 focus:border-emerald-500 outline-none" />
            <div className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto">
              {filtered.map(c => {
                const sel = selectedConns.includes(c.id)
                const report = reports[c.id]
                return (
                  <button key={c.id} onClick={() => toggleConn(c.id)}
                    className={`px-2 py-1 rounded text-[10px] truncate border transition relative ${sel ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}>
                    {c.name.replace('Minetrack / ', '').replace('SQL / ', '')}
                    {report && <span className={`absolute -top-1 -right-1 text-[8px] font-bold px-1 rounded ${report.score >= 85 ? 'bg-green-500' : report.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'} text-black`}>{report.score}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {selectedConns.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione bancos acima e clique <strong>"Analisar"</strong> para receber diagnóstico e recomendações</p>
        </div>
      )}

      {selectedConns.map(connId => {
        const conn = connections.find(c => c.id === connId)
        const report = reports[connId]
        const isLoading = loading[connId]
        if (!conn) return null

        return (
          <div key={connId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-white">{conn.name}</span>
                <span className="text-[10px] text-gray-500">{conn.dbType}</span>
              </div>
              <div className="flex items-center gap-3">
                {report && (
                  <div className={`px-3 py-1 rounded-lg border ${getScoreBg(report.score)}`}>
                    <span className={`text-lg font-bold ${getScoreColor(report.score)}`}>{report.score}</span>
                    <span className="text-[10px] text-gray-500 ml-1">/100</span>
                  </div>
                )}
                <button onClick={() => analyze(connId)} disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 border border-emerald-600 text-emerald-400 text-xs rounded-lg hover:bg-emerald-600/30 disabled:opacity-50 transition">
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {isLoading ? 'Analisando...' : 'Analisar'}
                </button>
              </div>
            </div>

            {isLoading && (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span className="ml-2 text-sm text-gray-400">Coletando métricas e analisando...</span>
              </div>
            )}

            {report && !isLoading && (
              <div className="p-4 space-y-3">
                {/* Metrics summary */}
                <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                  {report.metrics.ple != null && <MetricChip label="PLE" value={report.metrics.ple + 's'} warn={report.metrics.ple < 700} crit={report.metrics.ple < 300} />}
                  {report.metrics.cpuSql != null && <MetricChip label="CPU" value={report.metrics.cpuSql + '%'} warn={report.metrics.cpuSql > 70} crit={report.metrics.cpuSql > 85} />}
                  {report.metrics.ioReadMs != null && <MetricChip label="IO Read" value={report.metrics.ioReadMs + 'ms'} warn={report.metrics.ioReadMs > 20} crit={report.metrics.ioReadMs > 50} />}
                  {report.metrics.tempdbFreePct != null && <MetricChip label="TempDB" value={report.metrics.tempdbFreePct + '% free'} warn={report.metrics.tempdbFreePct < 25} crit={report.metrics.tempdbFreePct < 10} />}
                  {report.metrics.totalSessions != null && <MetricChip label="Sessões" value={String(report.metrics.totalSessions)} />}
                  {report.metrics.logUsagePct != null && <MetricChip label="Log" value={report.metrics.logUsagePct + '%'} warn={report.metrics.logUsagePct > 70} crit={report.metrics.logUsagePct > 90} />}
                  {report.metrics.missingIndexes != null && <MetricChip label="Missing Idx" value={String(report.metrics.missingIndexes)} warn={report.metrics.missingIndexes > 3} crit={report.metrics.missingIndexes > 10} />}
                  {report.metrics.maxdop != null && <MetricChip label="MAXDOP" value={String(report.metrics.maxdop)} />}
                </div>

                {/* Diagnostics */}
                {report.diagnostics.length === 0 ? (
                  <div className="p-4 text-center text-green-400 text-sm">✅ Nenhum problema detectado — banco saudável!</div>
                ) : (
                  <div className="space-y-2">
                    {report.diagnostics.map((d, i) => (
                      <DiagnosticCard key={i} diagnostic={d} index={i} />
                    ))}
                  </div>
                )}

                {/* Missing index details */}
                {report.metrics.missingIndexDetails && (
                  <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                    <p className="text-[10px] text-gray-500 uppercase mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Top índices sugeridos</p>
                    <div className="space-y-1">
                      {report.metrics.missingIndexDetails.map((idx: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400 truncate flex-1">{idx.table}</span>
                          <span className="text-yellow-400 font-mono ml-2">impact: {idx.impact}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MetricChip({ label, value, warn, crit }: { label: string; value: string; warn?: boolean; crit?: boolean }) {
  const color = crit ? 'text-red-400 border-red-800/50' : warn ? 'text-yellow-400 border-yellow-800/50' : 'text-gray-300 border-gray-800'
  return (
    <div className={`p-2 rounded border bg-gray-800/30 ${color}`}>
      <p className="text-[9px] text-gray-500">{label}</p>
      <p className={`text-xs font-bold ${crit ? 'text-red-400' : warn ? 'text-yellow-400' : 'text-gray-200'}`}>{value}</p>
    </div>
  )
}

function DiagnosticCard({ diagnostic: d, index }: { diagnostic: Diagnostic; index: number }) {
  const [showSql, setShowSql] = useState(false)
  const [copied, setCopied] = useState(false)

  const getSevIcon = (sev: string) => {
    if (sev === 'critical') return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
    if (sev === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
    return <Info className="w-4 h-4 text-blue-400 shrink-0" />
  }

  const getSevBg = (sev: string) => {
    if (sev === 'critical') return 'border-red-800/50 bg-red-950/20'
    if (sev === 'warning') return 'border-yellow-800/50 bg-yellow-950/20'
    return 'border-blue-800/50 bg-blue-950/20'
  }

  const copy = () => { navigator.clipboard.writeText(d.sql || ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className={`p-3 rounded-lg border ${getSevBg(d.severity)}`}>
      <div className="flex items-start gap-2">
        {getSevIcon(d.severity)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-gray-500 uppercase font-medium">{d.category}</span>
            <span className="text-[9px] text-gray-600">Prioridade {index + 1}</span>
          </div>
          <p className="text-xs text-white font-medium mb-1">{d.symptom}</p>
          <p className="text-[11px] text-gray-400 mb-1"><strong className="text-gray-300">Causa:</strong> {d.cause}</p>
          <p className="text-[11px] text-emerald-400"><strong className="text-emerald-300">Ação:</strong> {d.action}</p>
          {d.sql && (
            <div className="mt-2">
              <button onClick={() => setShowSql(!showSql)} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                {showSql ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Ver SQL
              </button>
              {showSql && (
                <div className="mt-1 relative">
                  <pre className="p-2 bg-gray-900 rounded text-[10px] text-gray-300 overflow-x-auto font-mono">{d.sql}</pre>
                  <button onClick={copy} className="absolute top-1 right-1 p-1 bg-gray-800 rounded hover:bg-gray-700">
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
