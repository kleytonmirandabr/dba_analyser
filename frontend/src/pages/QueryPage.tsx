import { useState, useEffect } from 'react'
import { Play, Download, Clock, AlertCircle, Database, Loader2, FileText } from 'lucide-react'
import api from '../lib/api'
import SqlEditor from '../components/editor/SqlEditor'

interface Connection { id: string; name: string; environment: string; mode: string; }

export default function QueryPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [sql, setSql] = useState('SELECT 1;')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{ sql: string; time: string; duration: number }[]>([])
  const [completions, setCompletions] = useState<{ tables: { name: string; columns: string[] }[] } | undefined>(undefined)

  useEffect(() => {
    api.get('/api/connections').then(r => {
      setConnections(r.data.data)
      // Check for prefill from Monitor
      const prefillConn = sessionStorage.getItem('dba_prefill_connId')
      if (prefillConn) {
        setSelectedConn(prefillConn)
        sessionStorage.removeItem('dba_prefill_connId')
      }
    }).catch(() => {})
    const prefillConn2 = sessionStorage.getItem('dba_prefill_connId') || ''
    if (prefillConn2) {
      api.get(`/api/explorer/${prefillConn2}/completions?schema=public`).then(r => setCompletions(r.data.data)).catch(() => {})
    }
    const prefillQuery = sessionStorage.getItem('dba_prefill_query')
    if (prefillQuery) {
      setSql(prefillQuery)
      sessionStorage.removeItem('dba_prefill_query')
    }
  }, [])

  useEffect(() => {
    if (!selectedConn) { setCompletions(undefined); return }
    api.get(`/api/explorer/${selectedConn}/completions?schema=public`).then(r => setCompletions(r.data.data)).catch(() => {})
  }, [selectedConn])

  const execute = async () => {
    if (!selectedConn || !sql.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data } = await api.post(`/api/query/${selectedConn}/execute`, { sql, limit: 500 })
      if (data.data.success) {
        setResult(data.data)
        setHistory(h => [{ sql: sql.trim(), time: new Date().toLocaleTimeString(), duration: data.data.durationMs }, ...h.slice(0, 19)])
      } else {
        setError(data.data.error || 'Erro desconhecido')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    }
    setLoading(false)
  }

  const exportCSV = () => {
    if (!result?.rows?.length) return
    const headers = Object.keys(result.rows[0])
    const csv = [headers.join(','), ...result.rows.map((r: any) => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'query_result.csv'; a.click()
  }

  const connMode = connections.find(c => c.id === selectedConn)?.mode

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-800 bg-gray-900">
        <select className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
          value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
          <option value="">Conexão...</option>
          {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.environment})</option>)}
        </select>
        {connMode && <span className={`text-[10px] px-2 py-0.5 rounded border ${connMode === 'readonly' ? 'bg-amber-900/20 text-amber-400 border-amber-800' : 'bg-green-900/20 text-green-400 border-green-800'}`}>{connMode}</span>}
        <button onClick={execute} disabled={loading || !selectedConn}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Executar
        </button>
        <span className="text-[10px] text-gray-600">Ctrl+Enter</span>
        <div className="ml-auto flex items-center gap-2">
          {result && <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg">
            <Download className="w-3 h-3" /> CSV
          </button>}
          {result && <span className="text-xs text-gray-500"><Clock className="w-3 h-3 inline mr-1" />{result.durationMs}ms | {result.rows?.length || 0} rows</span>}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-1/3 min-h-[120px] border-b border-gray-800">
          <SqlEditor value={sql} onChange={setSql} onExecute={execute} placeholder="SELECT * FROM tabela LIMIT 100;" completions={completions} />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto bg-gray-950">
          {error && (
            <div className="m-4 p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <pre className="text-xs text-red-400 whitespace-pre-wrap">{error}</pre>
            </div>
          )}
          {result?.rows && result.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900">
                  <tr>{Object.keys(result.rows[0]).map(col => (
                    <th key={col} className="text-left py-2 px-3 text-gray-400 font-medium border-b border-gray-800 whitespace-nowrap">{col}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {result.rows.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-900/50 hover:bg-gray-900/30">
                      {Object.values(row).map((val: any, j: number) => (
                        <td key={j} className="py-1.5 px-3 text-gray-300 font-mono whitespace-nowrap max-w-xs truncate">
                          {val === null ? <span className="text-gray-600 italic">NULL</span> : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result && result.rows?.length === 0 && (
            <div className="p-4 text-sm text-gray-500">Query executada. {result.rowsAffected} rows afetadas.</div>
          )}
          {!result && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center"><Database className="w-12 h-12 text-gray-800 mx-auto mb-2" /><p className="text-xs text-gray-600">Execute uma query para ver resultados</p></div>
            </div>
          )}
        </div>
      </div>

      {/* History sidebar */}
      {history.length > 0 && (
        <div className="h-24 border-t border-gray-800 overflow-y-auto bg-gray-900 p-2">
          <p className="text-[10px] text-gray-600 mb-1 font-medium">Histórico</p>
          {history.map((h, i) => (
            <div key={i} onClick={() => setSql(h.sql)} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer text-xs">
              <FileText className="w-3 h-3 text-gray-600" />
              <span className="text-gray-400 font-mono truncate flex-1">{h.sql.slice(0, 60)}</span>
              <span className="text-gray-600">{h.duration}ms</span>
              <span className="text-gray-700">{h.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
