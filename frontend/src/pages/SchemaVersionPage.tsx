import { useState, useEffect, useCallback } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
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
  if (!diff) return <span className="text-xs text-text-tertiary">Snapshot inicial</span>
  const parts: string[] = []
  if (diff.added.length) parts.push(`+${diff.added.length}`)
  if (diff.removed.length) parts.push(`-${diff.removed.length}`)
  if (diff.modified.length) parts.push(`~${diff.modified.length}`)
  if (!parts.length) return <span className="text-xs text-text-tertiary">Sem alterações</span>
  return (
    <div className="flex items-center gap-1.5">
      {diff.added.length > 0 && <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">+{diff.added.length}</span>}
      {diff.removed.length > 0 && <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">-{diff.removed.length}</span>}
      {diff.modified.length > 0 && <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">~{diff.modified.length}</span>}
    </div>
  )
}

export default function SchemaVersionPage() {
  const { t } = useTranslation()
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
      showToast(t('versioning.snapshotDeleted'), 'success')
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
          <h1 className="text-xl font-bold text-text-primary">Schema Versioning</h1>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchableSelect
          value={selectedConn}
          onChange={v => { setSelectedConn(v); setSelectedSnap(null); setCompareResult(null); }}
          placeholder={t('connections.search')}
          options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.environment})` }))}
          className="min-w-[200px]"
        />
        {selectedConn && (
          <>
            <button onClick={() => setShowCapture(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition">
              <Camera className="w-4 h-4" /> Capturar Snapshot
            </button>
            <button onClick={() => { setCompareMode(!compareMode); setCompareResult(null); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition border ${compareMode ? 'bg-indigo-600 text-white border-indigo-600' : 'text-text-secondary border-border hover:bg-gray-100 dark:hover:bg-surface-elevated'}`}>
              <GitCompareArrows className="w-4 h-4" /> Comparar
            </button>
          </>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
      </div>

      {/* Compare mode */}
      {compareMode && selectedConn && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <SearchableSelect
              value={compareFrom}
              onChange={setCompareFrom}
              placeholder="De..."
              options={snapshots.map(s => ({ value: s.id, label: s.label || new Date(s.capturedAt).toLocaleString() }))}
            />
            <span className="text-text-tertiary">→</span>
            <SearchableSelect
              value={compareTo}
              onChange={setCompareTo}
              placeholder="Para..."
              options={snapshots.map(s => ({ value: s.id, label: s.label || new Date(s.capturedAt).toLocaleString() }))}
            />
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
                  {compareResult.added.map(item => <div key={item} className="text-xs text-text-secondary pl-3 py-0.5 border-l-2 border-emerald-500">+ {item}</div>)}
                </div>
              )}
              {compareResult.removed.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Removidos ({compareResult.removed.length})</h4>
                  {compareResult.removed.map(item => <div key={item} className="text-xs text-text-secondary pl-3 py-0.5 border-l-2 border-red-500">- {item}</div>)}
                </div>
              )}
              {compareResult.modified.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">Modificados ({compareResult.modified.length})</h4>
                  {compareResult.modified.map(item => <div key={item} className="text-xs text-text-secondary pl-3 py-0.5 border-l-2 border-amber-500">~ {item}</div>)}
                </div>
              )}
              {!compareResult.added.length && !compareResult.removed.length && !compareResult.modified.length && (
                <p className="text-sm text-text-tertiary">{t('versioning.noDifferences')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Snapshot list */}
      {selectedConn && !compareMode && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-secondary">Histórico de Snapshots</h3>
            {snapshots.length === 0 && !loading && (
              <p className="text-sm text-text-tertiary py-4">{t('versioning.noSnapshots')}</p>
            )}
            {snapshots.map(snap => (
              <div key={snap.id}
                className={`p-4 rounded-lg border cursor-pointer transition ${selectedSnap?.id === snap.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-border bg-surface hover:border-gray-300 dark:hover:border-border'}`}
                onClick={() => viewSnapshot(snap)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {snap.label && <span className="flex items-center gap-1 text-sm font-medium text-text-primary"><Tag className="w-3 h-3" />{snap.label}</span>}
                      <span className="text-xs text-text-tertiary">{new Date(snap.capturedAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1"><DiffBadge diff={snap.diff} /></div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteSnapshot(snap.id); }}
                    className="p-1.5 rounded hover:bg-surface-active text-text-secondary hover:text-red-500 transition">
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
              <div className="bg-surface rounded-xl border border-border p-4 space-y-3 max-h-[70vh] overflow-auto">
                <h3 className="text-sm font-medium text-text-primary">
                  Schema em {new Date(selectedSnap.capturedAt).toLocaleString()}
                  {selectedSnap.label && <span className="ml-2 text-purple-500">({selectedSnap.label})</span>}
                </h3>
                {Object.entries(selectedSnap.snapshot.tables || {}).map(([tableName, tableData]: [string, any]) => (
                  <details key={tableName} className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary hover:text-purple-500 transition">
                      <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                      {tableName}
                      <span className="text-xs text-text-tertiary ml-auto">{tableData.columns?.length || 0} cols</span>
                    </summary>
                    <div className="pl-6 mt-1 space-y-0.5">
                      {(tableData.columns || []).map((col: any) => (
                        <div key={col.name} className="text-xs text-text-secondary">
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
          <div className="bg-surface rounded-xl border border-border p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-text-primary mb-4">Capturar Snapshot</h2>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Label (opcional)</label>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: antes da migração v2"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCapture(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-gray-900 dark:hover:text-text-primary transition">Cancelar</button>
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
