import { useState, useEffect } from 'react'
import { Brain, Loader2, Sparkles, AlertTriangle, CheckCircle2, Play, RefreshCw } from 'lucide-react'
import api from '../lib/api'
import ExplainTree from '../components/advisor/ExplainTree'
import AiSuggestionCard from '../components/advisor/AiSuggestionCard'

interface Connection { id: string; name: string; dbType: string; databaseName?: string }

export default function AdvisorPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [autoResults, setAutoResults] = useState<any[]>([])
  const [useAI, setUseAI] = useState(false)
  const [runAnalyze, setRunAnalyze] = useState(false)

  useEffect(() => {
    api.get('/api/connections').then(r => {
      setConnections(r.data.data.filter((c: any) => c.databaseName))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedConn) loadAutoSuggestions()
  }, [selectedConn])

  const loadAutoSuggestions = async () => {
    if (!selectedConn) return
    setAutoLoading(true)
    try {
      const { data } = await api.get(`/api/advisor/${selectedConn}/auto`)
      setAutoResults(data.data || [])
    } catch {}
    setAutoLoading(false)
  }

  const analyzeQuery = async () => {
    if (!selectedConn || !query.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const { data } = await api.post(`/api/advisor/${selectedConn}/analyze`, {
        sql: query,
        analyze: runAnalyze,
        useAI,
      })
      setResult(data.data)
    } catch (err: any) {
      setResult({ error: err.response?.data?.error || err.message })
    }
    setLoading(false)
  }

  const severityIcon = (sev: string) => {
    if (sev === 'critical') return <AlertTriangle className="w-4 h-4 text-red-500" />
    if (sev === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500" />
    return <CheckCircle2 className="w-4 h-4 text-green-500" />
  }

  // Pre-fill from sessionStorage (from Monitor "Otimizar" button)
  useEffect(() => {
    const prefill = sessionStorage.getItem('dba_advisor_query')
    const prefillConn = sessionStorage.getItem('dba_advisor_connId')
    if (prefill) { setQuery(prefill); sessionStorage.removeItem('dba_advisor_query') }
    if (prefillConn) { setSelectedConn(prefillConn); sessionStorage.removeItem('dba_advisor_connId') }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-purple-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Query Advisor</h1>
      </div>

      {/* Connection selector + options */}
      <div className="flex items-center gap-4">
        <select value={selectedConn} onChange={e => setSelectedConn(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:border-purple-500 outline-none">
          <option value="">Selecione uma conexão...</option>
          {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          <input type="checkbox" checked={runAnalyze} onChange={e => setRunAnalyze(e.target.checked)} className="rounded" />
          ANALYZE (executa a query)
        </label>
        <label className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
          <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} className="rounded" />
          <Sparkles className="w-3 h-3" /> Usar IA
        </label>
      </div>

      {/* Manual query input */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Analisar Query</p>
        <textarea
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Cole sua query SQL aqui..."
          className="w-full h-32 px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-200 placeholder-gray-400 resize-none focus:border-purple-500 outline-none"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-gray-500">
            {runAnalyze ? '⚠️ ANALYZE executa a query no banco (READ-ONLY recomendado)' : 'Modo estimado (não executa a query)'}
          </p>
          <button onClick={analyzeQuery} disabled={!selectedConn || !query.trim() || loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Analisar
          </button>
        </div>
      </div>

      {/* Manual analysis result */}
      {result && !result.error && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {severityIcon(result.severity)}
            <p className="text-sm text-gray-700 dark:text-gray-300">{result.summary}</p>
          </div>

          {result.explainPlan?.plan && (
            <ExplainTree plan={result.explainPlan.plan} />
          )}

          {result.optimizedQuery && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-2">✨ Query Otimizada</p>
              <pre className="text-sm font-mono text-green-800 dark:text-green-300 whitespace-pre-wrap">{result.optimizedQuery}</pre>
            </div>
          )}

          {result.suggestions?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sugestões ({result.suggestions.length})</p>
              {result.suggestions.map((s: any, i: number) => <AiSuggestionCard key={i} suggestion={s} />)}
            </div>
          )}
        </div>
      )}

      {result?.error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
        </div>
      )}

      {/* Auto suggestions */}
      {selectedConn && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sugestões Automáticas</h2>
              <span className="text-[10px] text-gray-500">(top queries lentas)</span>
            </div>
            <button onClick={loadAutoSuggestions} className="p-1.5 text-gray-400 hover:text-purple-500 transition">
              <RefreshCw className={`w-4 h-4 ${autoLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {autoLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-500" /></div>}

          {!autoLoading && autoResults.length === 0 && (
            <p className="text-sm text-gray-500 py-4">Nenhum problema detectado nas queries lentas. 👍</p>
          )}

          {!autoLoading && autoResults.map((r, i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
                {severityIcon(r.severity)}
                <pre className="text-[11px] font-mono text-gray-600 dark:text-gray-400 truncate flex-1">{r.originalQuery?.slice(0, 100)}</pre>
                {r.stats && (
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    {r.stats.calls}x • avg {Math.round(r.stats.meanTimeMs)}ms
                  </span>
                )}
              </div>
              <div className="p-3 space-y-2">
                {r.suggestions?.map((s: any, j: number) => <AiSuggestionCard key={j} suggestion={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
