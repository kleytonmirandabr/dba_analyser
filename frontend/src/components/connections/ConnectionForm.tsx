import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import api from '../../lib/api'

interface Connection { id: string; name: string; host: string; port: number; databaseName: string; username: string; dbType: string; environment: string; mode: string; groupName?: string; }

export default function ConnectionForm({ onClose, onSaved, connection }: { onClose: () => void; onSaved: () => void; connection?: Connection }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: connection?.name || '', host: connection?.host || '', port: connection?.port || 5432,
    databaseName: connection?.databaseName || '', username: connection?.username || '', password: '',
    dbType: connection?.dbType || 'postgresql', environment: connection?.environment || 'dev',
    mode: connection?.mode || 'readonly', autoApprove: false, groupName: connection?.groupName || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
              <div className="relative">
                <input type={showPassword ? "text" : "password"} className={inputCls + " pr-9"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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



