import { useState, useEffect } from 'react'
import { Server, Plus, Trash2, CheckCircle2, XCircle, Loader2, Upload, Shield, ShieldCheck, Eye, EyeOff, AlertTriangle, Lock, KeyRound, Clock, RotateCcw, Info } from 'lucide-react'
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
    if (!confirm('⚠️ ATENÇÃO: Isso destruirá permanentemente as credenciais criptografadas deste cluster. Continuar?')) return
    await api.delete(`/api/k8s/clusters/${id}`)
    load()
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Clusters AKS</h1>
          <p className="text-sm text-text-secondary mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-green-400" /> Credenciais protegidas com AES-256-GCM + PBKDF2
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition">
          <Plus className="w-4 h-4" /> Novo Cluster
        </button>
      </div>

      {/* Security info banner */}
      <div className="mb-5 p-3 rounded-xl bg-green-950/20 border border-green-900/40 flex items-start gap-3">
        <Lock className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-green-300/80">
          <p className="font-semibold text-green-300 mb-1">Segurança de Credenciais</p>
          <ul className="space-y-0.5 list-disc list-inside text-[11px]">
            <li>Criptografia AES-256-GCM com IV único por campo</li>
            <li>Derivação de chave PBKDF2 (100.000 iterações, SHA-512)</li>
            <li>Salt aleatório de 128 bits por campo sensível</li>
            <li>Secrets nunca trafegam de volta ao frontend — mascarados</li>
            <li>Rate limiting: 10 req/min em endpoints sensíveis</li>
            <li>Audit log em todas as operações de credenciais</li>
          </ul>
        </div>
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
            <div key={cluster.id} className="p-4 bg-surface border border-border rounded-xl hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-900/30 flex items-center justify-center">
                  <Server className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{cluster.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400 border border-purple-800">{cluster.authMethod}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800 flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" /> AES-256
                    </span>
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
                  <button onClick={() => deleteCluster(cluster.id)} className="p-1.5 text-text-tertiary hover:text-red-400 transition" title="Destruir credenciais">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Security metadata row */}
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-[10px] text-text-tertiary">
                <span className="flex items-center gap-1"><KeyRound className="w-3 h-3" /> v{cluster.keyVersion}</span>
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> {cluster.credentialFingerprint ? `fp: ${cluster.credentialFingerprint.slice(0,8)}…` : 'N/A'}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Acessos: {cluster.accessCount}</span>
                {cluster.isCredentialStale && (
                  <span className="flex items-center gap-1 text-amber-400"><AlertTriangle className="w-3 h-3" /> Rotação recomendada (&gt;90d)</span>
                )}
                {cluster.lastRotatedAt && (
                  <span className="flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Rotação: {new Date(cluster.lastRotatedAt).toLocaleDateString('pt-BR')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ClusterForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
    </div>
  )
}

// ═══════════════════════════════════════════════
// FORM — Security-hardened
// ═══════════════════════════════════════════════

function ClusterForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', authMethod: 'kubeconfig' as 'kubeconfig' | 'service_principal',
    kubeconfig: '', tenantId: '', clientId: '', clientSecret: '',
    subscriptionId: '', resourceGroup: '', clusterName: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<any[]>([])
  const [showSecret, setShowSecret] = useState(false)
  const [fileLoaded, setFileLoaded] = useState(false)

  // UUID validation in real-time
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isValidUUID = (v: string) => !v || UUID_REGEX.test(v)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) { setError('Kubeconfig excede 1MB (limite de segurança)'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      if (!content.includes('apiVersion') && !content.includes('clusters')) {
        setError('Arquivo não parece ser um kubeconfig válido'); return
      }
      setForm(f => ({ ...f, kubeconfig: content }))
      setFileLoaded(true)
      setError('')
    }
    reader.readAsText(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(''); setValidationErrors([])
    try {
      await api.post('/api/k8s/clusters', form)
      onSaved()
    } catch (err: any) {
      if (err.response?.data?.details) setValidationErrors(err.response.data.details)
      else setError(err.response?.data?.error || 'Erro ao salvar')
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-purple-500 outline-none transition"
  const errorInputCls = "w-full px-3 py-2 bg-surface-elevated border border-red-700 rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-red-500 outline-none transition"

  const getFieldError = (field: string) => validationErrors.find(e => e.field === field)?.message

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header with security badge */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">Novo Cluster AKS</h2>
          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-green-900/30 text-green-400 border border-green-800">
            <ShieldCheck className="w-3 h-3" /> Criptografia Ativa
          </span>
        </div>

        {/* Encryption info */}
        <div className="mb-4 p-2.5 rounded-lg bg-blue-950/30 border border-blue-900/40 text-[10px] text-blue-300/80 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <span>Todos os campos sensíveis serão criptografados com <strong>AES-256-GCM</strong> antes do armazenamento. A chave é derivada via PBKDF2 com 100.000 iterações.</span>
        </div>

        {error && <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-400 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" />{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nome do Cluster</label>
            <input className={getFieldError('name') ? errorInputCls : inputCls}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Produção AKS" maxLength={100} required />
            {getFieldError('name') && <p className="text-[10px] text-red-400 mt-1">{getFieldError('name')}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Método de Autenticação</label>
            <select className={inputCls} value={form.authMethod} onChange={e => setForm(f => ({ ...f, authMethod: e.target.value as any }))}>
              <option value="kubeconfig">🔑 Kubeconfig (arquivo)</option>
              <option value="service_principal">🏢 Azure Service Principal</option>
            </select>
          </div>

          {form.authMethod === 'kubeconfig' ? (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Arquivo Kubeconfig</label>
              <div className={`border-2 border-dashed rounded-xl p-6 hover:border-purple-600 transition cursor-pointer relative text-center ${fileLoaded ? 'border-green-700 bg-green-950/10' : 'border-border'}`}>
                <input type="file" accept=".yaml,.yml,.config,.conf" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" />
                {fileLoaded ? (
                  <div className="flex flex-col items-center gap-1">
                    <ShieldCheck className="w-8 h-8 text-green-400" />
                    <p className="text-sm text-green-400 font-medium">✅ Kubeconfig carregado</p>
                    <p className="text-[10px] text-text-tertiary">Será criptografado ao salvar</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-8 h-8 text-text-tertiary" />
                    <p className="text-sm text-text-secondary">Arraste ou clique para selecionar</p>
                    <p className="text-[10px] text-text-tertiary">Máx 1MB • .yaml, .yml, .config</p>
                  </div>
                )}
              </div>
              {getFieldError('kubeconfig') && <p className="text-[10px] text-red-400 mt-1">{getFieldError('kubeconfig')}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tenant ID <Lock className="w-3 h-3 inline text-green-500" /></label>
                  <input className={!isValidUUID(form.tenantId) && form.tenantId ? errorInputCls : inputCls}
                    value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required />
                  {form.tenantId && !isValidUUID(form.tenantId) && <p className="text-[10px] text-red-400 mt-1">UUID inválido</p>}
                  {getFieldError('tenantId') && <p className="text-[10px] text-red-400 mt-1">{getFieldError('tenantId')}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Client ID <Lock className="w-3 h-3 inline text-green-500" /></label>
                  <input className={!isValidUUID(form.clientId) && form.clientId ? errorInputCls : inputCls}
                    value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required />
                  {form.clientId && !isValidUUID(form.clientId) && <p className="text-[10px] text-red-400 mt-1">UUID inválido</p>}
                  {getFieldError('clientId') && <p className="text-[10px] text-red-400 mt-1">{getFieldError('clientId')}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Client Secret <Lock className="w-3 h-3 inline text-green-500" /></label>
                <div className="relative">
                  <input type={showSecret ? 'text' : 'password'} className={inputCls + ' pr-10'}
                    value={form.clientSecret} onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))}
                    placeholder="••••••••••••••••••••" required />
                  <button type="button" onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition">
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.clientSecret && form.clientSecret.length < 8 && (
                  <p className="text-[10px] text-amber-400 mt-1">⚠️ Secret muito curto (mín. 8 caracteres)</p>
                )}
                {getFieldError('clientSecret') && <p className="text-[10px] text-red-400 mt-1">{getFieldError('clientSecret')}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Subscription ID</label>
                  <input className={inputCls} value={form.subscriptionId} onChange={e => setForm(f => ({ ...f, subscriptionId: e.target.value }))} placeholder="Opcional" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Resource Group</label>
                  <input className={inputCls} value={form.resourceGroup} onChange={e => setForm(f => ({ ...f, resourceGroup: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Cluster Name</label>
                <input className={inputCls} value={form.clusterName} onChange={e => setForm(f => ({ ...f, clusterName: e.target.value }))} placeholder="Nome do cluster AKS no Azure" />
              </div>
            </div>
          )}

          {/* Security summary before submit */}
          <div className="p-3 rounded-lg bg-surface-elevated border border-border">
            <p className="text-[10px] font-semibold text-text-secondary uppercase mb-2">Proteções aplicadas ao salvar:</p>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-text-tertiary">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-green-500" /> AES-256-GCM</span>
              <span className="flex items-center gap-1"><KeyRound className="w-3 h-3 text-green-500" /> PBKDF2 100k iter</span>
              <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-green-500" /> Salt único/campo</span>
              <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-green-500" /> Auth tag (tamper-proof)</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-elevated rounded-lg transition">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {saving ? 'Criptografando...' : 'Salvar com Criptografia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
