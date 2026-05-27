import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { Server, Plus, Trash2, CheckCircle2, XCircle, Loader2, Upload, Shield, ShieldCheck, Eye, EyeOff, AlertTriangle, Lock, KeyRound, Clock, RotateCcw, Info, Copy, Download, ExternalLink, ShieldAlert, EyeIcon } from 'lucide-react'
import api from '../lib/api'

export default function K8sClustersPage() {
  const { t } = useTranslation()
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
          <h3 className="text-base font-semibold text-text-primary mb-1">{t('k8s.clusters.noClusters')}</h3>
          <p className="text-sm text-text-secondary mb-5 max-w-sm mx-auto">
            Adicione seu cluster AKS para começar o monitoramento read-only
          </p>
          <button onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition">{t('k8s.clusters.addFirst')}</button>
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


import RbacModal from '../components/k8s/RbacModal'
import ClusterForm from '../components/k8s/ClusterForm'
