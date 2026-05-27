import { useState, useEffect } from 'react'
import { Server, Plus, Trash2, Pencil, CheckCircle2, XCircle, Loader2, Upload, Key } from 'lucide-react'
import api from '../lib/api'

export default function K8sClustersPage() {
  const [clusters, setClusters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; version?: string; error?: string }>>({})

  const load = async () => {
    try { const { data } = await api.get('/api/k8s/clusters'); setClusters(data.data) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const testCluster = async (id: string) => {
    setTesting(id)
    try { const { data } = await api.post(`/api/k8s/clusters/${id}/test`); setTestResult(prev => ({ ...prev, [id]: data.data })) }
    catch (err: any) { setTestResult(prev => ({ ...prev, [id]: { ok: false, error: err.message } })) }
    setTesting(null)
  }

  const deleteCluster = async (id: string) => {
    if (!confirm('Remover este cluster?')) return
    await api.delete(`/api/k8s/clusters/${id}`)
    load()
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Clusters AKS</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition">
          <Plus className="w-4 h-4" /> Novo Cluster
        </button>
      </div>

      {clusters.length === 0 ? (
        <div className="p-8 bg-surface border border-border rounded-xl text-center">
          <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-text-secondary">Nenhum cluster configurado</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-purple-400 hover:text-purple-300">Adicionar primeiro cluster</button>
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map(cluster => (
            <div key={cluster.id} className="p-4 bg-surface border border-border rounded-xl hover:shadow-md transition-shadow flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-900/30 flex items-center justify-center">
                <Server className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{cluster.name}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400 border border-purple-800">{cluster.authMethod}</span>
                </div>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Namespaces: {cluster.namespaces?.length > 0 ? cluster.namespaces.join(', ') : 'Todos'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {testResult[cluster.id] && (
                  <span className={`text-xs flex items-center gap-1 ${testResult[cluster.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult[cluster.id].ok ? <><CheckCircle2 className="w-3.5 h-3.5" />{testResult[cluster.id].version}</> : <><XCircle className="w-3.5 h-3.5" />Falhou</>}
                  </span>
                )}
                <button onClick={() => testCluster(cluster.id)} disabled={testing === cluster.id}
                  className="px-3 py-1.5 text-xs bg-surface-elevated hover:bg-surface-active text-text-secondary rounded-lg transition">
                  {testing === cluster.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Testar'}
                </button>
                <button onClick={() => deleteCluster(cluster.id)} className="p-1.5 text-text-tertiary hover:text-red-400 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ClusterForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function ClusterForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', authMethod: 'kubeconfig' as 'kubeconfig' | 'service_principal', kubeconfig: '', tenantId: '', clientId: '', clientSecret: '', subscriptionId: '', resourceGroup: '', clusterName: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setForm(f => ({ ...f, kubeconfig: ev.target?.result as string }))
    reader.readAsText(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/api/k8s/clusters', form)
      onSaved()
    } catch (err: any) { setError(err.response?.data?.error || 'Erro') }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-purple-500 outline-none"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-text-primary mb-4">Novo Cluster AKS</h2>
        {error && <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-400">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nome do Cluster</label>
            <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Produção AKS" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Método de Autenticação</label>
            <select className={inputCls} value={form.authMethod} onChange={e => setForm(f => ({ ...f, authMethod: e.target.value as any }))}>
              <option value="kubeconfig">Kubeconfig (arquivo)</option>
              <option value="service_principal">Azure Service Principal</option>
            </select>
          </div>

          {form.authMethod === 'kubeconfig' ? (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Arquivo Kubeconfig</label>
              <div className="border-2 border-dashed border-border rounded-xl p-6 hover:border-purple-600 transition cursor-pointer relative text-center">
                <input type="file" accept=".yaml,.yml,.config" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                {form.kubeconfig ? <p className="text-sm text-green-400">✅ Kubeconfig carregado</p> : <p className="text-sm text-text-secondary">Clique ou arraste o kubeconfig aqui</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-text-secondary mb-1">Tenant ID</label><input className={inputCls} value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))} required /></div>
                <div><label className="block text-xs font-medium text-text-secondary mb-1">Client ID</label><input className={inputCls} value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required /></div>
              </div>
              <div><label className="block text-xs font-medium text-text-secondary mb-1">Client Secret</label><input type="password" className={inputCls} value={form.clientSecret} onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-text-secondary mb-1">Subscription ID</label><input className={inputCls} value={form.subscriptionId} onChange={e => setForm(f => ({ ...f, subscriptionId: e.target.value }))} /></div>
                <div><label className="block text-xs font-medium text-text-secondary mb-1">Resource Group</label><input className={inputCls} value={form.resourceGroup} onChange={e => setForm(f => ({ ...f, resourceGroup: e.target.value }))} /></div>
              </div>
              <div><label className="block text-xs font-medium text-text-secondary mb-1">Cluster Name</label><input className={inputCls} value={form.clusterName} onChange={e => setForm(f => ({ ...f, clusterName: e.target.value }))} /></div>
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-elevated rounded-lg transition">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
