import { useState, useEffect, useCallback } from 'react'
import { History, Camera, Trash2, Loader2, GitCompareArrows, Tag, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../lib/api'

interface Connection { id: string; name: string; environment: string }
interface DiffData { added: string[]; removed: string[]; modified: string[] }
interface Snapshot {
  id: string; capturedAt: string; label: string | null;
  diff: DiffData | null; schema: string; database: string;
  snapshot?: Record<string, any>; notes?: string | null;
}

function DiffBadge({ diff }: { diff: DiffData | null }) {
  if (!diff) return <span className="text-xs text-gray-500">Snapshot inicial</span>
  const parts: string[] = []
  if (diff.added.length) parts.push(`+${diff.added.length}`)
  if (diff.removed.length) parts.push(`-${diff.removed.length}`)
  if (diff.modified.length) parts.push(`~${diff.modified.length}`)
  if (!parts.length) return <span className="text-xs text-gray-500">Sem alterações</span>
  return (
    <div className="flex items-center gap-1.5">
      {diff.added.length > 0 && <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">+{diff.added.length}</span>}
      {diff.removed.length > 0 && <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">-{diff.removed.length}</span>}
      {diff.modified.length > 0 && <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">~{diff.modified.length}</span>}
    </div>
  )
}

export default function SchemaVersionPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [label, setLabel] = useState('')
  const [showCapture, setShowCapture] = useState(false)
  const [selectedSnap, setSelectedSnap] = useState<Snapshot | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo] = useState('')
  const [compareResult, setCompareResult] = useState<DiffData | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    api.get('/api/connections').then(r => setConnections(r.data.data)).catch(() => {})
  }, [])

  const loadSnapshots = useCallback(async () => {
    if (!selectedConn) return
    setLoading(true)
    try {
      const { data } = await api.get(`/api/schema-versions/${selectedConn}`)
      setSnapshots(data.data)
    } catch {}
    setLoading(false)
  }, [selectedConn])

  useEffect(() => { loadSnapshots() }, [loadSnapshots])

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const captureSnapshot = async () => {
    setCapturing(true)
    try {
      await api.post(`/api/schema-versions/${selectedConn}/capture`, { label: label || undefined })
      showToast('Snapshot capturado com sucesso', 'success')
      setShowCapture(false)
      setLabel('')
      loadSnapshots()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Erro ao capturar', 'error')
    }
    setCapturing(false)
  }

  const viewSnapshot = async (snap: Snapshot) => {
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/api/schema-versions/${selectedConn}/${snap.id}`)
      setSelectedSnap(data.data)
    } catch {}
    setDetailLoading(false)
  }

  const deleteSnapshot = async (id: string) => {
    if (!confirm('Excluir este snapshot?')) return
    try {
      await api.delete(`/api/schema-versions/${selectedConn}/${id}`)
      showToast('Snapshot excluído', 'success')
      if (selectedSnap?.id === id) setSelectedSnap(null)
      loadSnapshots()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Erro', 'error')
    }
  }

  const runCompare = async () => {
    if (!compareFrom || !compareTo) return
    try {
      const { data } = await api.get(`/api/schema-versions/${selectedConn}/diff/${compareFrom}/${compareTo}`)
      setCompareResult(data.data.diff)
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Erro ao comparar', 'error')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-purple-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Schema Versioning</h1>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
          value={selectedConn} onChange={e => { setSelectedConn(e.target.value); setSelectedSnap(null); setCompareResult(null); }}>
          <option value="">Selecionar conexão...</option>
          {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.environment})</option>)}
        </select>
        {selectedConn && (
          <>
            <button onClick={() => setShowCapture(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition">
              <Camera className="w-4 h-4" /> Capturar Snapshot
            </button>
            <button onClick={() => { setCompareMode(!compareMode); setCompareResult(null); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition border ${compareMode ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <GitCompareArrows className="w-4 h-4" /> Comparar
            </button>
          </>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
      </div>

      {/* Compare mode */}
      {compareMode && selectedConn && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={compareFrom} onChange={e => setCompareFrom(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white">
              <option value="">De...</option>
              {snapshots.map(s => <option key={s.id} value={s.id}>{s.label || new Date(s.capturedAt).toLocaleString()}</option>)}
            </select>
            <span className="text-gray-500">→</span>
            <select value={compareTo} onChange={e => setCompareTo(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white">
              <option value="">Para...</option>
              {snapshots.map(s => <option key={s.id} value={s.id}>{s.label || new Date(s.capturedAt).toLocaleString()}</option>)}
            </select>
            <button onClick={runCompare} disabled={!compareFrom || !compareTo}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition">
              Comparar
            </button>
          </div>
          {compareResult && (
            <div className="space-y-2">
              {compareResult.added.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Adicionados ({compareResult.added.length})</h4>
                  {compareResult.added.map(item => <div key={item} className="text-xs text-gray-700 dark:text-gray-300 pl-3 py-0.5 border-l-2 border-emerald-500">+ {item}</div>)}
                </div>
              )}
              {compareResult.removed.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Removidos ({compareResult.removed.length})</h4>
                  {compareResult.removed.map(item => <div key={item} className="text-xs text-gray-700 dark:text-gray-300 pl-3 py-0.5 border-l-2 border-red-500">- {item}</div>)}
                </div>
              )}
              {compareResult.modified.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">Modificados ({compareResult.modified.length})</h4>
                  {compareResult.modified.map(item => <div key={item} className="text-xs text-gray-700 dark:text-gray-300 pl-3 py-0.5 border-l-2 border-amber-500">~ {item}</div>)}
                </div>
              )}
              {!compareResult.added.length && !compareResult.removed.length && !compareResult.modified.length && (
                <p className="text-sm text-gray-500">Nenhuma diferença encontrada entre os snapshots.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Snapshot list */}
      {selectedConn && !compareMode && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Histórico de Snapshots</h3>
            {snapshots.length === 0 && !loading && (
              <p className="text-sm text-gray-500 py-4">Nenhum snapshot capturado ainda.</p>
            )}
            {snapshots.map(snap => (
              <div key={snap.id}
                className={`p-4 rounded-lg border cursor-pointer transition ${selectedSnap?.id === snap.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'}`}
                onClick={() => viewSnapshot(snap)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {snap.label && <span className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-white"><Tag className="w-3 h-3" />{snap.label}</span>}
                      <span className="text-xs text-gray-500">{new Date(snap.capturedAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1"><DiffBadge diff={snap.diff} /></div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteSnapshot(snap.id); }}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Snapshot detail */}
          <div>
            {detailLoading && <Loader2 className="w-5 h-5 animate-spin text-purple-500 mx-auto mt-8" />}
            {selectedSnap?.snapshot && !detailLoading && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 max-h-[70vh] overflow-auto">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Schema em {new Date(selectedSnap.capturedAt).toLocaleString()}
                  {selectedSnap.label && <span className="ml-2 text-purple-500">({selectedSnap.label})</span>}
                </h3>
                {Object.entries(selectedSnap.snapshot.tables || {}).map(([tableName, tableData]: [string, any]) => (
                  <details key={tableName} className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-purple-500 transition">
                      <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                      {tableName}
                      <span className="text-xs text-gray-500 ml-auto">{tableData.columns?.length || 0} cols</span>
                    </summary>
                    <div className="pl-6 mt-1 space-y-0.5">
                      {(tableData.columns || []).map((col: any) => (
                        <div key={col.name} className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-mono">{col.name}</span>
                          <span className="text-gray-400 dark:text-gray-600 ml-2">{col.type}</span>
                          {col.isPrimaryKey && <span className="ml-1 text-amber-500">PK</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Capture Modal */}
      {showCapture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCapture(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Capturar Snapshot</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label (opcional)</label>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: antes da migração v2"
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCapture(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">Cancelar</button>
              <button onClick={captureSnapshot} disabled={capturing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition">
                {capturing && <Loader2 className="w-4 h-4 animate-spin" />} Capturar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
