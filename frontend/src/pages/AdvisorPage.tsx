import { useState, useEffect } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Brain, Loader2, Sparkles, AlertTriangle, CheckCircle2, Play, RefreshCw } from 'lucide-react'
import api from '../lib/api'
import ExplainTree from '../components/advisor/ExplainTree'
import AiSuggestionCard from '../components/advisor/AiSuggestionCard'

interface Connection { id: string; name: string; dbType: string; databaseName?: string }

export default function AdvisorPage() {
  const { t } = useTranslation()
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
        <h1 className="text-2xl font-bold text-text-primary">AI Query Advisor</h1>
      </div>

      {/* Connection selector + options */}
      <div className="flex items-center gap-4">
        <SearchableSelect
          value={selectedConn}
          onChange={setSelectedConn}
          placeholder={t('connections.search')}
          options={connections.map(c => ({ value: c.id, label: c.name }))}
          className="min-w-[200px]"
        />
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={runAnalyze} onChange={e => setRunAnalyze(e.target.checked)} className="rounded" />
          ANALYZE (executa a query)
        </label>
        <label className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
          <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} className="rounded" />
          <Sparkles className="w-3 h-3" /> Usar IA
        </label>
      </div>

      {/* Manual query input */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide mb-2">Analisar Query</p>
        <textarea
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Cole sua query SQL aqui..."
          className="w-full h-32 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-text-primary placeholder-gray-400 resize-none focus:border-purple-500 outline-none"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-text-tertiary">
            {runAnalyze ? t('advisor.runAnalyze') : t('advisor.estimatedMode')}
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
            <p className="text-sm text-text-secondary">{result.summary}</p>
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
              <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Sugestões ({result.suggestions.length})</p>
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
              <h2 className="text-sm font-semibold text-text-primary">Sugestões Automáticas</h2>
              <span className="text-[10px] text-text-tertiary">(top queries lentas)</span>
            </div>
            <button onClick={loadAutoSuggestions} className="p-1.5 text-text-secondary hover:text-purple-500 transition">
              <RefreshCw className={`w-4 h-4 ${autoLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {autoLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-purple-500" /></div>}

          {!autoLoading && autoResults.length === 0 && (
            <p className="text-sm text-text-tertiary py-4">{t('advisor.noIssues')}</p>
          )}

          {!autoLoading && autoResults.map((r, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden">
              <div className="p-3 bg-surface-elevated/50 border-b border-border flex items-center gap-2">
                {severityIcon(r.severity)}
                <pre className="text-[11px] font-mono text-text-secondary truncate flex-1">{r.originalQuery?.slice(0, 100)}</pre>
                {r.stats && (
                  <span className="text-[10px] text-text-tertiary whitespace-nowrap">
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
