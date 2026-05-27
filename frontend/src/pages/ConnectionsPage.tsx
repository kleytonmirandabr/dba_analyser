import { useState, useEffect, useMemo } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Plug, Plus, Trash2, Pencil, CheckCircle2, XCircle, Loader2, Database, Server, Search, ChevronDown, ChevronRight, FolderOpen, Key, Eye, EyeOff } from 'lucide-react'
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
  const [bulkCredConn, setBulkCredConn] = useState<Connection | null>(null)
  const [bulkCred, setBulkCred] = useState({ username: '', password: '' })
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)
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

  const bulkUpdateCredentials = async () => {
    if (!bulkCredConn || !bulkCred.username || !bulkCred.password) return
    setBulkLoading(true); setBulkResult(null)
    try {
      const { data } = await api.post(`/api/connections/${bulkCredConn.id}/bulk-credentials`, bulkCred)
      setBulkResult(`✅ ${data.data.updated} conexões atualizadas com sucesso!`)
      setTimeout(() => { setBulkCredConn(null); setBulkResult(null); setBulkCred({ username: '', password: '' }); load() }, 2000)
    } catch (err: any) { setBulkResult('❌ Erro: ' + (err.response?.data?.error || err.message)) }
    setBulkLoading(false)
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
        {!isChild && (
          <>
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
          </>
        )}
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
                    <button onClick={() => { setBulkCredConn(parent); setBulkCred({ username: '', password: '' }); setBulkResult(null) }} title="Re-salvar credenciais (todas as conexões deste servidor)"
                      className="p-1.5 text-text-tertiary hover:text-amber-400 transition">
                      <Key className="w-4 h-4" />
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
      {/* Bulk Credentials Dialog */}
      {bulkCredConn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-surface rounded-xl shadow-2xl w-96 p-6 border border-border">
            <h3 className="text-sm font-bold text-text-primary mb-1">🔑 {t('connections.bulkCredentials')}</h3>
            <p className="text-xs text-text-secondary mb-4">Atualiza o usuário/senha de TODAS as conexões em <b>{bulkCredConn.host}:{bulkCredConn.port}</b></p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary font-medium">Usuário</label>
                <input value={bulkCred.username} onChange={e => setBulkCred(c => ({ ...c, username: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-surface-elevated border border-border rounded-lg text-text-primary" placeholder="sa" />
              </div>
              <div>
                <label className="text-xs text-text-secondary font-medium">Senha</label>
                <input type="password" value={bulkCred.password} onChange={e => setBulkCred(c => ({ ...c, password: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-surface-elevated border border-border rounded-lg text-text-primary" placeholder="••••••" />
              </div>
              {bulkResult && <p className={`text-xs ${bulkResult.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{bulkResult}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setBulkCredConn(null)} className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-surface-elevated text-text-secondary rounded-lg">{t('common.cancel')}</button>
                <button onClick={bulkUpdateCredentials} disabled={bulkLoading || !bulkCred.username || !bulkCred.password}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition">
                  {bulkLoading ? t('common.updating') : t('connections.updateAll')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {discoverConn && <DatabaseDiscovery connection={discoverConn} existingDatabases={connections.filter(c => c.host === discoverConn.host && c.port === discoverConn.port && c.databaseName).map(c => c.databaseName)} onClose={() => setDiscoverConn(null)} onSaved={() => { setDiscoverConn(null); load() }} />}
    </div>
  )
}


// Components extracted to separate files
import ConnectionForm from '../components/connections/ConnectionForm'
import DatabaseDiscovery from '../components/connections/DatabaseDiscovery'
