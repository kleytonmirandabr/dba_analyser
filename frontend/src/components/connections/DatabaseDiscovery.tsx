import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Database, Check } from 'lucide-react'
import api from '../../lib/api'

interface Connection { id: string; name: string; host: string; port: number; databaseName: string; username: string; dbType: string; environment: string; mode: string; groupName?: string; }

export default function DatabaseDiscovery({ connection, existingDatabases = [], onClose, onSaved }: { connection: Connection; existingDatabases?: string[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [databases, setDatabases] = useState<{ name: string; sizeBytes?: number; encoding?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const discover = async () => {
      try {
        const { data } = await api.post(`/api/connections/${connection.id}/databases`)
        const all = data.data || []
        setDatabases(all.filter((db: any) => !existingDatabases.includes(db.name)))
        if (data.error) setError(data.error)
      } catch (err: any) {
        setError(err.message)
      }
      setLoading(false)
    }
    discover()
  }, [connection.id])

  const toggleDb = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === databases.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(databases.map(d => d.name)))
    }
  }

  const handleSave = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try {
      await api.post(`/api/connections/${connection.id}/select-databases`, { databases: Array.from(selected) })
      onSaved()
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
      setSaving(false)
    }
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-text-primary mb-1">Descobrir Databases</h2>
        <p className="text-xs text-text-secondary mb-4">Servidor: {connection.host}:{connection.port} ({connection.dbType})</p>

        {error && <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-xs text-red-400">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-text-secondary">Conectando e listando databases...</span>
          </div>
        ) : databases.length === 0 ? (
          <p className="text-sm text-text-secondary py-8 text-center">{t('connections.noDatabase')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <button onClick={toggleAll} className="text-xs text-blue-400 hover:text-blue-300">
                {selected.size === databases.length ? t('connections.deselectAll') : t('connections.selectAll')}
              </button>
              <span className="text-xs text-text-tertiary">{selected.size} de {databases.length} selecionados</span>
            </div>
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {databases.map(db => (
                <label key={db.name}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    selected.has(db.name) ? 'bg-blue-900/20 border-blue-700' : 'bg-gray-100/50 dark:bg-gray-800/50 border-border hover:border-border'
                  }`}>
                  <input type="checkbox" checked={selected.has(db.name)} onChange={() => toggleDb(db.name)}
                    className="rounded border-gray-600 text-blue-500 focus:ring-blue-500" />
                  <Database className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-primary font-medium">{db.name}</span>
                    {db.encoding && <span className="ml-2 text-[10px] text-text-tertiary">{db.encoding}</span>}
                  </div>
                  {db.sizeBytes ? <span className="text-xs text-text-tertiary">{formatSize(db.sizeBytes)}</span> : null}
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-3 pt-4 mt-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-elevated rounded-lg transition">Cancelar</button>
          <button onClick={handleSave} disabled={saving || selected.size === 0}
            className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Monitorar {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
