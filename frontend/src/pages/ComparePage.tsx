import { useState, useEffect } from 'react'
import { GitCompareArrows, Plus, Minus, AlertTriangle, Loader2, FileCode } from 'lucide-react'
import api from '../lib/api'

interface Connection { id: string; name: string; environment: string; }

export default function ComparePage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [diff, setDiff] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/connections').then(r => setConnections(r.data.data)).catch(() => {})
  }, [])

  const compare = async () => {
    if (!sourceId || !targetId) return
    setLoading(true); setError(''); setDiff(null)
    try {
      const { data } = await api.post('/api/compare', { sourceId, targetId })
      setDiff(data.data)
    } catch (err: any) { setError(err.response?.data?.error || err.message) }
    setLoading(false)
  }

  const totalDiffs = diff ? (diff.tables.onlyInSource.length + diff.tables.onlyInTarget.length + diff.tables.different.length + diff.views.onlyInSource.length + diff.views.onlyInTarget.length + diff.functions.onlyInSource.length + diff.functions.onlyInTarget.length) : 0

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Comparador de Schemas</h1>

      {/* Selectors */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex-1">
          <label className="block text-[10px] text-gray-500 mb-1 font-medium">SOURCE</label>
          <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
            value={sourceId} onChange={e => setSourceId(e.target.value)}>
            <option value="">Selecione...</option>
            {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.environment})</option>)}
          </select>
        </div>
        <GitCompareArrows className="w-6 h-6 text-gray-600 mt-4" />
        <div className="flex-1">
          <label className="block text-[10px] text-gray-500 mb-1 font-medium">TARGET</label>
          <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
            value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">Selecione...</option>
            {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.environment})</option>)}
          </select>
        </div>
        <button onClick={compare} disabled={loading || !sourceId || !targetId}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompareArrows className="w-4 h-4" />}
          Comparar
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">{error}</div>}

      {diff && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`p-4 rounded-xl border ${totalDiffs === 0 ? 'bg-green-900/10 border-green-800' : 'bg-amber-900/10 border-amber-800'}`}>
            <p className={`text-sm font-medium ${totalDiffs === 0 ? 'text-green-400' : 'text-amber-400'}`}>
              {totalDiffs === 0 ? '✅ Schemas idênticos!' : `⚠️ ${totalDiffs} diferença(s) encontrada(s)`}
            </p>
          </div>

          {/* Tables */}
          {(diff.tables.onlyInSource.length > 0 || diff.tables.onlyInTarget.length > 0 || diff.tables.different.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Tabelas</h3></div>
              <div className="p-3 space-y-2">
                {diff.tables.onlyInSource.map((t: string) => (
                  <div key={t} className="flex items-center gap-2 text-xs"><Plus className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400 font-mono">{t}</span><span className="text-gray-600">só no source</span></div>
                ))}
                {diff.tables.onlyInTarget.map((t: string) => (
                  <div key={t} className="flex items-center gap-2 text-xs"><Minus className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400 font-mono">{t}</span><span className="text-gray-600">só no target</span></div>
                ))}
                {diff.tables.different.map((d: any) => (
                  <div key={d.name} className="ml-1">
                    <div className="flex items-center gap-2 text-xs"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-400 font-mono">{d.name}</span></div>
                    <div className="ml-6 mt-1 space-y-0.5">
                      {d.differences.map((dd: string, i: number) => (
                        <p key={i} className="text-[11px] text-gray-400 font-mono">{dd}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Views */}
          {(diff.views.onlyInSource.length > 0 || diff.views.onlyInTarget.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Views</h3></div>
              <div className="p-3 space-y-1">
                {diff.views.onlyInSource.map((v: string) => <div key={v} className="flex items-center gap-2 text-xs"><Plus className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400 font-mono">{v}</span></div>)}
                {diff.views.onlyInTarget.map((v: string) => <div key={v} className="flex items-center gap-2 text-xs"><Minus className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400 font-mono">{v}</span></div>)}
              </div>
            </div>
          )}

          {/* Functions */}
          {(diff.functions.onlyInSource.length > 0 || diff.functions.onlyInTarget.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Functions</h3></div>
              <div className="p-3 space-y-1">
                {diff.functions.onlyInSource.map((f: string) => <div key={f} className="flex items-center gap-2 text-xs"><Plus className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400 font-mono">{f}</span></div>)}
                {diff.functions.onlyInTarget.map((f: string) => <div key={f} className="flex items-center gap-2 text-xs"><Minus className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400 font-mono">{f}</span></div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
