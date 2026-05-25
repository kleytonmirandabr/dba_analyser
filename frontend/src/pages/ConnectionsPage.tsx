import { useState, useEffect } from 'react'
import { Plug, Plus, Trash2, CheckCircle2, XCircle, Loader2, Database, Server } from 'lucide-react'
import api from '../lib/api'

interface Connection {
  id: string; name: string; host: string; port: number; databaseName: string; username: string;
  dbType: string; environment: string; mode: string; isActive: boolean; groupName?: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; version?: string; error?: string }>>({})

  const load = async () => {
    try {
      const { data } = await api.get('/api/connections')
      setConnections(data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

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
    if (!confirm('Tem certeza que deseja excluir esta conexão?')) return
    await api.delete(`/api/connections/${id}`)
    load()
  }

  const envColors: Record<string, string> = {
    dev: 'bg-green-900/30 text-green-400 border-green-800',
    hml: 'bg-amber-900/30 text-amber-400 border-amber-800',
    prod: 'bg-red-900/30 text-red-400 border-red-800',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Conexões</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          <Plus className="w-4 h-4" /> Nova Conexão
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : connections.length === 0 ? (
        <div className="p-8 bg-gray-900 border border-gray-800 rounded-xl text-center">
          <Plug className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhuma conexão cadastrada.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-blue-400 hover:text-blue-300">+ Adicionar primeira conexão</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {connections.map(conn => (
            <div key={conn.id} className="p-4 bg-gray-900 border border-gray-800 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{conn.name}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${envColors[conn.environment] || ''}`}>{conn.environment.toUpperCase()}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">{conn.mode}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  <Server className="w-3 h-3 inline mr-1" />{conn.host}:{conn.port}/{conn.databaseName} ({conn.dbType})
                </p>
              </div>
              <div className="flex items-center gap-2">
                {testResult[conn.id] && (
                  <span className={`text-xs flex items-center gap-1 ${testResult[conn.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult[conn.id].ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {testResult[conn.id].ok ? 'OK' : 'Falha'}
                  </span>
                )}
                <button onClick={() => testConnection(conn.id)} disabled={testing === conn.id}
                  className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition">
                  {testing === conn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Testar'}
                </button>
                <button onClick={() => deleteConnection(conn.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ConnectionForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function ConnectionForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', host: '', port: 5432, databaseName: '', username: '', password: '',
    dbType: 'postgresql', environment: 'dev', mode: 'readonly', autoApprove: false, groupName: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await api.post('/api/connections', { ...form, port: Number(form.port) })
      onSaved()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
  const labelCls = "block text-xs font-medium text-gray-400 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white mb-4">Nova Conexão</h2>
        {error && <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-400">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Nome da conexão</label>
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
            <label className={labelCls}>Database</label>
            <input className={inputCls} value={form.databaseName} onChange={e => setForm(f => ({ ...f, databaseName: e.target.value }))} placeholder="photocoat_prod" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Usuário</label>
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
              <select className={inputCls} value={form.dbType} onChange={e => setForm(f => ({ ...f, dbType: e.target.value }))}>
                <option value="postgresql">PostgreSQL</option>
                <option value="mssql">SQL Server</option>
                <option value="mysql">MySQL</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ambiente</label>
              <select className={inputCls} value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}>
                <option value="dev">DEV</option>
                <option value="hml">HML</option>
                <option value="prod">PROD</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Modo</label>
              <select className={inputCls} value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
                <option value="readonly">Somente Leitura</option>
                <option value="execute">Execução</option>
              </select>
            </div>
          </div>
          {form.environment === 'dev' && form.mode === 'execute' && (
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={form.autoApprove} onChange={e => setForm(f => ({ ...f, autoApprove: e.target.checked }))} className="rounded" />
              Auto-aprovar execuções (sem necessidade de aprovação)
            </label>
          )}
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-800 rounded-lg transition">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
