import { useState, useEffect } from 'react'
import { Server, Plus, Trash2, CheckCircle2, XCircle, Loader2, Upload, Shield, ShieldCheck, Eye, EyeOff, AlertTriangle, Lock, KeyRound, Clock, RotateCcw, Info, Copy, Download, ExternalLink, ShieldAlert, EyeIcon } from 'lucide-react'
import api from '../lib/api'

export default function K8sClustersPage() {
  const [clusters, setClusters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showRbac, setShowRbac] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, any>>({})

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
    if (!confirm('⚠️ Isso destruirá permanentemente as credenciais criptografadas. Continuar?')) return
    await api.delete(`/api/k8s/clusters/${id}`)
    load()
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Clusters AKS</h1>
          <p className="text-sm text-text-secondary mt-1">Monitoramento read-only dos seus clusters Kubernetes</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-purple-900/30 transition-all hover:shadow-purple-900/50 hover:-translate-y-0.5">
          <Plus className="w-4 h-4" /> Novo Cluster
        </button>
      </div>

      {/* Security + Read-Only cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Encryption card */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 to-emerald-950/10 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start gap-3 relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-300 mb-2">Criptografia de Credenciais</h3>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-emerald-400/70">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" /> AES-256-GCM + Auth Tag (tamper-proof)
                </div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-400/70">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" /> PBKDF2 100.000 iterações SHA-512
                </div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-400/70">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" /> Salt + IV únicos por campo
                </div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-400/70">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" /> Secrets nunca expostos via API
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Read-Only card */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-900/40 bg-gradient-to-br from-blue-950/40 to-blue-950/10 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start gap-3 relative">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <EyeIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-300 mb-2">Acesso Read-Only</h3>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-blue-400/70">
                  <div className="w-1 h-1 rounded-full bg-blue-400" /> Apenas verbos: get, list, watch
                </div>
                <div className="flex items-center gap-2 text-[11px] text-blue-400/70">
                  <div className="w-1 h-1 rounded-full bg-blue-400" /> Zero capacidade de escrita no cluster
                </div>
                <div className="flex items-center gap-2 text-[11px] text-blue-400/70">
                  <div className="w-1 h-1 rounded-full bg-blue-400" /> ClusterRole dedicado (sem admin)
                </div>
              </div>
              <button onClick={() => setShowRbac(true)}
                className="mt-3 text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition">
                <Download className="w-3 h-3" /> Ver YAML do RBAC
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cluster list */}
      {clusters.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-elevated mx-auto mb-4 flex items-center justify-center">
            <Server className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-1">Nenhum cluster configurado</h3>
          <p className="text-sm text-text-secondary mb-5 max-w-sm mx-auto">
            Adicione seu cluster AKS para começar o monitoramento read-only
          </p>
          <button onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition">
            Adicionar primeiro cluster
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {clusters.map(cluster => (
            <div key={cluster.id} className="rounded-2xl border border-border bg-surface overflow-hidden hover:border-purple-800/50 transition-colors">
              <div className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Server className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-text-primary">{cluster.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">{cluster.authMethod === 'kubeconfig' ? '🔑 Kubeconfig' : '🏢 Service Principal'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" /> Encrypted
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">READ-ONLY</span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">
                    Namespaces: {cluster.namespaces?.length > 0 ? cluster.namespaces.join(', ') : <span className="text-text-tertiary italic">Todos disponíveis</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {testResult[cluster.id] && (
                    <div className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg ${testResult[cluster.id].ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {testResult[cluster.id].ok ? <><CheckCircle2 className="w-3.5 h-3.5" /><span className="font-medium">{testResult[cluster.id].version}</span></> : <><XCircle className="w-3.5 h-3.5" />Falhou</>}
                    </div>
                  )}
                  <button onClick={() => testCluster(cluster.id)} disabled={testing === cluster.id}
                    className="px-4 py-2 text-xs font-medium bg-surface-elevated hover:bg-surface-active text-text-secondary rounded-xl border border-border transition-colors">
                    {testing === cluster.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Testar Conexão'}
                  </button>
                  <button onClick={() => deleteCluster(cluster.id)} className="p-2 rounded-xl text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition" title="Destruir credenciais">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Security footer */}
              <div className="px-5 py-3 bg-surface-elevated/50 border-t border-border flex items-center gap-5 text-[10px] text-text-tertiary">
                <span className="flex items-center gap-1.5"><KeyRound className="w-3 h-3 text-purple-400/60" /> Key v{cluster.keyVersion}</span>
                <span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-emerald-400/60" /> {cluster.credentialFingerprint ? `Fingerprint: ${cluster.credentialFingerprint.slice(0,8)}…` : '—'}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-blue-400/60" /> {cluster.accessCount} acesso{cluster.accessCount !== 1 ? 's' : ''}</span>
                {cluster.lastRotatedAt && (
                  <span className="flex items-center gap-1.5"><RotateCcw className="w-3 h-3" /> Rotação: {new Date(cluster.lastRotatedAt).toLocaleDateString('pt-BR')}</span>
                )}
                {cluster.isCredentialStale && (
                  <span className="flex items-center gap-1.5 text-amber-400 font-medium"><AlertTriangle className="w-3 h-3" /> Rotação recomendada</span>
                )}
              </div>

              {/* Write access warning */}
              {testResult[cluster.id]?.permissions?.some((p: string) => p.includes('WRITE')) && (
                <div className="px-5 py-2.5 bg-amber-950/30 border-t border-amber-800/30 flex items-center gap-2 text-[11px] text-amber-400">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span><strong>Atenção:</strong> Credencial possui acesso de escrita. Recomendado usar o ServiceAccount read-only (veja RBAC acima).</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <ClusterForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
      {showRbac && <RbacModal onClose={() => setShowRbac(false)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════
// RBAC MODAL — shows the kubectl commands
// ═══════════════════════════════════════════════

function RbacModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const rbacContent = `# 1. Aplicar o RBAC read-only no cluster:
kubectl apply -f k8s-readonly-rbac.yaml

# 2. Gerar token de acesso (válido por 1 ano):
kubectl create token dba-analyser-readonly \\
  -n dba-analyser-monitor \\
  --duration=8760h

# 3. Gerar kubeconfig com esse token:
kubectl config set-credentials dba-readonly --token=<TOKEN>
kubectl config set-context dba-readonly \\
  --cluster=<SEU_CLUSTER> --user=dba-readonly
kubectl config use-context dba-readonly
kubectl config view --flatten > kubeconfig-readonly.yaml

# 4. Upload o kubeconfig-readonly.yaml nesta página`

  const copy = () => {
    navigator.clipboard.writeText(rbacContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">RBAC Read-Only — Setup</h2>
            <p className="text-xs text-text-secondary mt-0.5">Permissões mínimas para monitoramento (get, list, watch)</p>
          </div>
          <button onClick={copy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${copied ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-elevated hover:bg-surface-active text-text-secondary'}`}>
            {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
          </button>
        </div>
        <div className="p-5">
          <pre className="text-[11px] leading-relaxed text-emerald-300/80 bg-gray-950 rounded-xl p-4 overflow-x-auto font-mono border border-gray-800">
            {rbacContent}
          </pre>
          <div className="mt-4 p-3 rounded-xl bg-blue-950/30 border border-blue-900/30 text-[11px] text-blue-300/80 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-300 mb-1">O que esse RBAC faz:</p>
              <p>Cria um ServiceAccount com <strong>apenas</strong> verbos get/list/watch. O DBA Analyser <strong>não pode</strong> criar, editar, escalar ou deletar nenhum recurso no seu cluster. O arquivo completo está em <code>demandas/k8s-readonly-rbac.yaml</code>.</p>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-xl transition">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// CLUSTER FORM — Security-hardened
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
  const [fileName, setFileName] = useState('')

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isValidUUID = (v: string) => !v || UUID_REGEX.test(v)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) { setError('Arquivo excede 1MB'); return }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      if (!content.includes('apiVersion') && !content.includes('clusters')) {
        setError('Não parece ser um kubeconfig válido'); return
      }
      setForm(f => ({ ...f, kubeconfig: content }))
      setFileLoaded(true); setError('')
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

  const inputCls = "w-full px-3.5 py-2.5 bg-gray-900/50 border border-gray-700/60 rounded-xl text-sm text-text-primary placeholder:text-gray-600 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition"
  const errorInputCls = "w-full px-3.5 py-2.5 bg-gray-900/50 border border-red-700/60 rounded-xl text-sm text-text-primary placeholder:text-gray-600 focus:ring-2 focus:ring-red-500/50 outline-none transition"

  const getFieldError = (field: string) => validationErrors.find(e => e.field === field)?.message

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur-sm p-5 border-b border-border z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Novo Cluster</h2>
              <p className="text-xs text-text-secondary mt-0.5">Conexão read-only com criptografia AES-256</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              <ShieldCheck className="w-3 h-3" /> Criptografia Ativa
            </div>
          </div>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Nome do Cluster</label>
              <input className={getFieldError('name') ? errorInputCls : inputCls}
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Produção AKS, Homologação" maxLength={100} required />
              {getFieldError('name') && <p className="text-[10px] text-red-400 mt-1">{getFieldError('name')}</p>}
            </div>

            {/* Auth method */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Método de Autenticação</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForm(f => ({ ...f, authMethod: 'kubeconfig' }))}
                  className={`p-3.5 rounded-xl border text-left transition ${form.authMethod === 'kubeconfig' ? 'border-purple-500/50 bg-purple-500/5 ring-1 ring-purple-500/30' : 'border-border hover:border-gray-600'}`}>
                  <p className="text-sm font-semibold text-text-primary">🔑 Kubeconfig</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">Upload do arquivo YAML</p>
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, authMethod: 'service_principal' }))}
                  className={`p-3.5 rounded-xl border text-left transition ${form.authMethod === 'service_principal' ? 'border-purple-500/50 bg-purple-500/5 ring-1 ring-purple-500/30' : 'border-border hover:border-gray-600'}`}>
                  <p className="text-sm font-semibold text-text-primary">🏢 Service Principal</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">Azure AD credentials</p>
                </button>
              </div>
            </div>

            {form.authMethod === 'kubeconfig' ? (
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Arquivo Kubeconfig</label>
                <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${fileLoaded ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-gray-700/60 hover:border-purple-500/40 hover:bg-purple-500/5'}`}>
                  <input type="file" accept=".yaml,.yml,.config,.conf,.txt" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {fileLoaded ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                      </div>
                      <p className="text-sm font-medium text-emerald-400">Kubeconfig carregado</p>
                      <p className="text-[10px] text-text-tertiary">{fileName} — será criptografado ao salvar</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center">
                        <Upload className="w-6 h-6 text-text-tertiary" />
                      </div>
                      <p className="text-sm text-text-secondary">Arraste ou clique para selecionar</p>
                      <p className="text-[10px] text-text-tertiary">Máx 1MB • .yaml, .yml, .config</p>
                    </div>
                  )}
                </div>
                {getFieldError('kubeconfig') && <p className="text-[10px] text-red-400 mt-1">{getFieldError('kubeconfig')}</p>}
                <p className="text-[10px] text-blue-400/70 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Use o kubeconfig gerado com o ServiceAccount read-only
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                      Tenant ID <Lock className="w-3 h-3 inline text-emerald-400 ml-0.5" />
                    </label>
                    <input className={!isValidUUID(form.tenantId) && form.tenantId ? errorInputCls : inputCls}
                      value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                      placeholder="UUID do Azure AD" required />
                    {form.tenantId && !isValidUUID(form.tenantId) && <p className="text-[10px] text-red-400 mt-1">UUID inválido</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                      Client ID <Lock className="w-3 h-3 inline text-emerald-400 ml-0.5" />
                    </label>
                    <input className={!isValidUUID(form.clientId) && form.clientId ? errorInputCls : inputCls}
                      value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                      placeholder="UUID do App Registration" required />
                    {form.clientId && !isValidUUID(form.clientId) && <p className="text-[10px] text-red-400 mt-1">UUID inválido</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    Client Secret <Lock className="w-3 h-3 inline text-emerald-400 ml-0.5" />
                  </label>
                  <div className="relative">
                    <input type={showSecret ? 'text' : 'password'} className={inputCls + ' pr-10'}
                      value={form.clientSecret} onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))}
                      placeholder="••••••••••••••••••••" required />
                    <button type="button" onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition p-0.5">
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form.clientSecret && form.clientSecret.length > 0 && form.clientSecret.length < 8 && (
                    <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Secret muito curto (mín. 8)</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">Subscription ID</label>
                    <input className={inputCls} value={form.subscriptionId} onChange={e => setForm(f => ({ ...f, subscriptionId: e.target.value }))} placeholder="Opcional" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">Resource Group</label>
                    <input className={inputCls} value={form.resourceGroup} onChange={e => setForm(f => ({ ...f, resourceGroup: e.target.value }))} placeholder="Opcional" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Cluster Name</label>
                  <input className={inputCls} value={form.clusterName} onChange={e => setForm(f => ({ ...f, clusterName: e.target.value }))} placeholder="Nome do AKS no Azure" />
                </div>
              </div>
            )}

            {/* Security footer */}
            <div className="rounded-xl bg-gray-900/40 border border-gray-800/50 p-4">
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Proteções ao salvar</p>
              <div className="grid grid-cols-2 gap-2">
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70"><Shield className="w-3 h-3 text-emerald-500" /> AES-256-GCM</span>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70"><KeyRound className="w-3 h-3 text-emerald-500" /> PBKDF2 100k</span>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70"><Lock className="w-3 h-3 text-emerald-500" /> Salt único/campo</span>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Tamper-proof</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated rounded-xl border border-border transition">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-purple-800 disabled:to-indigo-800 text-white text-sm font-semibold rounded-xl shadow-lg shadow-purple-900/30 transition flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {saving ? 'Criptografando...' : 'Salvar com Criptografia'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
