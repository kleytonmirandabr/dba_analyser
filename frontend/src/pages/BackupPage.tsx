import { useState, useEffect, useCallback } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      showToast(t('backup.deleted'), 'success')
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
          <h1 className="text-xl font-bold text-text-primary">Backup & Restore</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SearchableSelect
          value={selectedConn}
          onChange={setSelectedConn}
          placeholder={t('connections.search')}
          options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.environment})` }))}
          className="min-w-[200px]"
        />
        {selectedConn && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" /> Novo Backup
          </button>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>

      {selectedConn && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/50">
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Arquivo</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Formato</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Tamanho</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Data</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Status</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">Ações</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-text-tertiary">{t('backup.noBackups')}</td></tr>
              )}
              {backups.map(b => (
                <tr key={b.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-text-primary font-mono text-xs">{b.filename || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{b.format || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatBytes(b.sizeBytes)}</td>
                  <td className="px-4 py-3 text-text-secondary">{new Date(b.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {b.status === 'completed' && (
                        <>
                          <button onClick={() => downloadBackup(b.id)} title="Download"
                            className="p-1.5 rounded hover:bg-surface-active text-text-tertiary hover:text-blue-500 transition">
                            <Download className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setShowRestore(b); setTargetDb(''); setCleanRestore(false); }} title="Restore"
                            className="p-1.5 rounded hover:bg-surface-active text-text-tertiary hover:text-amber-500 transition">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button onClick={() => deleteBackup(b.id)} title="Excluir"
                        className="p-1.5 rounded hover:bg-surface-active text-text-tertiary hover:text-red-500 transition">
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
          <div className="bg-surface rounded-xl border border-border p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-text-primary mb-4">Novo Backup</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Formato</label>
                <SearchableSelect
                  value={format}
                  onChange={v => setFormat(v as any)}
                  searchable={false}
                  options={[
                    { value: 'custom', label: 'Custom (.dump)' },
                    { value: 'plain', label: 'Plain SQL (.sql)' },
                    { value: 'directory', label: 'Directory' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Schema (opcional)</label>
                <input value={schema} onChange={e => setSchema(e.target.value)} placeholder="public"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={tablesOnly} onChange={e => { setTablesOnly(e.target.checked); if (e.target.checked) setDataOnly(false); }} className="rounded" />
                  Somente estrutura
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={dataOnly} onChange={e => { setDataOnly(e.target.checked); if (e.target.checked) setTablesOnly(false); }} className="rounded" />
                  Somente dados
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-gray-900 dark:hover:text-text-primary transition">Cancelar</button>
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
          <div className="bg-surface rounded-xl border border-border p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-text-primary mb-4">Restaurar Backup</h2>
            <p className="text-sm text-text-secondary mb-4">Arquivo: <span className="font-mono">{showRestore.filename}</span></p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Database destino (opcional)</label>
                <input value={targetDb} onChange={e => setTargetDb(e.target.value)} placeholder={t('backup.sameAsConnection')}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" />
              </div>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={cleanRestore} onChange={e => setCleanRestore(e.target.checked)} className="rounded" />
                Clean (drop objetos antes de restaurar)
              </label>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-4">
              <p className="text-xs text-amber-700 dark:text-amber-300">⚠️ Esta ação pode sobrescrever dados existentes. Certifique-se de que deseja continuar.</p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowRestore(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-gray-900 dark:hover:text-text-primary transition">Cancelar</button>
              <button onClick={restoreBackup} disabled={restoring}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-text-primary text-sm font-medium rounded-lg disabled:opacity-50 transition">
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
