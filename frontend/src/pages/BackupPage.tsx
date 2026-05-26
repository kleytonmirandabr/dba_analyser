import { useState, useEffect, useCallback } from 'react'
import { HardDrive, Plus, Download, RotateCcw, Trash2, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import api from '../lib/api'

interface Connection { id: string; name: string; environment: string }
interface BackupJob {
  id: string; connectionId: string; type: string; status: string;
  format: string | null; filename: string | null; sizeBytes: number | null;
  logs: string | null; error: string | null; database: string | null;
  startedAt: string; completedAt: string | null;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Concluído</span>
  if (status === 'failed') return <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3.5 h-3.5" />Falhou</span>
  return <span className="flex items-center gap-1 text-xs text-amber-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />Executando</span>
}

export default function BackupPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [backups, setBackups] = useState<BackupJob[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showRestore, setShowRestore] = useState<BackupJob | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Backup form state
  const [format, setFormat] = useState<'custom' | 'plain' | 'directory'>('custom')
  const [schema, setSchema] = useState('')
  const [dataOnly, setDataOnly] = useState(false)
  const [tablesOnly, setTablesOnly] = useState(false)
  const [creating, setCreating] = useState(false)

  // Restore form state
  const [targetDb, setTargetDb] = useState('')
  const [cleanRestore, setCleanRestore] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    api.get('/api/connections').then(r => setConnections(r.data.data)).catch(() => {})
  }, [])

  const loadBackups = useCallback(async () => {
    if (!selectedConn) return
    setLoading(true)
    try {
      const { data } = await api.get(`/api/backup/${selectedConn}/list`)
      setBackups(data.data)
    } catch {}
    setLoading(false)
  }, [selectedConn])

  useEffect(() => { loadBackups() }, [loadBackups])

  // Poll running jobs
  useEffect(() => {
    const running = backups.filter(b => b.status === 'running')
    if (!running.length) return
    const interval = setInterval(loadBackups, 3000)
    return () => clearInterval(interval)
  }, [backups, loadBackups])

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const createBackup = async () => {
    setCreating(true)
    try {
      await api.post(`/api/backup/${selectedConn}/create`, {
        format, schema: schema || undefined, dataOnly, tablesOnly
      })
      showToast('Backup iniciado com sucesso', 'success')
      setShowModal(false)
      loadBackups()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Erro ao criar backup', 'error')
    }
    setCreating(false)
  }

  const restoreBackup = async () => {
    if (!showRestore) return
    setRestoring(true)
    try {
      await api.post(`/api/backup/${selectedConn}/restore`, {
        backupId: showRestore.id,
        targetDatabase: targetDb || undefined,
        clean: cleanRestore,
      })
      showToast('Restore iniciado com sucesso', 'success')
      setShowRestore(null)
      loadBackups()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Erro ao restaurar', 'error')
    }
    setRestoring(false)
  }

  const deleteBackup = async (id: string) => {
    if (!confirm('Excluir este backup permanentemente?')) return
    try {
      await api.delete(`/api/backup/${selectedConn}/${id}`)
      showToast('Backup excluído', 'success')
      loadBackups()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Erro ao excluir', 'error')
    }
  }

  const downloadBackup = (id: string) => {
    window.open(`${api.defaults.baseURL || ''}/api/backup/${selectedConn}/download/${id}`, '_blank')
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardDrive className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Backup & Restore</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
          value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
          <option value="">Selecionar conexão...</option>
          {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.environment})</option>)}
        </select>
        {selectedConn && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" /> Novo Backup
          </button>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>

      {selectedConn && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Arquivo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Formato</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Tamanho</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum backup encontrado</td></tr>
              )}
              {backups.map(b => (
                <tr key={b.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-mono text-xs">{b.filename || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{b.format || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatBytes(b.sizeBytes)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{new Date(b.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {b.status === 'completed' && (
                        <>
                          <button onClick={() => downloadBackup(b.id)} title="Download"
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-500 transition">
                            <Download className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setShowRestore(b); setTargetDb(''); setCleanRestore(false); }} title="Restore"
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-amber-500 transition">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button onClick={() => deleteBackup(b.id)} title="Excluir"
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-red-500 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Backup Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Novo Backup</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Formato</label>
                <select value={format} onChange={e => setFormat(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white">
                  <option value="custom">Custom (.dump)</option>
                  <option value="plain">Plain SQL (.sql)</option>
                  <option value="directory">Directory</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schema (opcional)</label>
                <input value={schema} onChange={e => setSchema(e.target.value)} placeholder="public"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={tablesOnly} onChange={e => { setTablesOnly(e.target.checked); if (e.target.checked) setDataOnly(false); }} className="rounded" />
                  Somente estrutura
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={dataOnly} onChange={e => { setDataOnly(e.target.checked); if (e.target.checked) setTablesOnly(false); }} className="rounded" />
                  Somente dados
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">Cancelar</button>
              <button onClick={createBackup} disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} Criar Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRestore(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Restaurar Backup</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Arquivo: <span className="font-mono">{showRestore.filename}</span></p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Database destino (opcional)</label>
                <input value={targetDb} onChange={e => setTargetDb(e.target.value)} placeholder="Mesmo da conexão"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={cleanRestore} onChange={e => setCleanRestore(e.target.checked)} className="rounded" />
                Clean (drop objetos antes de restaurar)
              </label>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-4">
              <p className="text-xs text-amber-700 dark:text-amber-300">⚠️ Esta ação pode sobrescrever dados existentes. Certifique-se de que deseja continuar.</p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowRestore(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">Cancelar</button>
              <button onClick={restoreBackup} disabled={restoring}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition">
                {restoring && <Loader2 className="w-4 h-4 animate-spin" />} Restaurar
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
