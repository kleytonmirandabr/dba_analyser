import { useState, useEffect, useMemo } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Plug, Plus, Trash2, Pencil, CheckCircle2, XCircle, Loader2, Database, Server, Search, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import api from '../lib/api'

interface Connection {
  id: string; name: string; host: string; port: number; databaseName: string; username: string;
  dbType: string; environment: string; mode: string; isActive: boolean; groupName?: string;
}

interface ConnectionGroup {
  parent: Connection;
  children: Connection[];
}

export default function ConnectionsPage() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; version?: string; error?: string }>>({})
  const [editingConn, setEditingConn] = useState<Connection | null>(null)
  const [discoverConn, setDiscoverConn] = useState<Connection | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const load = async () => {
    try {
      const { data } = await api.get('/api/connections')
      setConnections(data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Group connections: parent = connection without databaseName (server-level) or first in group
  // Children = connections with same host:port that have a databaseName
  const { groups, ungrouped } = useMemo(() => {
    const byServer = new Map<string, Connection[]>()
    
    connections.forEach(conn => {
      const key = `${conn.host}:${conn.port}`
      if (!byServer.has(key)) byServer.set(key, [])
      byServer.get(key)!.push(conn)
    })

    const groups: ConnectionGroup[] = []
    const ungrouped: Connection[] = []

    byServer.forEach((conns) => {
      // Find the parent: the one without a databaseName, or with the shortest name
      const parent = conns.find(c => !c.databaseName || c.databaseName === '') 
        || conns.reduce((a, b) => a.name.length <= b.name.length ? a : b)
      
      const children = conns.filter(c => c.id !== parent.id)

      if (children.length > 0) {
        groups.push({ parent, children })
      } else {
        ungrouped.push(parent)
      }
    })

    return { groups, ungrouped }
  }, [connections])

  const toggleGroup = (parentId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(parentId) ? next.delete(parentId) : next.add(parentId)
      return next
    })
  }

  const testConnection = async (id: string) => {
    setTesting(id)
    try {
      const { data } = await api.post(`/api/connections/${id}/test`)
      setTestResult(prev => ({ ...prev, [id]: data.data }))
    } catch (err: any) {
      setTestResult(prev => ({ ...prev, [id]: { ok: false, error: err.message } }))
    }
    setTesting(null)
  }

  const deleteConnection = async (id: string) => {
    if (!confirm(t('connections.confirmDelete'))) return
    await api.delete(`/api/connections/${id}`)
    load()
  }

  const envColors: Record<string, string> = {
    dev: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    hml: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    prod: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  }

  const renderConnectionRow = (conn: Connection, isChild = false) => (
    <div key={conn.id} className={`p-4 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 ${isChild ? 'ml-8 border-l-2 border-l-blue-800/40' : ''}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isChild ? 'bg-gray-100/60 dark:bg-gray-800/60' : 'bg-surface-elevated'}`}>
        <Database className={`w-5 h-5 ${isChild ? 'text-blue-300' : 'text-blue-400'}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            {isChild ? conn.databaseName || conn.name : conn.name}
          </h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${envColors[conn.environment] || ''}`}>{conn.environment.toUpperCase()}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-secondary border border-border">{conn.mode}</span>
        </div>
        <p className="text-xs text-text-tertiary mt-0.5">
          <Server className="w-3 h-3 inline mr-1" />{conn.host}:{conn.port}/{conn.databaseName} ({conn.dbType})
        </p>
      </div>
      <div className="flex items-center gap-2">
        {testResult[conn.id] && (
          <span className={`text-xs flex items-center gap-1 ${testResult[conn.id].ok ? 'text-green-400' : 'text-red-400'}`}>
            {testResult[conn.id].ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {testResult[conn.id].ok ? 'OK' : t('connections.failed')}
          </span>
        )}
        <button onClick={() => testConnection(conn.id)} disabled={testing === conn.id}
          className="px-3 py-1.5 text-xs bg-surface-elevated hover:bg-surface-active text-text-secondary rounded-lg transition">
          {testing === conn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : t('connections.test')}
        </button>
        <button onClick={() => setDiscoverConn(conn)} title={t('connections.discover')}
          className="p-1.5 text-text-tertiary hover:text-green-400 transition">
          <Search className="w-4 h-4" />
        </button>
        <button onClick={() => setEditingConn(conn)}
          className="p-1.5 text-text-tertiary hover:text-blue-400 transition">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => deleteConnection(conn.id)}
          className="p-1.5 text-text-tertiary hover:text-red-400 transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">{t('connections.title')}</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          <Plus className="w-4 h-4" />{t('connections.newConnectionTitle')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : connections.length === 0 ? (
        <div className="p-8 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow text-center">
          <Plug className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-text-secondary">{t('connections.noConnections')}</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-blue-400 hover:text-blue-300">{t('connections.addFirst')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Grouped connections */}
          {groups.map(({ parent, children }) => {
            const isCollapsed = collapsedGroups.has(parent.id)
            return (
              <div key={parent.id} className="space-y-2">
                {/* Group header (parent connection) */}
                <div className="p-4 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
                  <button onClick={() => toggleGroup(parent.id)} 
                    className="w-10 h-10 bg-blue-900/30 border border-blue-800/50 rounded-lg flex items-center justify-center hover:bg-blue-900/50 transition">
                    {isCollapsed 
                      ? <ChevronRight className="w-5 h-5 text-blue-400" />
                      : <ChevronDown className="w-5 h-5 text-blue-400" />
                    }
                  </button>
                  <div className="w-10 h-10 bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-text-primary">{parent.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${envColors[parent.environment] || ''}`}>{parent.environment.toUpperCase()}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-secondary border border-border">{parent.mode}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-800/50 font-medium">
                        {children.length} database{children.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      <Server className="w-3 h-3 inline mr-1" />{parent.host}:{parent.port} ({parent.dbType})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {testResult[parent.id] && (
                      <span className={`text-xs flex items-center gap-1 ${testResult[parent.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                        {testResult[parent.id].ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {testResult[parent.id].ok ? 'OK' : t('connections.failed')}
                      </span>
                    )}
                    <button onClick={() => testConnection(parent.id)} disabled={testing === parent.id}
                      className="px-3 py-1.5 text-xs bg-surface-elevated hover:bg-surface-active text-text-secondary rounded-lg transition">
                      {testing === parent.id ? <Loader2 className="w-3 h-3 animate-spin" /> : t('connections.test')}
                    </button>
                    <button onClick={() => setDiscoverConn(parent)} title={t('connections.discover')}
                      className="p-1.5 text-text-tertiary hover:text-green-400 transition">
                      <Search className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingConn(parent)}
                      className="p-1.5 text-text-tertiary hover:text-blue-400 transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteConnection(parent.id)}
                      className="p-1.5 text-text-tertiary hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Children */}
                {!isCollapsed && (
                  <div className="space-y-2 pl-2">
                    {children.map(child => renderConnectionRow(child, true))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Ungrouped connections (standalone) */}
          {ungrouped.map(conn => renderConnectionRow(conn, false))}
        </div>
      )}

      {showForm && <ConnectionForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
      {editingConn && <ConnectionForm connection={editingConn} onClose={() => setEditingConn(null)} onSaved={() => { setEditingConn(null); load() }} />}
      {discoverConn && <DatabaseDiscovery connection={discoverConn} existingDatabases={connections.filter(c => c.host === discoverConn.host && c.port === discoverConn.port && c.databaseName).map(c => c.databaseName)} onClose={() => setDiscoverConn(null)} onSaved={() => { setDiscoverConn(null); load() }} />}
    </div>
  )
}

function ConnectionForm({ onClose, onSaved, connection }: { onClose: () => void; onSaved: () => void; connection?: Connection }) {
  const [form, setForm] = useState({
    name: connection?.name || '', host: connection?.host || '', port: connection?.port || 5432,
    databaseName: connection?.databaseName || '', username: connection?.username || '', password: '',
    dbType: connection?.dbType || 'postgresql', environment: connection?.environment || 'dev',
    mode: connection?.mode || 'readonly', autoApprove: false, groupName: connection?.groupName || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = { ...form, port: Number(form.port) }
      if (!payload.password) delete (payload as any).password
      if (connection) {
        await api.put(`/api/connections/${connection.id}`, payload)
      } else {
        await api.post('/api/connections', payload)
      }
      onSaved()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-blue-500 outline-none"
  const labelCls = "block text-xs font-medium text-text-secondary mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-text-primary mb-4">{connection ? t('connections.editConnection') : t('connections.newConnectionTitle')}</h2>
        {error && <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-xs text-red-400">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>{t('connections.name')}</label>
            <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Produção Photocoat" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Host</label>
              <input className={inputCls} value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="10.0.1.50" required />
            </div>
            <div>
              <label className={labelCls}>Porta</label>
              <input type="number" className={inputCls} value={form.port} onChange={e => setForm(f => ({ ...f, port: +e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Database <span className="text-gray-600">(opcional)</span></label>
            <input className={inputCls} value={form.databaseName} onChange={e => setForm(f => ({ ...f, databaseName: e.target.value }))} placeholder="Deixe vazio para listar todos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('connections.username')}</label>
              <input className={inputCls} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Senha</label>
              <input type="password" className={inputCls} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <SearchableSelect
                value={form.dbType}
                onChange={v => setForm(f => ({ ...f, dbType: v }))}
                searchable={false}
                options={[
                  { value: 'postgresql', label: 'PostgreSQL' },
                  { value: 'mssql', label: 'SQL Server' },
                  { value: 'mysql', label: 'MySQL' },
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Ambiente</label>
              <SearchableSelect
                value={form.environment}
                onChange={v => setForm(f => ({ ...f, environment: v }))}
                searchable={false}
                options={[
                  { value: 'dev', label: 'DEV' },
                  { value: 'hml', label: 'HML' },
                  { value: 'prod', label: 'PROD' },
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Modo</label>
              <SearchableSelect
                value={form.mode}
                onChange={v => setForm(f => ({ ...f, mode: v }))}
                searchable={false}
                options={[
                  { value: 'readonly', label: 'Somente Leitura' },
                  { value: 'execute', label: 'Execução' },
                ]}
              />
            </div>
          </div>
          {form.environment === 'dev' && form.mode === 'execute' && (
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input type="checkbox" checked={form.autoApprove} onChange={e => setForm(f => ({ ...f, autoApprove: e.target.checked }))} className="rounded" />
              Auto-aprovar execuções (sem necessidade de aprovação)
            </label>
          )}
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-elevated rounded-lg transition">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


function DatabaseDiscovery({ connection, existingDatabases = [], onClose, onSaved }: { connection: Connection; existingDatabases?: string[]; onClose: () => void; onSaved: () => void }) {
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