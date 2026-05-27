import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Upload, Shield, AlertTriangle } from 'lucide-react'
import api from '../../lib/api'

export default function ClusterForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
